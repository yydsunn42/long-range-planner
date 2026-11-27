function getVisibleLrpProjects(settings) {
  const projects = settings.projects || [];
  return settings.showAllProjects ? projects : projects.filter(p => p.id === settings.activeProjectId);
}
function createLrpProjectScope(plugin, projectId) {
  plugin=plugin.lrpRootPlugin || plugin;
  const scope = Object.create(plugin);
  scope.lrpRootPlugin = plugin.lrpRootPlugin || plugin;
  scope.lrpEmbeddedScope = true;
  scope.settings = Object.assign(Object.create(plugin.settings),{activeProjectId: projectId, showAllProjects: false});
  scope.saveSettings = async () => {
    const {activeProjectId, showAllProjects, ...changes} = scope.settings;
    Object.assign(plugin.settings, changes);
    await plugin.saveSettings();
  };
  const store = new TaskStore(scope);
  // Follow the current canonical map even after reload or a sync replaces an array.
  // A private override is used only by staged Apple completion transactions.
  Object.defineProperty(store,'tasksByProject',{
    configurable:true,get(){return this.lrpProjectMapOverride || plugin.taskStore.tasksByProject;},
    set(value){this.lrpProjectMapOverride=value;}
  });
  store.load=()=>plugin.taskStore.load();
  store.loaded = true;
  store.rebuildIndex();
  const save = store.saveQuietly;
  store.saveQuietly = async () => {
    await save.call(store);
    plugin.taskStore.tasks = plugin.taskStore.tasksByProject[plugin.settings.activeProjectId] || [];
    plugin.taskStore.rebuildIndex();
  };
  scope.taskStore = store;
  const emit=store.emit;
  store.emit=function(){emit.call(store);if(store.lrpEmitToRoot && !store.lrpProjectMapOverride)plugin.taskStore.emit();};
  scope.openTaskDetail = (task,options) => plugin.openTaskDetail(task,options);
  return scope;
}
// Pin each mutation to its task's project before the first await. Selecting another
// project while a disk write is pending must never redirect its continuation.
function installLrpTaskStoreIsolation() {
  for(const name of ['addTask','addTaskAtIndex','addTaskFromObject','updateTask','deleteTask','setOrder','toggleCollapsed','makeSubtask','promoteSubtask','moveTaskToProject','rollUpParentFields','cascadeDependencyDates']) {
    const original=TaskStore.prototype[name];
    TaskStore.prototype[name]=function(...args){
      if(this.plugin.lrpRootPlugin || this.plugin.taskStore!==this)return original.apply(this,args);
      let projectId=this.activeProjectId;
      const taskId=name==='setOrder'?args[0]?.[0]:name.startsWith('addTask')?null:args[0];
      if(taskId && !this.getAllForProject(projectId).some(task=>task.id===taskId)) {
        const owner=Object.entries(this.tasksByProject).find(([,tasks])=>tasks.some(task=>task.id===taskId));
        if(owner)projectId=owner[0];
      }
      const bucketId=name==='addTask'?args[1]?.bucketId:name==='addTaskAtIndex'?args[2]?.bucketId:name==='addTaskFromObject'?args[0]?.bucketId:null;
      if(bucketId) {
        const owner=(this.plugin.settings.projects || []).find(project=>project.buckets?.some(bucket=>bucket.id===bucketId));
        if(owner)projectId=owner.id;
      }
      if(!(this.plugin.settings.projects || []).some(project=>project.id===projectId))return original.apply(this,args);
      const scoped=createLrpProjectScope(this.plugin,projectId).taskStore;
      scoped.lrpEmitToRoot=true;
      return original.apply(scoped,args);
    };
  }
}
installLrpTaskStoreIsolation();
async function clearLrpEmbeddedViews(view) {
  const children = view.lrpEmbeddedViews || [];
  view.lrpEmbeddedViews = [];
  for (const child of children) {
    await child.onClose();
    child.unload?.();
  }
}
function createLrpEmbeddedLeaf(leaf, host) {
  return new Proxy(leaf, {
    get(target, key) {
      if (key === 'containerEl') return host;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}
function clearLrpLeakedViewContainers(view) {
  const root = view.leaf?.containerEl;
  if (!root?.children) return;
  for (const child of [...root.children]) {
    if (child !== view.containerEl && child.matches?.('.workspace-leaf-content[data-type^="lrp-program-"]')) child.remove();
  }
}
async function openLrpProjectFromHeading(view,projectId) {
  if(view.lrpProjectOpening || !(view.plugin.settings.projects || []).some(project=>project.id===projectId))return;
  view.lrpProjectOpening=true;
  try{
    view.lrpAllGeneration=(view.lrpAllGeneration || 0)+1;
    view.plugin.settings.activeProjectId=projectId;
    view.plugin.settings.showAllProjects=false;
    await view.plugin.saveSettings();
    await view.plugin.taskStore.load();
    await (view.lrpRenderProjectScope ? view.lrpRenderProjectScope() : view.render());
  }finally{view.lrpProjectOpening=false;}
}
// Vault-relative folder that owns a project's task file. Rejects traversal so a malformed storageKey cannot escape.
function getLrpProjectFolderPath(plugin,project) {
  const base=String(plugin.settings.projectsBasePath || 'long-range-planner').replace(/^\/+|\/+$/g,'');
  const folder=String(project.storageKey ?? project.name ?? '').trim();
  if(!folder || folder==='.' || folder==='..' || /[\\/]/.test(folder))return null;
  const path=base ? `${base}/${folder}` : folder;
  return path.replace(/\/{2,}/g,'/');
}
async function removeLrpProjectFolder(plugin,project) {
  const path=getLrpProjectFolderPath(plugin,project);
  if(!path)return {path:null,error:new Error('项目目录名无效，已跳过目录删除。')};
  const adapter=plugin.app?.vault?.adapter;
  if(!adapter)return {path,error:new Error('无法访问笔记库文件系统。')};
  try{
    if(await adapter.exists(path))await adapter.rmdir(path,true);
    return {path,error:null};
  }catch(error){return {path,error};}
}
// Deletes whole projects: settings entries first (with rollback), then their folders and task files.
async function deleteLrpProjects(plugin,ids) {
  const settings=plugin.settings;
  const current=settings.projects || [];
  const remove=new Set(ids || []);
  if(!remove.size)throw new Error('请先选择要删除的项目。');
  const removed=current.filter(project=>remove.has(project.id));
  if(!removed.length)throw new Error('所选项目已不存在，请刷新后重试。');
  const kept=current.filter(project=>!remove.has(project.id));
  if(!kept.length)throw new Error('至少保留一个项目。');
  const previousProjects=settings.projects;
  const previousActive=settings.activeProjectId;
  const previousAll=settings.showAllProjects;
  settings.projects=kept;
  if(remove.has(settings.activeProjectId))settings.activeProjectId=kept[0].id;
  try{await plugin.saveSettings();}
  catch(error){
    settings.projects=previousProjects;
    settings.activeProjectId=previousActive;
    settings.showAllProjects=previousAll;
    try{refreshLrpHiddenProjectFolders(plugin);}catch{}
    throw error;
  }
  // Only after settings are safely saved: a failed save must never leave data folders missing.
  const failures=[];
  const keptKeys=new Set(kept.map(project=>String(project.storageKey ?? project.name ?? '').trim()));
  for(const project of removed){
    const key=String(project.storageKey ?? project.name ?? '').trim();
    if(keptKeys.has(key))continue;
    const result=await removeLrpProjectFolder(plugin,project);
    if(result.error)failures.push({project,path:result.path,error:result.error});
    if(plugin.taskStore?.tasksByProject)delete plugin.taskStore.tasksByProject[project.id];
  }
  if(remove.has(previousActive) && plugin.taskStore?.load){
    try{await plugin.taskStore.load();}catch(error){console.error(error);}
  }
  if(failures.length)console.warn('部分项目目录未能删除，文件已保留：',failures);
  return {removed,failures};
}
class LrpDeleteProjectsModal extends obsidian.Modal {
  constructor(plugin,projects,onConfirm) {
    super(plugin.app);
    this.plugin=plugin;this.projects=projects;this.onConfirm=onConfirm;
  }
  onOpen() {
    const content=this.contentEl;content.empty();
    content.createEl('h2',{text:`删除 ${this.projects.length} 个项目？`});
    const list=content.createEl('ul',{cls:'lrp-delete-project-list'});
    for(const project of this.projects)list.createEl('li',{text:project.name});
    content.createEl('p',{text:'将同时删除项目目录及其中的任务文件，删除后无法恢复。',cls:'lrp-delete-project-hint'});
    const errorText=content.createDiv({cls:'lrp-delete-project-error',attr:{role:'alert'}});
    const actions=content.createDiv({cls:'lrp-delete-project-actions'});
    const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}});
    const confirm=actions.createEl('button',{text:`删除 ${this.projects.length} 个`,cls:'mod-warning',attr:{type:'button'}});
    cancel.onclick=()=>this.close();
    confirm.onclick=async()=>{
      if(confirm.disabled)return;
      confirm.disabled=true;cancel.disabled=true;errorText.textContent='';
      try{await this.onConfirm();}
      catch(error){errorText.textContent=error?.message || '删除项目失败，请重试。';confirm.disabled=false;cancel.disabled=false;return;}
      this.close();
    };
  }
  onClose() { this.contentEl.empty(); }
}
function createLrpProjectFinder(container,view,records,key='lrpBoard',options={}) {
  const shell=container.createDiv('lrp-project-finder-shell');
  const sidebar=shell.createDiv('lrp-project-finder');
  const content=shell.createDiv('lrp-project-finder-content');
  return {content,...buildLrpGroupedProjectFinder(sidebar,view,records,key)};
}
function addLrpBoardProjectFilters(container,view,records) {
  return createLrpProjectFinder(container,view,records,'lrpBoard',{onDeleted:()=>view.render()});
}
async function renderLrpAllProjects(view, ViewClass, active) {
  const generation = (view.lrpAllGeneration || 0) + 1;
  view.lrpAllGeneration = generation;
  await clearLrpEmbeddedViews(view);
  if (generation !== view.lrpAllGeneration) return;
  if(!view.plugin.settings.showAllProjects || view.lrpClosed)return;
  const container = view.containerEl;
  container.empty();
  const wrapper = container.createDiv('lrp-all-projects-wrapper');
  renderPlannerHeader(wrapper, view.plugin, {active, hideAddTask: true, onProjectChange: () => view.render()});
  const records=[];
  const finder=addLrpBoardProjectFilters(wrapper,view,records);
  const list=finder.content;list.classList.add('lrp-all-project-list');
  for (const project of view.plugin.settings.projects || []) {
    if (generation !== view.lrpAllGeneration || !view.plugin.settings.showAllProjects || view.lrpClosed) return;
    const section = list.createEl('section', {cls:'lrp-all-project-section',attr:{'data-project-id':project.id}});
    section.style.setProperty('--lrp-project-color', project.calendarColor);
    const record={project,section,child:null};records.push(record);finder.refresh();
    const heading=section.createEl('h3', {text:project.name, cls:'lrp-all-project-heading',attr:{tabindex:'0',role:'button',title:'双击展开此项目（或按回车键）'}});
    const openProject=async()=>{
      try{await openLrpProjectFromHeading(view,project.id);}
      catch(error){new obsidian.Notice('打开项目失败，请重试');console.error(error);}
    };
    heading.ondblclick=event=>{event.preventDefault();event.stopPropagation();void openProject();};
    heading.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();void openProject();}};
    addLrpProjectEditButton(heading,view.plugin,project,()=>view.render());
    renderLrpProjectOverview(section,view.plugin,project,()=>view.render());
    const host = section.createDiv('lrp-all-project-view');
    const scope = createLrpProjectScope(view.plugin, project.id);
    scope.lrpBoardVisibleWeeks=2;
    const child = new ViewClass(createLrpEmbeddedLeaf(view.leaf, host), scope);
    record.child=child;
    view.lrpEmbeddedViews.push(child);
    await child.onOpen();
  }
}
function installLrpAllProjects(ViewClass, active) {
  const render = ViewClass.prototype.render;
  const close = ViewClass.prototype.onClose;
  ViewClass.prototype.render = function (...args) {
    if (!this.plugin.lrpEmbeddedScope) clearLrpLeakedViewContainers(this);
    if (this.plugin.settings.showAllProjects && !this.plugin.lrpEmbeddedScope) {
      return active === 'board' ? renderLrpAllProjects(this, ViewClass, active) : renderLrpPortfolio(this, active);
    }
    this.lrpAllGeneration = (this.lrpAllGeneration || 0) + 1;
    if (this.lrpEmbeddedViews?.length) void clearLrpEmbeddedViews(this);
    return render.apply(this, args);
  };
  ViewClass.prototype.onClose = async function (...args) {
    this.lrpAllGeneration = (this.lrpAllGeneration || 0) + 1;
    await clearLrpEmbeddedViews(this);
    return close.apply(this, args);
  };
}
installLrpAllProjects(GridView, 'grid');
installLrpAllProjects(BoardView, 'board');
installLrpAllProjects(GanttView, 'gantt');
