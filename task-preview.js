// Resolve predecessor IDs only within the current project's task collection.
function renderLrpPredecessorLinks(container,plugin,task,tasks) {
  for(const dependency of task.dependencies || []){
    const predecessor=tasks.find(item=>item.id===dependency.predecessorId);
    if(!predecessor){
      container.createSpan({text:'前置任务已不存在',cls:'lrp-missing-predecessor'});
      continue;
    }
    const link=container.createEl('button',{
      text:predecessor.title,cls:'lrp-predecessor-link',
      attr:{type:'button',title:`前置任务：${predecessor.title}（${dependency.type || 'FS'}）`}
    });
    link.onclick=event=>{event.stopPropagation();plugin.openTaskDetail(predecessor);};
  }
}
function getLrpCalendarTasks(tasks) {
  const result=[];
  for(const task of tasks){
    const hasChildren=tasks.some(child=>child.parentId===task.id);
    const embedded=(task.subtasks || []).filter(sub=>sub.dueDate || sub.startDate);
    if(!hasChildren && !(task.subtasks || []).length && (task.dueDate || task.startDate))result.push({...task,_lrpRealDueDate:task.dueDate || null,dueDate:task.dueDate || task.startDate});
    for(const sub of embedded)result.push({...sub,_lrpRealDueDate:sub.dueDate || null,planningDisposition:task.planningDisposition==='abandoned'?'abandoned':sub.planningDisposition,id:`${task.id}::${sub.id}`,dueDate:sub.dueDate || sub.startDate,status:sub.completed?'Completed':'Not Started',priority:sub.priority || 'Medium',tags:sub.tags || [],_lrpOwnerId:task.id,_lrpSubId:sub.id});
  }
  return result.sort((a,b)=>Number(Boolean(b._lrpSubId || b.parentId))-Number(Boolean(a._lrpSubId || a.parentId)));
}
function getLrpTaskTarget(plugin,task) {
  for(const project of plugin.settings.projects || []){
    const tasks=plugin.taskStore.getAllForProject(project.id) || [];
    const owner=tasks.find(item=>item.id===(task._lrpOwnerId || task.id));
    if(!owner)continue;
    const actual=task._lrpSubId ? owner.subtasks?.find(sub=>sub.id===task._lrpSubId) : owner;
    if(actual)return {project,tasks,owner,task:actual,embedded:Boolean(task._lrpSubId)};
  }
  return null;
}
async function updateLrpCalendarTask(store,task,partial) {
  const target=getLrpTaskTarget(store.plugin,task);
  if(!target)throw new Error('任务已不存在');
  const scope=createLrpProjectScope(store.plugin,target.project.id);
  if(target.embedded){
    const {status,...fields}=partial;
    await scope.taskStore.updateTask(target.owner.id,{subtasks:(target.owner.subtasks || []).map(sub=>sub.id===target.task.id ? {...sub,...fields} : sub)});
  }else await scope.taskStore.updateTask(target.task.id,partial);
  store.refresh();
}
function getLrpPreviewPosition(anchor,width,height,viewportWidth,viewportHeight) {
  const margin=12,gap=14,bottom=Math.min(48,Math.max(12,viewportHeight/5));
  width=Math.min(width,Math.max(1,viewportWidth-margin*2));
  const available=Math.max(1,viewportHeight-margin-bottom);
  const candidates=[
    {left:anchor.right+gap,top:anchor.top,space:viewportWidth-anchor.right-gap-margin,side:true},
    {left:anchor.left-gap-width,top:anchor.top,space:anchor.left-gap-margin,side:true},
    {left:anchor.left,top:anchor.bottom+gap,space:Math.max(0,viewportHeight-bottom-anchor.bottom-gap)},
    {left:anchor.left,top:margin,space:Math.max(0,anchor.top-gap-margin),above:true}
  ];
  const side=candidates.filter(item=>item.side && item.space>=width).sort((a,b)=>b.space-a.space)[0];
  const choice=side || candidates.filter(item=>!item.side).sort((a,b)=>b.space-a.space)[0];
  const maxHeight=Math.min(available,side?available:Math.max(1,choice.space));
  const shown=Math.min(Math.max(1,height),maxHeight);
  const top=choice.above?anchor.top-gap-shown:choice.top;
  return {left:Math.max(margin,Math.min(choice.left,viewportWidth-width-margin)),top:Math.max(margin,Math.min(top,viewportHeight-bottom-shown)),width,maxHeight};
}
function getLrpPreviewTaskContext(target) {
  const {tasks,owner,task,embedded}=target;
  const parent=embedded ? owner : tasks.find(item=>item.id===task.parentId);
  const large=parent || task;
  const children=[
    ...tasks.filter(child=>child.parentId===large.id).map(child=>({task:child,embedded:false,current:!embedded && child.id===task.id})),
    ...(large.subtasks || []).map(child=>({task:child,embedded:true,current:embedded && owner.id===large.id && child.id===task.id}))
  ];
  return {large,children,progress:calculateLrpProgress(large,tasks)};
}
function renderLrpPreviewTaskContext(panel,plugin,target) {
  const context=getLrpPreviewTaskContext(target);
  panel.createDiv({text:`所属任务：${context.large.title}`,cls:'lrp-preview-relation'});
  if(context.children.length){
    const list=panel.createEl('ul',{cls:'lrp-preview-context-list',attr:{'aria-label':'所属任务的子任务'}});
    for(const entry of context.children){
      const completed=isLrpTaskComplete(entry.task,entry.embedded?[]:target.tasks);
      const row=list.createEl('li',{cls:`lrp-preview-context-row${entry.current?' is-current':''}`});
      if(entry.current)row.setAttribute('aria-current','true');
      row.createSpan({cls:'lrp-task-first-line-check'}).createSpan({text:completed?'✓':'□',cls:`lrp-preview-context-state${completed?' is-complete':''}`,attr:{'aria-label':completed?'已完成':'未完成'}});
      row.createSpan({text:entry.task.title,cls:'lrp-preview-context-title'});
    }
  }
  const progress=panel.createDiv('lrp-preview-parent-progress');
  renderLrpProgressBar(progress,context.progress);
}
function renderLrpPreviewDescription(panel,plugin,reference,task,onEditing,onDone,onLayout) {
  const heading=panel.createDiv('lrp-preview-description-heading');
  heading.createEl('h4',{text:'说明'});
  const edit=heading.createEl('button',{text:'编辑',attr:{type:'button'}});
  const body=panel.createDiv({text:task.description || '无',cls:'lrp-preview-description-body'});
  const form=panel.createEl('form',{cls:'lrp-preview-description-form'});form.hidden=true;
  const input=form.createEl('textarea',{attr:{rows:'5','aria-label':'任务说明',placeholder:'添加说明…'}});input.value=task.description || '';
  const feedback=form.createDiv({cls:'lrp-preview-feedback',attr:{role:'alert'}});
  const actions=form.createDiv('lrp-preview-description-actions');
  const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}});
  const save=actions.createEl('button',{text:'保存',attr:{type:'submit'}});
  edit.onclick=()=>{onEditing(true);body.hidden=true;edit.hidden=true;form.hidden=false;onLayout();input.focus?.({preventScroll:true});};
  cancel.onclick=()=>{if(save.disabled)return;onEditing(false);onDone();};
  form.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel.onclick();}};
  form.onsubmit=async event=>{
    event.preventDefault();if(save.disabled)return;save.disabled=true;cancel.disabled=true;feedback.textContent='';
    try{await updateLrpCalendarTask(plugin.taskStore,reference,{description:input.value});onEditing(false);onDone();}
    catch(problem){feedback.textContent='保存失败，请重试';save.disabled=false;cancel.disabled=false;console.error(problem);}
  };
}
function openLrpTaskPreview(plugin,reference,anchorElement) {
  plugin.lrpClosePreview?.();
  const doc=plugin.app.workspace.containerEl?.ownerDocument || document;
  const win=doc.defaultView || window;
  const panel=doc.body.createDiv('lrp-task-preview');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','任务信息');
  const anchor=anchorElement?.getBoundingClientRect?.() || plugin.lrpPreviewAnchor || {left:win.innerWidth/2,right:win.innerWidth/2,top:80,bottom:80};
  let editingDescription=false,unsubscribe;
  const close=()=>{unsubscribe?.();panel.remove();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);win.removeEventListener('resize',position);if(plugin.lrpClosePreview===close)plugin.lrpClosePreview=null;};
  const outside=event=>{if(!editingDescription && !panel.contains(event.target))close();};
  const escape=event=>{if(event.key==='Escape' && !editingDescription)close();};
  const position=()=>{
    // Measure after applying the final width: wrapping changes the popup's height.
    const width=Math.min(380,Math.max(1,win.innerWidth-24));panel.style.width=`${width}px`;
    const placement=getLrpPreviewPosition(anchor,width,panel.scrollHeight+2,win.innerWidth,win.innerHeight);
    Object.assign(panel.style,{left:`${placement.left}px`,top:`${placement.top}px`,maxHeight:`${placement.maxHeight}px`});
  };
  const render=()=>{
    if(editingDescription)return;
    const target=getLrpTaskTarget(plugin,reference);
    panel.empty();
    if(!target){panel.createDiv({text:'任务已不存在'});return;}
    const {project,tasks,owner,task,embedded}=target;
    panel.style.setProperty('--lrp-project-color',project.calendarColor || '#9874b5');
    const header=panel.createDiv('lrp-preview-header');
    header.createSpan({text:project.name,cls:'lrp-preview-project'});
    header.createEl('button',{text:'×',attr:{'aria-label':'关闭'}}).onclick=close;
    panel.createEl('h3',{text:task.title});
    const chips=panel.createDiv('lrp-preview-chips');
    const chip=text=>chips.createSpan({text,cls:'lrp-preview-chip'});
    renderLrpTaskStatus(chips,plugin,embedded && owner.planningDisposition==='abandoned'?{...task,planningDisposition:'abandoned'}:task,tasks);
    chip(`优先级：${lrpText(task.priority || 'Medium')}`);
    chip(project.buckets?.find(bucket=>bucket.id===(task.bucketId || owner.bucketId))?.name || '未分组');
    for(const id of getLrpTaskTagIds(plugin.settings,task,project.id)){
      const tag=plugin.settings.availableTags?.find(tag=>tag.id===id);
      if(tag){const label=chip(tag.name);label.style.backgroundColor=tag.color;label.style.color='#000';}
    }
    const dates=panel.createDiv('lrp-preview-dates');
    dates.textContent=`${task.startDate || '未设开始时间'} → ${task.dueDate || '未设截止时间'} · ${formatLrpWeek(task.dueDate || '')}`;
    renderLrpPreviewTaskContext(panel,plugin,target);
    renderLrpPreviewDescription(panel,plugin,reference,task,value=>{editingDescription=value;},render,position);
    position();
  };
  plugin.lrpClosePreview=close;
  render();unsubscribe=plugin.taskStore.subscribe(render);
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);win.addEventListener('resize',position);
}

function bindLrpBoardSubtaskPreview(label,plugin,owner,subtask) {
  label.setAttribute('role','button');label.setAttribute('tabindex','0');
  label.setAttribute('aria-label',`查看子任务 ${subtask.title}`);
  const open=event=>{
    event.preventDefault();event.stopPropagation();
    return plugin.openTaskDetail({...subtask,id:`${owner.id}::${subtask.id}`,_lrpOwnerId:owner.id,_lrpSubId:subtask.id},{anchor:label});
  };
  label.onclick=open;
  label.onkeydown=event=>{if(event.key==='Enter' || event.key===' ')return open(event);};
}
