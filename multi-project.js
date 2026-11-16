function getVisibleLrpProjects(settings) {
  const projects = settings.projects || [];
  return settings.showAllProjects ? projects : projects.filter(p => p.id === settings.activeProjectId);
}
function createLrpProjectScope(plugin, projectId) {
  const scope = Object.create(plugin);
  scope.lrpEmbeddedScope = true;
  scope.settings = {...plugin.settings, activeProjectId: projectId, showAllProjects: false};
  scope.saveSettings = async () => {
    const {activeProjectId, showAllProjects, ...changes} = scope.settings;
    Object.assign(plugin.settings, changes);
    await plugin.saveSettings();
  };
  const store = new TaskStore(scope);
  store.tasksByProject = plugin.taskStore.tasksByProject;
  store.tasks = store.tasksByProject[projectId] || [];
  store.loaded = true;
  store.rebuildIndex();
  const save = store.saveQuietly;
  store.saveQuietly = async () => {
    await save.call(store);
    plugin.taskStore.tasks = plugin.taskStore.tasksByProject[plugin.settings.activeProjectId] || [];
    plugin.taskStore.rebuildIndex();
  };
  scope.taskStore = store;
  scope.openTaskDetail = (task,options) => plugin.openTaskDetail(task,options);
  return scope;
}
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
function createLrpProjectFinder(container,view,records,key='lrpBoard') {
  const shell=container.createDiv('lrp-project-finder-shell');
  const sidebar=shell.createDiv('lrp-project-finder');
  sidebar.createEl('h3',{text:'查找项目'});
  const search=sidebar.createEl('input',{attr:{type:'search',placeholder:'搜索项目…','aria-label':'搜索项目名称'}});
  search.value=view[key+'ProjectSearch'] || '';
  const status=sidebar.createEl('select',{attr:{'aria-label':'项目状态'}});
  for(const [value,text] of [['all','全部'],['unfinished','未完成'],['completed','已完成'],['notStarted','未开始'],['inProgress','进行中'],['blocked','受阻'],['overdue','逾期'],['abandoned','已放弃']])status.createEl('option',{text,value});
  status.value=view[key+'ProjectStatus'] || 'all';
  const list=sidebar.createDiv('lrp-project-finder-list');
  const empty=sidebar.createDiv({text:'没有符合条件的项目',cls:'lrp-project-finder-empty'});
  const content=shell.createDiv('lrp-project-finder-content');
  const buttons=new Map();
  const focus=(id,scroll=true)=>{
    view[key+'FocusedProject']=id;
    for(const record of records){
      const selected=record.project.id===id;
      record.section.classList?.toggle?.('lrp-project-finder-focused',selected);
      if(selected && scroll && !record.section.hidden)record.section.scrollIntoView?.({behavior:'smooth',block:'center'});
    }
    for(const [id,button] of buttons)button.setAttribute('aria-pressed',String(id===view[key+'FocusedProject']));
  };
  const open=async id=>{try{await openLrpProjectFromHeading(view,id);}catch(error){new obsidian.Notice('打开项目失败，请重试');console.error(error);}};
  const refresh=()=>{
    list.empty();buttons.clear();
    const query=search.value.trim().toLocaleLowerCase();let count=0;
    for(const record of records){
      const {project,section}=record;
      const tasks=view.plugin.taskStore.getAllForProject(project.id) || [];
      const match=project.name.toLocaleLowerCase().includes(query) && matchesLrpDependencyProject(view.plugin,tasks,status.value);
      const wasHidden=section.hidden;section.hidden=!match;
      if(!match)continue;
      count++;
      if(wasHidden && record.child)void Promise.resolve(record.child.render()).catch(console.error);
      const button=list.createEl('button',{text:project.name,attr:{type:'button','aria-pressed':String(project.id===view[key+'FocusedProject']),title:'单击定位，双击进入项目'}});
      button.style.setProperty('--lrp-project-color',project.calendarColor);
      button.onclick=()=>focus(project.id);
      button.ondblclick=event=>{event.preventDefault();void open(project.id);};
      buttons.set(project.id,button);
    }
    empty.hidden=count>0;focus(view[key+'FocusedProject'],false);
  };
  status.onchange=()=>{view[key+'ProjectStatus']=status.value;refresh();};
  search.oninput=()=>{view[key+'ProjectSearch']=search.value;refresh();};
  refresh();return {content,refresh,focus};
}
function addLrpBoardProjectFilters(container,view,records) {
  return createLrpProjectFinder(container,view,records,'lrpBoard');
}
async function renderLrpAllProjects(view, ViewClass, active) {
  const generation = (view.lrpAllGeneration || 0) + 1;
  view.lrpAllGeneration = generation;
  await clearLrpEmbeddedViews(view);
  if (generation !== view.lrpAllGeneration) return;
  const container = view.containerEl;
  container.empty();
  const wrapper = container.createDiv('lrp-all-projects-wrapper');
  renderPlannerHeader(wrapper, view.plugin, {active, hideAddTask: true, onProjectChange: () => view.render()});
  const records=[];
  const finder=addLrpBoardProjectFilters(wrapper,view,records);
  const list=finder.content;list.classList.add('lrp-all-project-list');
  for (const project of view.plugin.settings.projects || []) {
    if (generation !== view.lrpAllGeneration) return;
    const section = list.createEl('section', {cls:'lrp-all-project-section'});
    section.style.setProperty('--lrp-project-color', project.calendarColor);
    const record={project,section,child:null};records.push(record);finder.refresh();
    const heading=section.createEl('h3', {text:project.name, cls:'lrp-all-project-heading',attr:{tabindex:'0',role:'button',title:'双击展开此项目（或按回车键）'}});
    const openProject=async()=>{
      try{await openLrpProjectFromHeading(view,project.id);}
      catch(error){new obsidian.Notice('打开项目失败，请重试');console.error(error);}
    };
    heading.ondblclick=event=>{event.preventDefault();event.stopPropagation();void openProject();};
    heading.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();void openProject();}};
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
