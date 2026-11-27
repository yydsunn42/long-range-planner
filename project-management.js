// Shared project groups, navigation and management for dashboard, board and dependencies.
const LRP_UNGROUPED_PROJECTS = '__ungrouped__';
function getLrpProjectGroups(settings) {
  const seen=new Set();
  return (settings.projectGroups || []).filter(group=>group && group.id && group.id!==LRP_UNGROUPED_PROJECTS && !seen.has(group.id) && seen.add(group.id)).map(group=>({id:group.id,name:group.name})).concat({id:LRP_UNGROUPED_PROJECTS,name:'未分组'});
}
function getLrpProjectGroupId(settings,project) {
  return (settings.projectGroups || []).some(group=>group.id===project.groupId)?project.groupId:LRP_UNGROUPED_PROJECTS;
}
function sortLrpGroupedProjects(plugin,projects) {
  const ended=new Map(projects.map(project=>[project.id,!getLrpProjectState(plugin,plugin.taskStore.getAllForProject(project.id) || []).unfinished]));
  return [...projects].sort((a,b)=>Number(ended.get(a.id))-Number(ended.get(b.id)) || (Date.parse(b.createdDate)||0)-(Date.parse(a.createdDate)||0));
}
async function saveLrpProjectGroup(plugin,action) {
  const settings=plugin.settings;
  const previousGroups=settings.projectGroups;
  const previousProjects=settings.projects;
  settings.projectGroups=(previousGroups || []).map(group=>({...group}));
  settings.projects=(previousProjects || []).map(project=>({...project}));
  try { action(settings);await plugin.saveSettings(); }
  catch(error){settings.projectGroups=previousGroups;settings.projects=previousProjects;throw error;}
}
function renderLrpGroupedProjectPicker(menu,plugin,onChoose) {
  menu.classList.add('lrp-grouped-project-menu');
  const navigation=menu.createDiv('lrp-project-group-navigation');
  const all=navigation.createEl('button',{text:'全部项目',attr:{type:'button'}});
  all.onclick=()=>onChoose('全部项目',null,'#999999');
  const projects=menu.createDiv('lrp-project-group-flyout');projects.hidden=true;
  const groupButtons=[];
  const groupsById=new Map();
  for(const group of getLrpProjectGroups(plugin.settings)) {
    const button=navigation.createEl('button',{text:group.name,attr:{type:'button','aria-expanded':'false'}});
    groupButtons.push(button);groupsById.set(group.id,button);
    button.onclick=()=>{
      for(const item of groupButtons)item.setAttribute('aria-expanded',String(item===button));
      projects.hidden=false;projects.empty();projects.createDiv({text:group.name,cls:'lrp-project-group-heading'});
      const members=sortLrpGroupedProjects(plugin,(plugin.settings.projects || []).filter(project=>getLrpProjectGroupId(plugin.settings,project)===group.id));
      for(const project of members){
        const state=getLrpProjectState(plugin,plugin.taskStore.getAllForProject(project.id) || []);
        const entry=projects.createEl('button',{text:project.name,cls:state.unfinished?'':'is-ended',attr:{type:'button'}});
        entry.style.setProperty('--lrp-project-color',project.calendarColor || '#999999');
        entry.onclick=()=>onChoose(project.name,project.id,project.calendarColor);
      }
      if(!members.length)projects.createDiv({text:'暂无项目',cls:'lrp-project-group-empty'});
    };
  }
  const showCurrentGroup=()=>{
    const selected=(plugin.settings.projects || []).find(project=>project.id===plugin.settings.activeProjectId);
    if(selected && !plugin.settings.showAllProjects)groupsById.get(getLrpProjectGroupId(plugin.settings,selected))?.onclick();
  };
  showCurrentGroup();return {showCurrentGroup};
}
function buildLrpGroupedProjectFinder(sidebar,view,records,key='lrpBoard') {
  const plugin=view.plugin;
  const header=sidebar.createDiv('lrp-project-finder-header');
  header.createEl('h3',{text:'查找项目'});
  const manage=header.createEl('button',{text:'管理',cls:'lrp-project-finder-manage',attr:{type:'button'}});
  manage.onclick=()=>new LrpManageProjectsModal(plugin,()=>view.render()).open();
  const search=sidebar.createEl('input',{attr:{type:'search',placeholder:'搜索项目…','aria-label':'搜索项目名称'}});
  search.value=view[key+'ProjectSearch'] || '';
  const status=sidebar.createEl('select',{attr:{'aria-label':'项目状态'}});
  for(const [value,text] of [['all','全部'],['unfinished','未完成'],['completed','已完成'],['notStarted','未开始'],['inProgress','进行中'],['blocked','受阻'],['overdue','逾期'],['abandoned','已放弃']])status.createEl('option',{text,value});
  status.value=view[key+'ProjectStatus'] || 'all';
  const list=sidebar.createDiv('lrp-project-finder-list');
  const empty=sidebar.createDiv({text:'没有符合条件的项目',cls:'lrp-project-finder-empty'});
  const buttons=new Map();
  const focus=(id,scroll=true)=>{
    view[key+'FocusedProject']=id;
    for(const record of records){
      const selected=record.project.id===id;
      record.section.classList?.toggle?.('lrp-project-finder-focused',selected);
      record.section.classList?.toggle?.('lrp-dashboard-focused',selected);
      if(selected && scroll && !record.section.hidden)record.section.scrollIntoView?.({behavior:'smooth',block:'start',inline:'nearest'});
    }
    for(const [projectId,button] of buttons)button.setAttribute('aria-pressed',String(projectId===id));
  };
  const refresh=()=>{
    list.empty();buttons.clear();
    const query=search.value.trim().toLocaleLowerCase();
    const visible=[];
    for(const record of records){
      const tasks=plugin.taskStore.getAllForProject(record.project.id) || [];
      const match=record.project.name.toLocaleLowerCase().includes(query) && matchesLrpProjectStatus(plugin,tasks,status.value);
      const wasHidden=record.section.hidden;record.section.hidden=!match;
      if(match){visible.push(record);if(wasHidden && record.child)void Promise.resolve(record.child.render()).catch(console.error);}
    }
    const collapsed=view[key+'CollapsedGroups'] || (view[key+'CollapsedGroups']=new Set());
    for(const group of getLrpProjectGroups(plugin.settings)){
      const members=visible.filter(record=>getLrpProjectGroupId(plugin.settings,record.project)===group.id);
      if(query && !members.length)continue;
      const details=list.createEl('details',{cls:'lrp-project-finder-group',attr:{'data-lrp-group-id':group.id}});details.open=!collapsed.has(group.id) || Boolean(query);
      const title=details.createEl('summary',{text:group.name});title.createSpan({text:String(members.length),cls:'lrp-project-group-count'});
      details.ontoggle=()=>{if(details.open)collapsed.delete(group.id);else collapsed.add(group.id);};
      for(const project of sortLrpGroupedProjects(plugin,members.map(record=>record.project))){
        const state=getLrpProjectState(plugin,plugin.taskStore.getAllForProject(project.id) || []);
        const button=details.createEl('button',{text:project.name,cls:state.unfinished?'':'is-ended',attr:{type:'button',title:'单击定位，双击进入项目，右键编辑项目'}});
        button.style.setProperty('--lrp-project-color',project.calendarColor || '#999999');
        button.onclick=()=>focus(project.id);
        button.ondblclick=event=>{event.preventDefault();void openLrpProjectFromHeading(view,project.id).catch(error=>{console.error(error);new obsidian.Notice('打开项目失败，请重试');});};
        button.oncontextmenu=event=>{event.preventDefault();new LrpProjectOverviewModal(plugin,project.id,()=>view.render()).open();};
        buttons.set(project.id,button);
      }
    }
    empty.hidden=visible.length>0;focus(view[key+'FocusedProject'],false);
  };
  search.oninput=()=>{view[key+'ProjectSearch']=search.value;refresh();};
  status.onchange=()=>{view[key+'ProjectStatus']=status.value;refresh();};
  refresh();return {refresh,focus};
}
class LrpManageProjectsModal extends obsidian.Modal {
  constructor(plugin,onChanged){super(plugin.app);this.plugin=plugin;this.onChanged=onChanged;this.chosen=new Set();this.busy=false;}
  onOpen(){this.modalEl?.classList?.add('lrp-manage-projects-modal');this.draw();}
  async run(action){
    if(this.busy)return;this.busy=true;this.contentEl.setAttribute('aria-busy','true');
    const state=captureLrpViewState(this.contentEl),scrollTop=this.contentEl.scrollTop;
    try{await action();this.draw();restoreLrpViewState(this.contentEl,state);this.contentEl.scrollTop=scrollTop;await this.onChanged?.();}
    catch(error){const feedback=this.contentEl.querySelector?.('.lrp-management-error');if(feedback){feedback.hidden=false;feedback.textContent=error?.message || '保存失败，请重试';}else new obsidian.Notice(error?.message || '保存失败，请重试');}
    finally{this.busy=false;this.contentEl.setAttribute('aria-busy','false');}
  }
  groupSelect(parent,value){
    const select=parent.createEl('select',{attr:{'aria-label':'项目分组'}});
    for(const group of getLrpProjectGroups(this.plugin.settings))select.createEl('option',{text:group.name,value:group.id});
    select.value=value || LRP_UNGROUPED_PROJECTS;return select;
  }
  draw(){
    const body=this.contentEl;body.empty();body.createEl('h2',{text:'管理项目'});
    const feedback=body.createDiv({cls:'lrp-management-error',attr:{role:'alert','aria-live':'polite'}});feedback.hidden=true;
    const groups=body.createDiv('lrp-management-section');groups.createEl('h3',{text:'项目分组'});
    const form=groups.createEl('form',{cls:'lrp-management-form'});
    const name=form.createEl('input',{attr:{type:'text',placeholder:'新分组名称','aria-label':'新分组名称',required:'true'}});
    form.createEl('button',{text:'新建分组',attr:{type:'submit'}});
    form.onsubmit=event=>{event.preventDefault();void this.run(()=>saveLrpProjectGroup(this.plugin,settings=>{
      const title=name.value.trim();if(!title)throw new Error('请输入分组名称。');
      if(settings.projectGroups.some(group=>group.name===title))throw new Error('已有同名分组。');
      settings.projectGroups.push({id:crypto.randomUUID(),name:title});
    }));};
    const create=body.createDiv('lrp-management-section');create.createEl('h3',{text:'新建项目'});
    const projectForm=create.createEl('form',{cls:'lrp-management-form'});
    const projectName=projectForm.createEl('input',{attr:{type:'text',placeholder:'项目名称','aria-label':'新项目名称',required:'true'}});
    const projectGroup=this.groupSelect(projectForm);
    projectForm.createEl('button',{text:'新建项目',attr:{type:'submit'}});
    projectForm.onsubmit=event=>{event.preventDefault();void this.run(async()=>{
      const active=this.plugin.settings.activeProjectId,all=this.plugin.settings.showAllProjects;
      await createLrpProject(this.plugin,projectName.value,projectGroup.value===LRP_UNGROUPED_PROJECTS?null:projectGroup.value,{activeProjectId:active,showAllProjects:all});
    });};
    const projects=body.createDiv('lrp-management-section');
    const heading=projects.createDiv('lrp-management-heading');heading.createEl('h3',{text:'项目归属'});
    const remove=heading.createEl('button',{text:`删除所选（${this.chosen.size}）`,cls:'mod-warning',attr:{type:'button'}});
    remove.disabled=!this.chosen.size;
    remove.onclick=()=>{
      if(this.busy)return;
      const selected=(this.plugin.settings.projects || []).filter(project=>this.chosen.has(project.id));
      if(!selected.length)return;
      if(selected.length>=(this.plugin.settings.projects || []).length){new obsidian.Notice('至少保留一个项目。');return;}
      new LrpDeleteProjectsModal(this.plugin,selected,async()=>{
        if(this.busy)throw new Error('请等待当前操作完成。');
        this.busy=true;
        try{const result=await deleteLrpProjects(this.plugin,selected.map(project=>project.id));this.chosen.clear();this.draw();await this.onChanged?.();
          new obsidian.Notice(result.failures.length?'项目已移除，部分目录未能删除，文件已保留。':`已删除 ${result.removed.length} 个项目`);
        }finally{this.busy=false;}
      }).open();
    };
    const batch=projects.createDiv('lrp-management-form');const target=this.groupSelect(batch);
    batch.createEl('button',{text:'移动所选项目',attr:{type:'button'}}).onclick=()=>void this.run(()=>saveLrpProjectGroup(this.plugin,settings=>{
      for(const project of settings.projects)if(this.chosen.has(project.id))project.groupId=target.value===LRP_UNGROUPED_PROJECTS?null:target.value;
    }));
    for(const group of getLrpProjectGroups(this.plugin.settings)){
      const section=projects.createEl('details',{cls:'lrp-management-project-group',attr:{'data-lrp-group-id':group.id}});section.open=true;
      const members=sortLrpGroupedProjects(this.plugin,(this.plugin.settings.projects || []).filter(project=>getLrpProjectGroupId(this.plugin.settings,project)===group.id));
      const title=section.createEl('summary',{cls:'lrp-management-group-heading'});
      title.createSpan({text:`${group.name}（${members.length}）`,cls:'lrp-management-group-name'});
      if(group.id!==LRP_UNGROUPED_PROJECTS){
        const actions=title.createSpan({cls:'lrp-management-group-actions'});
        const rename=actions.createEl('button',{text:'改名',attr:{type:'button','aria-label':`改名分组 ${group.name}`}});
        const removeGroup=actions.createEl('button',{text:'移除分组',attr:{type:'button',title:'项目保留并移至未分组','aria-label':`移除分组 ${group.name}`}});
        const edit=section.createEl('form',{cls:'lrp-management-form lrp-management-group-rename'});edit.hidden=true;
        const input=edit.createEl('input',{attr:{type:'text','aria-label':`分组名称 ${group.name}`,required:'true'}});input.value=group.name;
        edit.createEl('button',{text:'保存',attr:{type:'submit'}});
        const cancel=edit.createEl('button',{text:'取消',attr:{type:'button'}});
        rename.onclick=event=>{event.preventDefault();event.stopPropagation();section.open=true;edit.hidden=!edit.hidden;if(!edit.hidden)input.focus?.();};
        cancel.onclick=()=>{edit.hidden=true;input.value=group.name;rename.focus?.();};
        edit.onsubmit=event=>{event.preventDefault();void this.run(()=>saveLrpProjectGroup(this.plugin,settings=>{
          const name=input.value.trim();if(!name)throw new Error('请输入分组名称。');
          if(settings.projectGroups.some(item=>item.id!==group.id && item.name===name))throw new Error('已有同名分组。');
          settings.projectGroups.find(item=>item.id===group.id).name=name;
        }));};
        removeGroup.onclick=event=>{event.preventDefault();event.stopPropagation();void this.run(()=>saveLrpProjectGroup(this.plugin,settings=>{
          settings.projectGroups=settings.projectGroups.filter(item=>item.id!==group.id);
          for(const project of settings.projects)if(project.groupId===group.id)delete project.groupId;
        }));};
      }
      for(const project of members){
        const row=section.createDiv('lrp-management-project-row');
        const label=row.createEl('label');const box=label.createEl('input',{attr:{type:'checkbox','aria-label':`选择项目 ${project.name}`}});
        box.checked=this.chosen.has(project.id);label.createSpan({text:project.name});
        box.onchange=()=>{if(box.checked)this.chosen.add(project.id);else this.chosen.delete(project.id);remove.textContent=`删除所选（${this.chosen.size}）`;remove.disabled=!this.chosen.size;};
        const select=this.groupSelect(row,group.id);
        select.onchange=()=>void this.run(()=>saveLrpProjectGroup(this.plugin,settings=>{settings.projects.find(item=>item.id===project.id).groupId=select.value===LRP_UNGROUPED_PROJECTS?null:select.value;}));
      }
    }
  }
  onClose(){this.contentEl.empty();}
}
