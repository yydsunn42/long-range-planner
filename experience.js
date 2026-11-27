// Shared view-state and modal conventions. State is in memory, never in task files.
const LRP_VIEW_STATE_SELECTORS = [
  '.planner-grid-content','.dashboard-content','.lrp-dashboard-finder',
  '.lrp-project-finder','.lrp-project-finder-content','.lrp-board-page',
  '.planner-board-container','.planner-board-column-content',
  '.myday-week-scroll','.myday-month-scroll','.lrp-time-scroll',
  '.lrp-portfolio-content','.lrp-project-timeline-scroll','.lrp-dependency-scroll',
  '.lrp-dependency-content','.planner-detail-wrapper'
];
function getLrpElementStateKey(element,selector,index) {
  const owner=element.closest?.('[data-project-id]')?.getAttribute('data-project-id') || '';
  const identity=element.getAttribute?.('data-bucket-id') || element.getAttribute?.('data-lrp-group-id') || '';
  return `${selector}|${owner}|${identity || index}`;
}
function captureLrpViewState(container) {
  if(!container?.querySelectorAll)return null;
  const scroll=[{key:'root',top:container.scrollTop,left:container.scrollLeft}];
  for(const selector of LRP_VIEW_STATE_SELECTORS){
    [...container.querySelectorAll(selector)].forEach((element,index)=>scroll.push({key:getLrpElementStateKey(element,selector,index),top:element.scrollTop,left:element.scrollLeft}));
  }
  const details=[...container.querySelectorAll('details.lrp-project-overview,details[data-lrp-group-id]')].map((element,index)=>({key:getLrpElementStateKey(element,'details',index),open:element.open}));
  const active=container.ownerDocument?.activeElement;
  let focus=null;
  if(active && container.contains?.(active) && active.matches?.('input[type="search"]')){
    const candidates=[...container.querySelectorAll('input[type="search"]')];
    focus={index:candidates.indexOf(active),start:active.selectionStart,end:active.selectionEnd};
  }
  return {scroll,details,focus};
}
function restoreLrpViewState(container,state) {
  if(!state || !container?.querySelectorAll)return;
  const positions=new Map(state.scroll.map(row=>[row.key,row]));
  const root=positions.get('root');if(root){container.scrollTop=root.top;container.scrollLeft=root.left;}
  for(const selector of LRP_VIEW_STATE_SELECTORS){
    [...container.querySelectorAll(selector)].forEach((element,index)=>{
      const row=positions.get(getLrpElementStateKey(element,selector,index));
      if(row){element.scrollTop=row.top;element.scrollLeft=row.left;}
    });
  }
  const expanded=new Map(state.details.map(row=>[row.key,row.open]));
  [...container.querySelectorAll('details.lrp-project-overview,details[data-lrp-group-id]')].forEach((element,index)=>{
    const key=getLrpElementStateKey(element,'details',index);if(expanded.has(key))element.open=expanded.get(key);
  });
  const active=container.ownerDocument?.activeElement;
  if(state.focus && (!active || !active.isConnected || active===container.ownerDocument?.body)){
    const target=container.querySelectorAll('input[type="search"]')[state.focus.index];
    target?.focus?.({preventScroll:true});
    if(state.focus.start!==null)target?.setSelectionRange?.(state.focus.start,state.focus.end);
  }
}
function installLrpViewState(ViewClass,method,kind) {
  const render=ViewClass.prototype[method];if(typeof render!=='function')return;
  const close=ViewClass.prototype.onClose;
  ViewClass.prototype.onClose=function(...args){
    const plugin=this.plugin?.lrpRootPlugin || this.plugin;
    const state=captureLrpViewState(this.containerEl);
    if(state && this.lrpExperienceScopeKey && plugin){
      (plugin.lrpViewExperienceStates || (plugin.lrpViewExperienceStates=new Map())).set(this.lrpExperienceScopeKey,state);
    }
    this.lrpExperienceGeneration=(this.lrpExperienceGeneration || 0)+1;
    return close?.apply(this,args);
  };
  ViewClass.prototype[method]=function(...args){
    const container=this.containerEl;
    if(!container?.querySelectorAll)return render.apply(this,args);
    const plugin=this.plugin?.lrpRootPlugin || this.plugin;
    if(!plugin)return render.apply(this,args);
    const scope=this.plugin.settings.showAllProjects?'all':this.plugin.settings.activeProjectId;
    const locateTimelineWeek=kind==='timeline' && Boolean(this.lrpTimelineLocateCurrent || this.lrpTimelineState?.scope!==scope);
    const page=kind==='detail'?this.task?.id || 'empty':kind==='calendar'?`${this.viewMode}:${(this.viewMode==='month'?this.monthAnchor:this.weekAnchor)?.toISOString?.().slice(0,10) || ''}`:'';
    const key=`${kind}:${this.plugin.lrpEmbeddedScope?'embedded:':''}${scope}:${page}`;
    const states=plugin.lrpViewExperienceStates || (plugin.lrpViewExperienceStates=new Map());
    // A scope change must not overwrite the destination's saved position with the old DOM.
    if(this.lrpExperienceScopeKey){
      const captured=captureLrpViewState(container);
      if(captured)states.set(this.lrpExperienceScopeKey,captured);
    }
    this.lrpExperienceScopeKey=key;
    const state=states.get(key),generation=(this.lrpExperienceGeneration || 0)+1;
    this.lrpExperienceGeneration=generation;
    const restore=()=>{
      if(container.isConnected===false)return;
      if(generation!==this.lrpExperienceGeneration || this.lrpExperienceScopeKey!==key)return;
      const restored=locateTimelineWeek && state ? {...state,scroll:state.scroll.map(row=>row.key.startsWith('.lrp-time-scroll|')?{...row,left:this.lrpTimelineState?.scroll || 0}:row)} : state;
      restoreLrpViewState(container,restored);
    };
    const finished=()=>{
      restore();
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(restore);
    };
    const result=render.apply(this,args);
    if(result?.then)return result.then(value=>{finished();return value;});
    finished();return result;
  };
}
function applyLrpModalExperience(modal,size) {
  modal.modalEl?.classList?.add('lrp-ui-modal',`lrp-ui-modal-${size}`);
  modal.contentEl?.classList?.add('lrp-ui-modal-content');
}
function installLrpModalExperience(ModalClass,size) {
  const open=ModalClass.prototype.onOpen;
  ModalClass.prototype.onOpen=function(...args){applyLrpModalExperience(this,size);return open?.apply(this,args);};
}
for(const [ViewClass,method,kind] of [
  [GridView,'render','grid'],[DashboardView,'render','dashboard'],
  [BoardView,'render','board'],[GanttView,'render','timeline'],
  [MyDayView,'render','calendar'],[DependencyGraphView,'refresh','graph'],
  [TaskDetailView,'render','detail']
])installLrpViewState(ViewClass,method,kind);
for(const [ModalClass,size] of [
  [LrpNewProjectModal,'small'],[LrpBucketColorModal,'small'],[LrpBucketScheduleModal,'small'],
  [LrpTaskCostModal,'small'],[LrpSubtaskScoreModal,'small'],[LrpProjectTagModal,'small'],
  [LrpProjectReviewModal,'medium'],[LrpScoreAnalysisModal,'medium'],[LrpManageProjectsModal,'medium'],
  [LrpDeleteProjectsModal,'medium'],[LrpReplanModal,'medium'],[LrpDayTasksModal,'medium'],
  [TaskListModal,'medium'],[CostReportModal,'large'],[LrpCostAnalysisModal,'large'],[LrpProjectOverviewModal,'large']
])installLrpModalExperience(ModalClass,size);
