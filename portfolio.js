// ISO weeks begin on Monday; week 1 contains January 4. Use UTC date-only arithmetic.
function getLrpWeekInfo(value) {
  const raw = typeof value?.getTime === 'function' && Number.isFinite(value.getTime()) ? toDateStr(value) : String(value || '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw+'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==raw) return null;
  date.setUTCDate(date.getUTCDate()+3-(date.getUTCDay()+6)%7);
  const year=date.getUTCFullYear();
  const week=1+Math.round((date.getTime()-Date.UTC(year,0,4)+((new Date(Date.UTC(year,0,4)).getUTCDay()+6)%7-3)*86400000)/(7*86400000));
  return {year,week};
}
function updateLrpWeekLabels(labels, now = new Date()) {
  for(const label of labels){
    if(!label.isConnected){labels.delete(label);continue;}
    label.textContent=formatLrpWeek(now);
  }
}
function refreshLrpDateStatus(plugin,now=new Date()) {
  const today=toDateStr(now),previous=plugin.lrpStatusDate;plugin.lrpStatusDate=today;
  if(previous && previous!==today)plugin.taskStore?.refresh?.();
}
function registerLrpWeekLabel(plugin,label) {
  if(!plugin.lrpWeekLabels){
    plugin.lrpWeekLabels=new Set();
    plugin.lrpStatusDate=toDateStr(new Date());
    const update=()=>{const now=new Date();updateLrpWeekLabels(plugin.lrpWeekLabels,now);refreshLrpDateStatus(plugin,now);};
    if(typeof plugin.registerInterval==='function')plugin.registerInterval(window.setInterval(update,60000));
    plugin.registerDomEvent(window,'focus',update);
    plugin.registerDomEvent(label.ownerDocument,'visibilitychange',update);
  }
  plugin.lrpWeekLabels.add(label);
}
function formatLrpWeek(value) {
  const info=getLrpWeekInfo(value);
  return info ? `${info.year}年第${info.week}周` : '—';
}
function getLrpTaskSchedule(task, project) {
  const bucket=project?.buckets?.find(bucket=>bucket.id===task.bucketId);
  const start=getLrpWeekInfo(task.startDate) ? task.startDate.slice(0,10) : null;
  const end=getLrpWeekInfo(task.dueDate) ? task.dueDate.slice(0,10) : null;
  const days=start && end ? Math.round((Date.parse(end)-Date.parse(start))/86400000)+1 : null;
  return {start,end,week:formatLrpWeek(end || ''),bucket:bucket?.name || '未分组',
    duration:days && days>0 ? (days%7===0 ? `${days/7}周` : `${days}天`) : '—'};
}
function compareLrpScheduledTasks(a,b) {
  const key=task=>getLrpWeekInfo(task.dueDate) ? task.dueDate.slice(0,10) : '9999-12-31';
  return key(a).localeCompare(key(b)) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
}
function getLrpWeekDates(value) {
  const match=/^(\d{4})-W(\d{2})$/.exec(value || '');
  if(!match)return null;
  const year=Number(match[1]),week=Number(match[2]);
  if(year<1000 || week<1 || week>53)return null;
  const jan4=new Date(Date.UTC(year,0,4));
  const monday=new Date(jan4.getTime()+((week-1)*7-(jan4.getUTCDay()+6)%7)*86400000);
  const check=getLrpWeekInfo(monday.toISOString());
  if(check.year!==year || check.week!==week)return null;
  return {start:monday.toISOString().slice(0,10),end:new Date(monday.getTime()+6*86400000).toISOString().slice(0,10)};
}
function getLrpCompletionWeekUpdate(task,value) {
  const dates=getLrpWeekDates(value);
  if(!dates)return null;
  const schedule=getLrpTaskSchedule(task);
  const duration=schedule.start && schedule.end ? Math.round((Date.parse(schedule.end)-Date.parse(schedule.start))/86400000)+1 : 7;
  const days=Math.max(1,duration);
  return {startDate:new Date(Date.parse(dates.end)-(days-1)*86400000).toISOString().slice(0,10),dueDate:dates.end};
}
function renderLrpCompletionWeek(container,task,onChange) {
  const button=container.createEl('button',{text:getLrpTaskSchedule(task).week,cls:'lrp-week-edit',attr:{title:'点击调整完成周'}});
  button.onclick=()=>{
    const input=container.createEl('input',{attr:{type:'week','aria-label':'完成周'}});
    const info=getLrpWeekInfo(task.dueDate || task.startDate);
    if(info)input.value=`${info.year}-W${String(info.week).padStart(2,'0')}`;
    button.hidden=true;input.focus();
    input.onchange=async()=>{
      const partial=getLrpCompletionWeekUpdate(task,input.value);
      if(!partial)return;
      input.disabled=true;
      try{await onChange(partial);}catch(error){new obsidian.Notice('完成周保存失败，请重试');console.error(error);}
      finally{input.remove();button.hidden=false;}
    };
    input.onblur=()=>{if(!input.disabled){input.remove();button.hidden=false;}};
    input.onkeydown=event=>{if(event.key==='Escape')input.blur();};
  };
}
function renderLrpProgressBar(container,pct) {
  const wrap=container.createDiv('lrp-inline-progress');
  wrap.createEl('progress',{attr:{max:'100',value:String(pct),'aria-label':`完成 ${pct}%`}});
  wrap.createSpan({text:`${pct}%`,cls:'lrp-inline-progress-value'});
}
function getLrpSubtaskSummary(task, tasks) {
  const children=tasks.filter(child=>child.parentId===task.id);
  const items=children.length ? children : task.subtasks || [];
  const completed=children.length ? children.filter(child=>isLrpTaskComplete(child,tasks)).length : items.filter(item=>item.completed).length;
  const automatic=items.length ? calculateLrpProgress({...task,progressMode:'auto'},tasks) : (task.progressMode!=='manual' && (task.completed || task.status==='Completed') ? 100 : 0);
  return {completed,total:items.length,automatic};
}
function getLrpPortfolio(plugin) {
  return (plugin.settings.projects || []).map(project=>{
    const tasks=plugin.taskStore.getAllForProject(project.id) || [];
    const progress=getLrpProjectState(plugin,tasks).progress;
    const dates=tasks.flatMap(task=>[task.startDate?.slice(0,10),task.dueDate?.slice(0,10)]).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(Date.parse(date)));
    dates.sort();
    return {project,tasks,progress,start:dates[0] || null,end:dates.at(-1) || null};
  });
}
async function renderLrpPortfolio(view, active) {
  const generation=(view.lrpAllGeneration || 0)+1;view.lrpAllGeneration=generation;
  await clearLrpEmbeddedViews(view);
  if(generation!==view.lrpAllGeneration)return;
  const container=view.containerEl;container.empty();
  const wrapper=container.createDiv('lrp-portfolio-wrapper');
  renderPlannerHeader(wrapper,view.plugin,{active,hideAddTask:true,onProjectChange:()=>view.render()});
  const content=wrapper.createDiv('lrp-portfolio-content');
  const portfolio=getLrpPortfolio(view.plugin);
  if(active==='grid')renderLrpPortfolioTable(content,view,portfolio);
  else renderLrpPortfolioTimeline(content,view,portfolio);
}
function getLrpPortfolioRules(settings) {
  const saved=settings?.portfolioRules || {};
  return {overdueDays:Math.max(0,Math.min(365,Number.isFinite(Number(saved.overdueDays)) ? Number(saved.overdueDays) : 7)),
    previousWeeks:Math.max(1,Math.min(12,Number(saved.previousWeeks) || 1))};
}
function getLrpTaskCategory(task,tasks,rules,now=new Date()) {
  if(!task)return {key:'empty',recent:true,current:false};
  const today=Date.parse(toDateStr(now));
  const monday=today-((new Date(today).getUTCDay()+6)%7)*86400000;
  const due=getLrpTaskSchedule(task).end;
  const end=due ? Date.parse(due) : null;
  const abandoned=task.planningDisposition==='abandoned';
  const done=!abandoned && isLrpTaskComplete(task,tasks);
  const current=end!==null && end>=monday && end<monday+7*86400000;
  const previous=end!==null && end>=monday-7*86400000 && end<monday;
  const future=end!==null && end>=monday+7*86400000;
  const overdue=!done && !abandoned && end!==null && today-end>rules.overdueDays*86400000;
  const pending=!done && !abandoned && end!==null && end<today && !overdue;
  const recent=!abandoned && (end===null || end>=monday-rules.previousWeeks*7*86400000 || !done);
  const key=abandoned?'abandoned':done?'completed':overdue?'overdue':pending?'pending':current?'current':future?'future':end===null?'unscheduled':'previous';
  return {key,recent,current,previous,future,done,abandoned,overdue,pending,unscheduled:end===null};
}
// Completion is structural; a rounded percentage never proves completion.
function isLrpTaskComplete(task,tasks=[],visiting=new Set()) {
  if(!task || task.planningDisposition==='abandoned' || visiting.has(task.id))return false;
  const next=new Set(visiting);next.add(task.id);
  if(task.progressMode==='manual')return Number(task.manualRemaining ?? 100)<=0;
  const children=task.id ? tasks.filter(child=>child.parentId===task.id) : [];
  if(children.length)return children.every(child=>isLrpTaskComplete(child,tasks,next));
  if(task.subtasks?.length)return task.subtasks.every(sub=>Boolean(sub.completed));
  return Boolean(task.completed || task.status==='Completed' || Number(task.percentComplete)>=100);
}
function getLrpTaskState(plugin,reference,tasks,now=new Date()) {
  let task=reference;
  if(!tasks){
    const target=plugin.taskStore?.getAllForProject ? getLrpTaskTarget(plugin,reference) : null;
    tasks=target?.tasks || [reference];
  }
  // Calendar placement can fall back to the start date; overdue must use the real deadline.
  if(Object.prototype.hasOwnProperty.call(task,'_lrpRealDueDate'))task={...task,dueDate:task._lrpRealDueDate};
  const category=getLrpTaskCategory(task,tasks,getLrpPortfolioRules(plugin.settings),now);
  const progress=calculateLrpProgress(task,tasks);
  const schedule=getLrpTaskSchedule(task),today=toDateStr(now);
  const inScheduledRange=Boolean(schedule.start && schedule.end && schedule.start<=today && today<=schedule.end);
  const execution=inScheduledRange?'In Progress':task.status==='Blocked'?'Blocked':task.status==='In Progress' || progress>0?'In Progress':task.status && task.status!=='Completed'?task.status:'Not Started';
  const status=category.abandoned?'Abandoned':category.done?'Completed':category.overdue?'Overdue':execution;
  const labels={Abandoned:'已放弃',Completed:'已完成',Overdue:'逾期'};
  return {...category,status,execution,progress,inScheduledRange,label:labels[status] || lrpText(status),actionable:!category.abandoned && !category.done};
}
function getLrpTaskDisplayStatus(plugin,task,tasks,now=new Date()) {
  return task ? getLrpTaskState(plugin,task,tasks,now).label : '—';
}
function matchesLrpTaskStatus(plugin,task,tasks,status,now=new Date()) {
  return status==='All' || status==='all' || getLrpTaskState(plugin,task,tasks,now).status===status;
}
function getLrpProjectState(plugin,tasks,now=new Date()) {
  const states=tasks.map(task=>getLrpTaskState(plugin,task,tasks,now));
  const done=states.length>0 && states.every(state=>state.done);
  const abandoned=states.length>0 && states.every(state=>state.abandoned);
  const started=states.some(state=>state.done || state.actionable && (state.progress>0 || state.execution==='In Progress' || state.execution==='Blocked'));
  const status=abandoned?'abandoned':done?'completed':started?'inProgress':'notStarted';
  const roots=tasks.filter(task=>!task.parentId || !tasks.some(parent=>parent.id===task.parentId));
  const average=roots.length ? roots.reduce((sum,task)=>sum+calculateLrpProgress(task,tasks),0)/roots.length : 0;
  const progress=done?100:Math.min(99,Math.round(average));
  return {status,done,abandoned,unfinished:!done && !abandoned,notStarted:status==='notStarted',inProgress:status==='inProgress',
    overdue:states.some(state=>state.overdue),blocked:states.some(state=>state.actionable && state.execution==='Blocked'),progress};
}
function matchesLrpProjectStatus(plugin,tasks,filter,now=new Date()) {
  if(!filter || filter==='all')return true;
  const key={'in-progress':'inProgress','not-started':'notStarted',completed:'done'}[filter] || filter;
  return Boolean(getLrpProjectState(plugin,tasks,now)[key]);
}
function renderLrpTaskStatus(container,plugin,task,tasks) {
  const text=getLrpTaskDisplayStatus(plugin,task,tasks);
  const pill=container.createSpan({text,cls:'status-pill lrp-task-status'});
  const colors={'逾期':'#d9485f','已放弃':'#6c757d','已完成':'#2f9e44'};
  pill.style.backgroundColor=colors[text] || plugin.settings?.availableStatuses?.find(s=>lrpText(s.name)===text)?.color || '#6c757d';
  pill.style.color='#fff';
  return pill;
}
function matchesLrpTaskCategory(category,filter) {
  if(filter==='all')return true;
  if(filter==='recent')return category.recent;
  if(filter==='completed')return category.done && !category.abandoned;
  return Boolean(category[filter]);
}
async function saveLrpPlanningDecision(plugin,projectId,taskId,action,week,now=new Date()) {
  const task=plugin.taskStore.getAllForProject(projectId).find(item=>item.id===taskId);
  if(!task)throw new Error('任务已不存在');
  const history=[...(task.planningHistory || []),{action,at:now.toISOString(),startDate:task.startDate || null,dueDate:task.dueDate || null,disposition:task.planningDisposition || 'active'}];
  let partial={planningHistory:history};
  if(action==='abandon')partial.planningDisposition='abandoned';
  else if(action==='restore')partial.planningDisposition='active';
  else if(action==='replan'){
    const dates=getLrpCompletionWeekUpdate(task,week);
    if(!dates)throw new Error('请选择有效的完成周');
    partial={...partial,...dates,planningDisposition:'active'};
  }else throw new Error('未知的规划操作');
  const scope=createLrpProjectScope(plugin,projectId);
  await scope.taskStore.updateTask(taskId,partial);
  plugin.taskStore.refresh();
}
class LrpReplanModal extends obsidian.Modal {
  constructor(plugin,projectId,task){super(plugin.app);this.plugin=plugin;this.projectId=projectId;this.taskId=task.id;this.task=task;}
  onOpen(){
    this.contentEl.createEl('h3',{text:'重新规划完成周'});
    this.contentEl.createEl('p',{text:this.task.title});
    this.contentEl.createEl('p',{text:'选择新的完成周，保留持续时间和已有进度。原来的安排会保存在规划记录中。'});
    const input=this.contentEl.createEl('input',{attr:{type:'week','aria-label':'新的完成周'}});
    const info=getLrpWeekInfo(new Date());input.value=`${info.year}-W${String(info.week).padStart(2,'0')}`;
    const error=this.contentEl.createDiv('lrp-replan-error');
    const save=this.contentEl.createEl('button',{text:'保存新安排',cls:'mod-cta'});
    save.onclick=async()=>{
      save.disabled=true;
      try{await saveLrpPlanningDecision(this.plugin,this.projectId,this.taskId,'replan',input.value);this.close();}
      catch(cause){error.textContent=cause.message;save.disabled=false;}
    };
  }
  onClose(){this.contentEl.empty();}
}
function renderLrpPortfolioTable(container,view,portfolio) {
  container.addClass?.('lrp-portfolio-grid-content');
  const toolbar=container.createDiv('lrp-portfolio-toolbar');
  const heading=toolbar.createDiv('lrp-portfolio-heading-controls');
  heading.createEl('h3',{text:'全部项目 · 进度汇总'});
  const search=toolbar.createEl('input',{cls:'lrp-portfolio-search',attr:{type:'search',placeholder:'搜索项目或任务…','aria-label':'搜索项目或任务'}});
  const filters=heading.createDiv('lrp-portfolio-filters');
  const categoryLabel=filters.createEl('label',{cls:'lrp-category-label'});
  categoryLabel.createSpan({text:'安排分类',cls:'lrp-visually-hidden'});
  const category=categoryLabel.createEl('select');
  for(const [value,text] of [['recent','近期安排'],['all','全部记录'],['previous','上周'],['current','★ 本周'],['future','未来'],['pending','待处理'],['overdue','逾期'],['completed','已完成'],['abandoned','已放弃'],['unscheduled','未安排']])category.createEl('option',{text,value});
  category.value=view.lrpPortfolioCategory || 'recent';
  const config=filters.createEl('details',{cls:'lrp-category-settings'});
  config.createEl('summary',{text:'分类设置'});
  const configFields=config.createDiv('lrp-category-fields');
  const rule=getLrpPortfolioRules(view.plugin.settings);
  const overdueLabel=configFields.createEl('label',{text:'未完成任务超过截止日期多少天后归入逾期：'});
  const overdue=overdueLabel.createEl('select',{attr:{'aria-label':'逾期天数'}});
  for(const days of [...new Set([0,3,7,14,21,30,rule.overdueDays])].sort((a,b)=>a-b))overdue.createEl('option',{text:`${days}天`,value:String(days)});
  overdue.value=String(rule.overdueDays);
  const previousLabel=configFields.createEl('label',{text:'近期安排保留过去几周（更早未完成任务仍保留）：'});
  const previous=previousLabel.createEl('select',{attr:{'aria-label':'保留过去周数'}});
  for(let weeks=1;weeks<=12;weeks++)previous.createEl('option',{text:`${weeks}周`,value:String(weeks)});
  previous.value=String(rule.previousWeeks);
  configFields.createEl('p',{text:'本周按周一至周日计算。待处理表示已经过截止日期、尚未达到逾期门槛。已放弃保留记录，可恢复或重新规划；全部记录始终可查看历史。'});
  const frame=container.createDiv('lrp-portfolio-table-frame');
  const table=frame.createEl('table',{cls:'lrp-portfolio-table'});
  const head=table.createEl('thead').createEl('tr');
  for(const title of ['项目','完成周','任务／阶段','周分组','持续时间','状态','子任务完成','完成进度','处理'])head.createEl('th',{text:title});
  const body=table.createEl('tbody');
  const renderRows=()=>{
    body.empty();const query=search.value?.trim().toLocaleLowerCase() || '';
    const rules=getLrpPortfolioRules(view.plugin.settings);
    const records=portfolio.flatMap(({project,tasks})=>(tasks.length?tasks:[null]).map(task=>({project,tasks,task})));
    records.sort((a,b)=>compareLrpScheduledTasks(a.task || {},b.task || {}));
    let count=0;
    for(const {project,tasks,task} of records){
      const state=getLrpTaskCategory(task,tasks,rules);
      if(!matchesLrpTaskCategory(state,category.value))continue;
      if(query && !`${project.name} ${task?.title || ''}`.toLocaleLowerCase().includes(query))continue;
      count++;
      const row=body.createEl('tr',{cls:state.done?'lrp-completed-row':''});row.style.setProperty('--lrp-project-color',project.calendarColor);
      const projectCell=row.createEl('td',{cls:'lrp-project-row-label'});
      if(state.current)projectCell.createSpan({text:'★',cls:'lrp-current-week-star',attr:{'aria-label':'本周'}});
      projectCell.createSpan({text:project.name});
      const weekCell=row.createEl('td');
      const title=row.createEl('td');
      const schedule=task ? getLrpTaskSchedule(task,project) : null;
      if(task){
        renderLrpCompletionWeek(weekCell,task,partial=>saveLrpPlanningDecision(view.plugin,project.id,task.id,'replan',(()=>{const info=getLrpWeekInfo(partial.dueDate);return `${info.year}-W${String(info.week).padStart(2,'0')}`;})()));
        title.createEl('button',{text:`${isUrgentPriority(task.priority)?'‼️ ':''}${task.title}`,cls:'lrp-task-open'}).onclick=()=>view.plugin.openTaskDetail(task);
      }else {weekCell.textContent='—';title.textContent='暂无任务';}
      row.createEl('td',{text:schedule?.bucket || '—'});
      row.createEl('td',{text:schedule?.duration || '—'});
      const statusCell=row.createEl('td');
      if(task)renderLrpTaskStatus(statusCell,view.plugin,task,tasks);else statusCell.textContent='—';
      const sub=task ? getLrpSubtaskSummary(task,tasks) : null;
      row.createEl('td',{text:sub ? `${sub.completed} / ${sub.total}` : '—'});
      const progress=row.createEl('td');
      if(task)renderLrpProgressBar(progress,calculateLrpProgress(task,tasks));else progress.textContent='—';
      const actions=row.createEl('td',{cls:'lrp-planning-actions'});
      const decisionButton=(text,action)=>{
        const button=actions.createEl('button',{text});
        button.onclick=async()=>{button.disabled=true;try{await saveLrpPlanningDecision(view.plugin,project.id,task.id,action);}catch(error){new obsidian.Notice('保存失败，请重试');console.error(error);button.disabled=false;}};
      };
      if(task && !state.done){
        actions.createEl('button',{text:'重新规划'}).onclick=()=>new LrpReplanModal(view.plugin,project.id,task).open();
        decisionButton(state.abandoned?'恢复':'放弃',state.abandoned?'restore':'abandon');
      }
      if(task?.planningHistory?.length){
        const history=actions.createEl('details',{cls:'lrp-planning-history'});history.createEl('summary',{text:'规划记录'});
        for(const item of task.planningHistory){
          history.createDiv({text:`${item.at.slice(0,10)} · ${{abandon:'放弃',restore:'恢复',replan:'重新规划'}[item.action] || item.action} · 原安排 ${item.startDate || '—'} 至 ${item.dueDate || '—'}`});
        }
      }
    }
    if(!count)body.createEl('tr').createEl('td',{text:'此分类下没有记录',attr:{colspan:'9'}});
  };
  const saveRules=async()=>{
    view.plugin.settings.portfolioRules={overdueDays:Number(overdue.value),previousWeeks:Number(previous.value)};
    await view.plugin.saveSettings();renderRows();
  };
  overdue.onchange=saveRules;previous.onchange=saveRules;
  category.onchange=()=>{view.lrpPortfolioCategory=category.value;renderRows();};
  search.oninput=renderRows;renderRows();
}
function getLrpTimelineRange(portfolio) {
  const dated=portfolio.filter(item=>item.start && item.end);
  if(!dated.length)return null;
  const first=Math.min(...dated.map(item=>Date.parse(item.start)));
  const last=Math.max(...dated.map(item=>Date.parse(item.end)));
  const monday=new Date(first);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  const start=monday.getTime();
  const weeks=Math.max(1,Math.ceil((last-start+86400000)/(7*86400000)));
  return {start,weeks,days:weeks*7};
}
function renderLrpPortfolioTimeline(container,view,portfolio) {
  container.createEl('h3',{text:'全部项目 · 项目时间跨度'});
  container.createEl('p',{text:'每一行代表一个项目。色条表示该项目最早开始至最晚截止的时间，便于查看同一时期有哪些项目并行。',cls:'lrp-portfolio-hint'});
  const range=getLrpTimelineRange(portfolio);
  const scroll=container.createDiv('lrp-project-timeline-scroll');
  const grid=scroll.createDiv('lrp-project-timeline');
  grid.style.setProperty('--lrp-timeline-weeks',String(range?.weeks || 1));
  grid.createDiv({text:'项目',cls:'lrp-timeline-label lrp-timeline-header'});
  const axis=grid.createDiv('lrp-timeline-axis');
  if(range){
    const months=axis.createDiv('lrp-timeline-months');
    const weeks=axis.createDiv('lrp-timeline-weeks');
    const groups=[];
    for(let day=0;day<range.days;day++){
      const date=new Date(range.start+day*86400000);
      const text=`${date.getUTCFullYear()}年${date.getUTCMonth()+1}月`;
      if(groups.at(-1)?.text===text)groups.at(-1).days++;
      else groups.push({text,days:1});
    }
    for(const group of groups){
      const cell=months.createDiv({text:group.text});cell.style.flex=String(group.days);
    }
    for(let week=0;week<range.weeks;week++){
      const date=new Date(range.start+week*7*86400000);
      const cell=weeks.createDiv();
      cell.createDiv({text:`${date.getUTCMonth()+1}/${date.getUTCDate()}`});
      cell.createEl('small',{text:`第${getLrpWeekInfo(date.toISOString()).week}周`});
    }
  }else axis.createDiv({text:'尚未设置项目日期'});
  for(const item of portfolio){
    const {project,start,end,progress}=item;
    const label=grid.createDiv({text:project.name,cls:'lrp-timeline-label'});
    label.style.setProperty('--lrp-project-color',project.calendarColor);
    const lane=grid.createDiv('lrp-timeline-lane');
    if(range){
      const today=Date.parse(toDateStr(new Date()));
      if(today>=range.start && today<range.start+range.days*86400000){
        const marker=lane.createDiv('lrp-timeline-today');marker.style.left=`${(today-range.start)/86400000/range.days*100}%`;marker.title='今天';
      }
    }
    if(range && start && end){
      const left=(Date.parse(start)-range.start)/86400000/range.days*100;
      const width=(Date.parse(end)-Date.parse(start)+86400000)/86400000/range.days*100;
      const bar=lane.createEl('button',{text:`${progress}%`,cls:'lrp-project-span',attr:{title:`${start} 至 ${end}`}});
      bar.style.left=`${left}%`;bar.style.width=`${width}%`;bar.style.setProperty('--lrp-project-color',project.calendarColor);
      bar.onclick=async()=>{
        view.plugin.settings.activeProjectId=project.id;view.plugin.settings.showAllProjects=false;
        await view.plugin.saveSettings();await view.plugin.taskStore.load();view.render();
      };
    }else lane.createSpan({text:'待设置开始／截止日期',cls:'lrp-portfolio-hint'});
  }
}
