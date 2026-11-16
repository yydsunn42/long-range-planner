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
    const datedChildren=tasks.some(child=>child.parentId===task.id && (child.dueDate || child.startDate));
    const embedded=(task.subtasks || []).filter(sub=>sub.dueDate || sub.startDate);
    if(!datedChildren && !embedded.length)result.push({...task,_lrpRealDueDate:task.dueDate || null,dueDate:task.dueDate || task.startDate});
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
  const margin=12,gap=14;
  const maxWidth=Math.max(80,viewportWidth-margin*2);
  width=Math.min(width,maxWidth);
  const candidates=[
    {left:anchor.right+gap,top:anchor.top,space:viewportWidth-anchor.right-gap-margin,widthSide:true},
    {left:anchor.left-gap-width,top:anchor.top,space:anchor.left-gap-margin,widthSide:true},
    {left:anchor.left,top:anchor.bottom+gap,space:viewportHeight-anchor.bottom-gap-margin},
    {left:anchor.left,top:margin,space:anchor.top-gap-margin}
  ];
  const side=candidates.filter(c=>c.widthSide && c.space>=width).sort((a,b)=>b.space-a.space)[0];
  const choice=side || candidates.filter(c=>!c.widthSide).sort((a,b)=>b.space-a.space)[0];
  const maxHeight=side ? viewportHeight-margin*2 : Math.max(60,choice.space);
  height=Math.min(height,maxHeight);
  if(!side && choice===candidates[3])choice.top=anchor.top-gap-height;
  return {left:Math.max(margin,Math.min(choice.left,viewportWidth-width-margin)),top:Math.max(margin,Math.min(choice.top,viewportHeight-height-margin)),width,maxHeight};
}
function openLrpTaskPreview(plugin,reference,anchorElement) {
  plugin.lrpClosePreview?.();
  const doc=plugin.app.workspace.containerEl?.ownerDocument || document;
  const win=doc.defaultView || window;
  const panel=doc.body.createDiv('lrp-task-preview');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','任务信息');
  const anchor=anchorElement?.getBoundingClientRect?.() || plugin.lrpPreviewAnchor || {left:win.innerWidth/2,right:win.innerWidth/2,top:80,bottom:80};
  let dirty=false,unsubscribe;
  const close=()=>{unsubscribe?.();panel.remove();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);win.removeEventListener('resize',position);if(plugin.lrpClosePreview===close)plugin.lrpClosePreview=null;};
  const outside=event=>{if(!panel.contains(event.target))close();};
  const escape=event=>{if(event.key==='Escape')close();};
  const position=()=>{
    const placement=getLrpPreviewPosition(anchor,380,panel.scrollHeight,win.innerWidth,win.innerHeight);
    Object.assign(panel.style,{left:`${placement.left}px`,top:`${placement.top}px`,width:`${placement.width}px`,maxHeight:`${placement.maxHeight}px`});
  };
  const render=()=>{
    if(dirty)return;
    const target=getLrpTaskTarget(plugin,reference);
    panel.empty();
    if(!target){panel.createDiv({text:'任务已不存在'});return;}
    const {project,tasks,owner,task,embedded}=target;
    const header=panel.createDiv('lrp-preview-header');
    header.createSpan({text:project.name,cls:'lrp-preview-project'});
    header.createEl('button',{text:'×',attr:{'aria-label':'关闭'}}).onclick=close;
    panel.createEl('h3',{text:task.title});
    const chips=panel.createDiv('lrp-preview-chips');
    const chip=text=>chips.createSpan({text,cls:'lrp-preview-chip'});
    renderLrpTaskStatus(chips,plugin,embedded && owner.planningDisposition==='abandoned'?{...task,planningDisposition:'abandoned'}:task,tasks);
    chip(`优先级：${lrpText(task.priority || 'Medium')}`);
    chip(project.buckets?.find(bucket=>bucket.id===(task.bucketId || owner.bucketId))?.name || '未分组');
    for(const id of task.tags || []){
      const tag=plugin.settings.availableTags?.find(tag=>tag.id===id);
      if(tag){const label=chip(tag.name);label.style.backgroundColor=tag.color;label.style.color='#000';}
    }
    const pct=embedded ? task.completed?100:0 : calculateLrpProgress(task,tasks);
    renderLrpProgressBar(panel,pct);
    const dates=panel.createDiv('lrp-preview-dates');
    dates.textContent=`${task.startDate || '未设开始时间'} → ${task.dueDate || '未设截止时间'} · ${formatLrpWeek(task.dueDate || '')}`;
    const parent=embedded ? owner : tasks.find(item=>item.id===task.parentId);
    if(parent)panel.createDiv({text:`所属任务：${parent.title}`,cls:'lrp-preview-relation'});
    const children=embedded ? [] : [...tasks.filter(child=>child.parentId===task.id),...(task.subtasks || [])];
    if(children.length){
      panel.createEl('h4',{text:'子任务'});
      for(const child of children)panel.createDiv({text:`${child.completed?'✓':'○'} ${child.title} · ${child.dueDate || child.startDate || '未安排时间'} · ${lrpText(child.priority || 'Medium')}`,cls:'lrp-preview-child'});
    }
    panel.createEl('h4',{text:'说明'});
    const description=panel.createEl('textarea',{attr:{'aria-label':'任务说明',placeholder:'添加说明…'}});description.value=task.description || '';
    description.oninput=()=>{dirty=true;};
    const feedback=panel.createDiv('lrp-preview-feedback');
    const save=panel.createEl('button',{text:'保存说明'});
    save.onclick=async()=>{
      save.disabled=true;
      try{await updateLrpCalendarTask(plugin.taskStore,reference,{description:description.value});dirty=false;render();}
      catch(error){feedback.textContent='保存失败，请重试';console.error(error);save.disabled=false;}
    };
    position();
  };
  plugin.lrpClosePreview=close;
  render();unsubscribe=plugin.taskStore.subscribe(render);
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);win.addEventListener('resize',position);
}
