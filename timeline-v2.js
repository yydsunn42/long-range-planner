function getLrpTimelineWeekScroll(first,today,dayWidth) {
  const monday=today-((new Date(today).getUTCDay()+6)%7)*86400000;
  return Math.max(0,(monday-first)/86400000*dayWidth);
}
function focusLrpTimelineCurrentWeek(view) {
  view.lrpTimelineLocateCurrent=true;
  if(view.lrpTimelineReady)return view.render();
}
function getLrpSoftTimelineColor(value) {
  const color=String(value || '#ddd5e7');
  if(LRP_BUCKET_PALETTE.includes(color.toLowerCase()))return color;
  const match=/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color);
  if(!match)return `color-mix(in srgb,${color} 30%,var(--background-primary))`;
  const hex=match[1].length===3?[...match[1]].map(c=>c+c).join(''):match[1];
  const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,light=(max+min)/2;
  if(light>=0.76 && delta<=0.35)return color;
  let hue=0;
  if(delta){hue=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;hue=(hue*60+360)%360;}
  return `hsl(${Math.round(hue)} ${delta<0.04?8:32}% 82%)`;
}
function getLrpTimelineTree(plugin,all) {
  const projects=all ? plugin.settings.projects || [] : (plugin.settings.projects || []).filter(p=>p.id===plugin.settings.activeProjectId);
  const date=value=>getLrpWeekInfo(value) ? Date.parse(value.slice(0,10)) : null;
  const span=node=>{
    node.children.forEach(span);
    const dates=[date(node.task?.startDate),date(node.task?.dueDate),...node.children.flatMap(child=>[child.start,child.end])].filter(value=>value!==null);
    node.start=dates.length?Math.min(...dates):null;node.end=dates.length?Math.max(...dates):null;
    return node;
  };
  return projects.flatMap(project=>{
    const tasks=plugin.taskStore.getAllForProject(project.id) || [];
    const makeTask=(task,color,path=new Set())=>{
      const next=new Set(path);next.add(task.id);
      const children=tasks.filter(child=>child.parentId===task.id && !next.has(child.id)).map(child=>makeTask(child,color,next));
      for(const sub of task.subtasks || [])children.push({id:`${project.id}:${task.id}:${sub.id}`,name:sub.title,color,task:{...sub,id:`${task.id}::${sub.id}`,_lrpOwnerId:task.id,_lrpSubId:sub.id},children:[],kind:'subtask',project});
      return {id:`${project.id}:${task.id}`,name:task.title,color,task,children,kind:task.parentId?'subtask':'task',project};
    };
    const roots=tasks.filter(task=>!task.parentId || !tasks.some(parent=>parent.id===task.parentId));
    const groups=[...(project.buckets || []),{id:undefined,name:'未分组',color:'#ddd5e7'}].map(bucket=>({id:`${project.id}:bucket:${bucket.id || 'none'}`,name:bucket.name,color:getLrpSoftTimelineColor(bucket.color || '#ddd5e7'),kind:'week',project,children:roots.filter(task=>bucket.id ? task.bucketId===bucket.id : !(project.buckets || []).some(b=>b.id===task.bucketId)).map(task=>makeTask(task,getLrpSoftTimelineColor(bucket.color || '#ddd5e7')))})).filter(group=>group.children.length);
    const node=span({id:project.id,name:project.name,project,color:getLrpSoftTimelineColor(project.calendarColor),kind:'project',children:groups});
    return all ? [node] : groups;
  });
}
function flattenLrpTimelineTree(tree,collapsed,start,end,depth=0) {
  const rows=[];
  for(const node of tree){
    if(node.start!==null && (node.end<start || node.start>end))continue;
    rows.push({node,depth});
    if(!collapsed.has(node.id))rows.push(...flattenLrpTimelineTree(node.children,collapsed,start,end,depth+1));
  }
  return rows;
}
async function renderLrpTimelineV2(view) {
  const generation=(view.lrpTimelineGeneration || 0)+1;view.lrpTimelineGeneration=generation;
  await clearLrpEmbeddedViews(view);
  if(generation!==view.lrpTimelineGeneration)return;
  const plugin=view.plugin;
  clearLrpLeakedViewContainers(view);
  view.lrpTimeResize?.disconnect();
  view.containerEl.empty();
  const wrapper=view.containerEl.createDiv('lrp-timeline-v2-wrapper');
  renderPlannerHeader(wrapper,plugin,{active:'gantt',hideAddTask:true,onProjectChange:()=>view.render()});
  const all=Boolean(plugin.settings.showAllProjects);
  wrapper.createEl('h3',{text:all?'全部项目 · 项目时间跨度':'周分组 · 任务'});
  const controls=wrapper.createDiv('lrp-time-controls');
  const state=view.lrpTimelineState || (view.lrpTimelineState={dayWidth:18,scroll:0,collapsed:new Set(),scope:null});
  const scope=all?'all':plugin.settings.activeProjectId;
  const locateCurrent=Boolean(view.lrpTimelineLocateCurrent || state.scope!==scope);
  view.lrpTimelineLocateCurrent=false;
  if(state.scope!==scope){state.scroll=0;state.scope=scope;state.collapsed=new Set();state.seen=new Set();state.first=null;state.days=null;state.mode="hierarchy";}
  const tree=getLrpTimelineTree(plugin,all);
  state.seen=state.seen || new Set();
  const remember=nodes=>{for(const node of nodes){if(!state.seen.has(node.id)){state.seen.add(node.id);if(node.children.length)state.collapsed.add(node.id);}remember(node.children);}};remember(tree);
  const dates=tree.flatMap(node=>[node.start,node.end]).filter(value=>value!==null);
  const today=Date.parse(toDateStr(new Date()));
  const min=dates.length?Math.min(...dates):today,max=dates.length?Math.max(...dates):today+28*86400000;
  const origin=Math.min(min,today);
  let first=state.first ?? (origin-((new Date(origin).getUTCDay()+6)%7)*86400000-28*86400000);
  let days=state.days || Math.max(70,Math.ceil((Math.max(max,today+28*86400000)-first)/86400000)+29);
  if(locateCurrent){
    const monday=today-((new Date(today).getUTCDay()+6)%7)*86400000;
    if(first>monday)first=monday-28*86400000;
    days=Math.max(days,Math.ceil((monday-first)/86400000)+35);
    state.scroll=getLrpTimelineWeekScroll(first,today,state.dayWidth);
  }
  state.first=first;state.days=days;
  const minus=controls.createEl('button',{text:'−',attr:{'aria-label':'缩小时间比例'}});
  const zoom=controls.createEl('input',{attr:{type:'range',min:'5',max:'48',step:'1','aria-label':'时间比例'}});zoom.value=String(state.dayWidth);
  const plus=controls.createEl('button',{text:'＋',attr:{'aria-label':'放大时间比例'}});
  const caption=controls.createSpan();
  const now=controls.createEl('button',{text:'定位本周'});
  const mode=controls.createEl('select',{attr:{'aria-label':'时间轴显示层级'}});
  for(const [value,text] of [['hierarchy','默认折叠'],['all','全部显示'],['tasks','只显示任务'],['weeks-tasks','显示周和任务']])mode.createEl('option',{value,text});
  if(state.mode==='subtasks')state.mode='weeks-tasks';
  mode.value=state.mode || 'hierarchy';mode.hidden=all;
  const scroll=wrapper.createDiv('lrp-time-scroll');
  if(locateCurrent){
    const currentDay=getLrpTimelineWeekScroll(first,today,1);
    const visibleDays=Math.ceil(Math.max(1400,scroll.clientWidth-240)/state.dayWidth);
    days=Math.max(days,currentDay+visibleDays+14);state.days=days;
  }
  const grid=scroll.createDiv('lrp-time-grid');
  const header=grid.createDiv({text:all?'项目':(plugin.settings.projects || []).find(project=>project.id===plugin.settings.activeProjectId)?.name || '项目',cls:'lrp-time-label lrp-time-corner'});
  const axis=grid.createDiv('lrp-time-axis');
  const months=axis.createDiv('lrp-time-months');
  const weeks=axis.createDiv('lrp-time-weeks');
  const rowsHost=grid.createDiv('lrp-time-rows');
  const buildAxis=()=>{
    const width=days*state.dayWidth;
    grid.style.width=`${240+width}px`;grid.style.setProperty('--lrp-time-width',`${width}px`);grid.style.setProperty('--lrp-day-width',`${state.dayWidth}px`);
    months.empty();weeks.empty();caption.textContent=`每周 ${state.dayWidth*7}px`;
    const groups=[];
    for(let day=0;day<days;day++){
      const date=new Date(first+day*86400000),name=`${date.getUTCFullYear()}年${date.getUTCMonth()+1}月`;
      if(groups.at(-1)?.name===name)groups.at(-1).days++;else groups.push({name,days:1});
    }
    for(const group of groups){const cell=months.createDiv({text:group.name});cell.style.width=`${group.days*state.dayWidth}px`;}
    for(let day=0;day<days;day+=7){
      const date=new Date(first+day*86400000),cell=weeks.createDiv();cell.style.width=`${Math.min(7,days-day)*state.dayWidth}px`;
      cell.createSpan({text:`${date.getUTCMonth()+1}/${date.getUTCDate()}`});
      cell.createEl('small',{text:`第${getLrpWeekInfo(date.toISOString()).week}周`});
    }
  };
  const drawRows=()=>{
    const scrollTop=scroll.scrollTop;
    const boundary=scroll.getBoundingClientRect().left+240;
    for(const cell of weeks.children){
      const rect=cell.getBoundingClientRect();
      const clipped=rect.left<boundary && rect.right>boundary;
      for(const text of cell.children)text.style.visibility=clipped?'hidden':'';
    }
    rowsHost.empty();
    const visibleStart=first+scroll.scrollLeft/state.dayWidth*86400000;
    const visibleEnd=visibleStart+Math.max(1,scroll.clientWidth-240)/state.dayWidth*86400000;
    // The portfolio stays one row per project; single-project mode exposes the week tree.
    const rows=all ? tree.filter(node=>node.start===null || node.end>=visibleStart && node.start<=visibleEnd).map(node=>({node,depth:0})) : flattenLrpTimelineTree(tree,mode.value==='hierarchy'?state.collapsed:new Set(),visibleStart,visibleEnd).filter(row=>row.node.kind!=='subtask').filter(row=>mode.value==='tasks'?row.node.kind==='task':mode.value==='weeks-tasks'?row.node.kind==='week' || row.node.kind==='task':true).map(row=>mode.value==='tasks'?{...row,depth:0}:row);
    for(const {node,depth} of rows){
      const label=rowsHost.createDiv(`lrp-time-label${node.kind==='week'?' lrp-time-week-label':''}`);label.style.setProperty('--lrp-node-color',node.color);label.style.paddingLeft=`${12+depth*18}px`;
      if(!all && node.children.some(child=>child.kind!=='subtask') && mode.value!=='tasks' && mode.value!=='weeks-tasks'){
        const toggle=label.createEl('button',{text:state.collapsed.has(node.id)?'▸':'▾',cls:'lrp-time-toggle',attr:{'aria-label':`${state.collapsed.has(node.id)?'展开':'收起'}${node.name}`,'aria-expanded':String(!state.collapsed.has(node.id))}});
        toggle.onclick=()=>{if(mode.value==='all'){state.collapsed=new Set();mode.value='hierarchy';state.mode='hierarchy';}if(state.collapsed.has(node.id))state.collapsed.delete(node.id);else state.collapsed.add(node.id);drawRows();};
      }
      const name=label.createEl('button',{text:node.name,cls:'lrp-time-name'});
      const lane=rowsHost.createDiv('lrp-time-lane');
      label.dataset.timelineNode=node.id;lane.dataset.timelineNode=node.id;
      const selectRow=()=>{
        state.selected=node.id;
        for(const element of rowsHost.children)element.classList.toggle('lrp-time-selected',element.dataset.timelineNode===node.id);
      };
      label.classList.toggle('lrp-time-selected',state.selected===node.id);lane.classList.toggle('lrp-time-selected',state.selected===node.id);
      label.addEventListener('pointerdown',selectRow);lane.addEventListener('pointerdown',selectRow);
      const open=anchor=>{
        if(node.task)plugin.openTaskDetail(node.task,{anchor});
        else if(all){plugin.settings.activeProjectId=node.project.id;plugin.settings.showAllProjects=false;void plugin.saveSettings().then(()=>view.render());}
        else if(node.children.length){if(state.collapsed.has(node.id))state.collapsed.delete(node.id);else state.collapsed.add(node.id);drawRows();}
      };
      name.onclick=()=>open(label);
      if(node.start===null){lane.createSpan({text:'未安排时间',cls:'lrp-time-hint'});continue;}
      const bar=lane.createEl('button',{cls:`lrp-time-bar${node.kind==='week'?' lrp-time-week-bar':''}`});bar.style.setProperty('--lrp-node-color',node.color);
      bar.style.left=`${(node.start-first)/86400000*state.dayWidth}px`;bar.style.width=`${Math.max(12,((node.end-node.start)/86400000+1)*state.dayWidth-3)}px`;
      const tasks=plugin.taskStore.getAllForProject(node.project.id) || [];
      const pct=node.task ? node.task._lrpSubId ? node.task.completed?100:0 : calculateLrpProgress(node.task,tasks) : (()=>{if(node.kind==='project')return getLrpProjectState(plugin,tasks).progress;const items=node.children.map(child=>child.task).filter(Boolean);return items.length?Math.min(items.every(task=>getLrpTaskState(plugin,task,tasks).done)?100:99,Math.round(items.reduce((sum,t)=>sum+calculateLrpProgress(t,tasks),0)/items.length)):0;})();
      bar.createSpan({text:`${pct}%`});let moved=false;bar.onclick=event=>{if(moved){event.preventDefault();return;}open(bar);};
      if(node.task && getLrpWeekInfo(node.task.startDate) && getLrpWeekInfo(node.task.dueDate)){
        const leftHandle=bar.createSpan({cls:'lrp-time-resize-left'}),rightHandle=bar.createSpan({cls:'lrp-time-resize-right'});
        bar.onpointerdown=event=>{
          if(event.button!==0)return;
          const initialX=event.clientX,originalStart=Date.parse(node.task.startDate),originalEnd=Date.parse(node.task.dueDate);
          const mode=event.target===leftHandle?'start':event.target===rightHandle?'end':'move';
          moved=false;bar.setPointerCapture(event.pointerId);
          let delta=0;
          bar.onpointermove=move=>{
            delta=Math.round((move.clientX-initialX)/state.dayWidth);if(!delta)return;moved=true;
            const start=mode==='end'?originalStart:mode==='start'?Math.min(originalEnd,originalStart+delta*86400000):originalStart+delta*86400000;
            const end=mode==='start'?originalEnd:Math.max(start,originalEnd+delta*86400000);
            bar.style.left=`${(start-first)/86400000*state.dayWidth}px`;bar.style.width=`${Math.max(12,((end-start)/86400000+1)*state.dayWidth-3)}px`;
          };
          bar.onpointerup=async()=>{
            bar.onpointermove=null;bar.onpointerup=null;
            if(!moved)return;
            const start=mode==='end'?originalStart:mode==='start'?Math.min(originalEnd,originalStart+delta*86400000):originalStart+delta*86400000;
            const end=mode==='start'?originalEnd:Math.max(start,originalEnd+delta*86400000);
            try{await updateLrpCalendarTask(plugin.taskStore,node.task,{startDate:new Date(start).toISOString().slice(0,10),dueDate:new Date(end).toISOString().slice(0,10)});}
            catch(error){new obsidian.Notice('日期保存失败，请重试');console.error(error);view.render();}
          };
          bar.onpointercancel=()=>{bar.onpointermove=null;bar.onpointerup=null;drawRows();};
        };
      }
    }
    scroll.scrollTop=scrollTop;
    if(!rows.length)rowsHost.createDiv({text:'当前日期范围内没有任务，请横向滚动查看其他周。',cls:'lrp-time-empty'});
  };
  let frame=null;
  const extend=(direction)=>{
    if(direction<0){first-=140*86400000;days+=140;buildAxis();scroll.scrollLeft+=140*state.dayWidth;}
    else {days+=140;buildAxis();}
    state.first=first;state.days=days;state.scroll=scroll.scrollLeft;
  };
  mode.onchange=()=>{state.mode=mode.value;scroll.scrollTop=0;drawRows();};
  scroll.onscroll=()=>{
    if(Math.abs(state.scroll-scroll.scrollLeft)<0.5)return;
    state.scroll=scroll.scrollLeft;
    if(scroll.scrollLeft<state.dayWidth*7)extend(-1);
    else if(scroll.scrollLeft+scroll.clientWidth>scroll.scrollWidth-state.dayWidth*14)extend(1);
    if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=null;drawRows();});
  };
  const resizeZoom=value=>{
    const center=scroll.scrollLeft+Math.max(1,scroll.clientWidth-240)/2;
    const day=center/state.dayWidth;
    state.dayWidth=Math.max(5,Math.min(48,Number(value)));zoom.value=String(state.dayWidth);buildAxis();
    scroll.scrollLeft=Math.max(0,day*state.dayWidth-Math.max(1,scroll.clientWidth-240)/2);state.scroll=scroll.scrollLeft;drawRows();
  };
  minus.onclick=()=>resizeZoom(state.dayWidth-3);plus.onclick=()=>resizeZoom(state.dayWidth+3);zoom.oninput=()=>resizeZoom(zoom.value);
  scroll.addEventListener('wheel',event=>{if(event.ctrlKey || event.metaKey){event.preventDefault();resizeZoom(state.dayWidth+(event.deltaY<0?2:-2));}},{passive:false});
  now.onclick=()=>{scroll.scrollLeft=getLrpTimelineWeekScroll(first,today,state.dayWidth);state.scroll=scroll.scrollLeft;drawRows();};
  buildAxis();
  requestAnimationFrame(()=>{if(generation!==view.lrpTimelineGeneration)return;scroll.scrollLeft=state.scroll;state.scroll=scroll.scrollLeft;drawRows();});
  // Resize filtering uses current pixel bounds without rebuilding the user's expanded tree.
  view.lrpTimeResize?.disconnect();
  if(typeof ResizeObserver!=='undefined'){view.lrpTimeResize=new ResizeObserver(drawRows);view.lrpTimeResize.observe(scroll);}
}
GanttView.prototype.render=function(){return renderLrpTimelineV2(this);};
const lrpTimelineOpen=GanttView.prototype.onOpen;
GanttView.prototype.onOpen=async function(...args){this.lrpTimelineLocateCurrent=true;this.lrpTimelineReady=false;await lrpTimelineOpen.apply(this,args);this.lrpTimelineReady=true;};
const lrpTimelineClose=GanttView.prototype.onClose;
GanttView.prototype.onClose=async function(...args){this.lrpTimelineReady=false;this.lrpTimelineGeneration=(this.lrpTimelineGeneration || 0)+1;this.lrpTimeResize?.disconnect();return lrpTimelineClose.apply(this,args);};
