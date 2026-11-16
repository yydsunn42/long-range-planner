// Project-local, deterministic dependency layout. No task dates or dependency data are changed.
function getLrpDependencyLayout(tasks) {
  const byId=new Map(tasks.map(task=>[task.id,task]));
  const edges=[];
  for(const task of tasks)for(const dep of task.dependencies || []){
    if(byId.has(dep.predecessorId))edges.push({source:dep.predecessorId,target:task.id,type:dep.type || 'FS'});
  }
  const nodes=tasks.map(task=>({id:task.id,task,level:0}));
  const map=new Map(nodes.map(node=>[node.id,node]));
  const incoming=new Map(nodes.map(node=>[node.id,0]));
  const outgoing=new Map(nodes.map(node=>[node.id,[]]));
  for(const edge of edges){incoming.set(edge.target,incoming.get(edge.target)+1);outgoing.get(edge.source).push(edge.target);}
  const queue=nodes.filter(node=>incoming.get(node.id)===0);
  const visited=new Set();
  for(let index=0;index<queue.length;index++){
    const node=queue[index];visited.add(node.id);
    for(const id of outgoing.get(node.id)){
      const next=map.get(id);next.level=Math.max(next.level,node.level+1);
      incoming.set(id,incoming.get(id)-1);if(incoming.get(id)===0)queue.push(next);
    }
  }
  // Existing cycles remain visible and never enter a force simulation or an endless loop.
  const lanes=new Map();
  for(const node of nodes){
    node.cyclic=!visited.has(node.id);
    const lane=lanes.get(node.level) || 0;lanes.set(node.level,lane+1);
    Object.assign(node,{x:24+node.level*320,y:24+lane*108,width:208,height:80});
  }
  return {nodes,edges,width:Math.max(480,...nodes.map(node=>node.x+node.width+24)),height:Math.max(140,...nodes.map(node=>node.y+node.height+24))};
}
function matchesLrpDependencyProject(plugin,tasks,filter,now=new Date()) {
  return matchesLrpProjectStatus(plugin,tasks,filter,now);
}
function getLrpDependencyPath(source,target) {
  const sx=source.x+source.width,sy=source.y+source.height/2;
  const tx=target.x,ty=target.y+target.height/2;
  const bend=Math.max(36,Math.abs(tx-sx)/2);
  return `M ${sx} ${sy} C ${sx+bend} ${sy}, ${tx-bend} ${ty}, ${tx} ${ty}`;
}
DependencyGraphView.prototype.onOpen=async function(){
  this.closed=false;
  const container=this.containerEl;container.empty();container.addClass('planner-graph-wrapper','lrp-dependency-view');
  renderPlannerHeader(container,this.plugin,{active:'graph',onProjectChange:()=>this.onLrpProjectScopeChange()});
  const toolbar=container.createDiv('lrp-dependency-toolbar');
  const heading=toolbar.createDiv();heading.createEl('h3',{text:'任务依赖'});
  heading.createEl('p',{text:'从左向右查看前后关系 · 点击卡片查看任务，拖动卡片调整位置'});
  const actions=toolbar.createDiv('lrp-dependency-actions');
  actions.createEl('button',{text:'刷新'}).onclick=()=>this.refresh();
  actions.createEl('button',{text:'重排节点'}).onclick=()=>this.resetLayout();
  this.lrpDependencyRecords=[];
  this.projectFinder=this.plugin.settings.showAllProjects ? createLrpProjectFinder(container,this,this.lrpDependencyRecords,'lrpDependency') : null;
  this.graphContent=this.projectFinder ? this.projectFinder.content : container.createDiv('lrp-dependency-content');
  this.graphContent.classList.add('lrp-dependency-content');
  await this.plugin.taskStore.ensureLoaded();
  this.unsubscribe=this.plugin.taskStore.subscribe(()=>this.refresh());
  await this.refresh();
};
DependencyGraphView.prototype.refresh=async function(){
  if(this.closed || !this.graphContent)return;
  if(this.dragNode){this.needsRefresh=true;return;}
  this.needsRefresh=false;
  const content=this.graphContent,scrollTop=content.scrollTop,scrollLeft=content.scrollLeft;
  content.empty();
  if(this.lrpDependencyRecords)this.lrpDependencyRecords.length=0;
  const projects=getVisibleLrpProjects(this.plugin.settings);
  let count=0;
  for(const project of projects){
    const tasks=this.plugin.taskStore.getAllForProject(project.id) || [];
    const layout=getLrpDependencyLayout(tasks);
    count++;
    const section=content.createDiv('lrp-dependency-project');
    section.style.setProperty('--lrp-dependency-color',getLrpSoftTimelineColor(project.calendarColor));
    this.lrpDependencyRecords?.push({project,section});
    const header=section.createDiv('lrp-dependency-project-header');
    header.title='双击进入此项目';
    header.ondblclick=event=>{event.preventDefault();event.stopPropagation();void openLrpProjectFromHeading(this,project.id).catch(error=>{new obsidian.Notice('打开项目失败，请重试');console.error(error);});};
    header.createEl('h4',{text:project.name});
    header.createSpan({text:`${layout.nodes.length} 个任务 · ${layout.edges.length} 条关系`});
    const scroller=section.createDiv('lrp-dependency-scroll');
    const stage=scroller.createDiv('lrp-dependency-stage');
    stage.style.width=`${layout.width}px`;stage.style.height=`${layout.height}px`;
    const doc=stage.ownerDocument,ns='http://www.w3.org/2000/svg';
    const svg=doc.createElementNS(ns,'svg');svg.classList.add('lrp-dependency-lines');svg.setAttribute('aria-hidden','true');
    stage.appendChild(svg);
    const nodeMap=new Map(layout.nodes.map(node=>[node.id,node]));
    const edges=[];
    const labels={FS:'完成后开始',SS:'开始后开始',FF:'完成后完成',SF:'开始后完成'};
    for(const edge of layout.edges){
      const group=doc.createElementNS(ns,'g');svg.appendChild(group);
      const path=doc.createElementNS(ns,'path');group.appendChild(path);
      const arrow=doc.createElementNS(ns,'path');group.appendChild(arrow);arrow.classList.add('lrp-dependency-arrow');
      const label=doc.createElementNS(ns,'text');label.textContent=labels[edge.type] || edge.type;group.appendChild(label);
      edges.push({...edge,path,arrow,label});
    }
    const updateEdges=()=>{
      for(const edge of edges){
        const source=nodeMap.get(edge.source),target=nodeMap.get(edge.target);
        edge.path.setAttribute('d',getLrpDependencyPath(source,target));
        const x=target.x,y=target.y+target.height/2;
        edge.arrow.setAttribute('d',`M ${x-7} ${y-4} L ${x} ${y} L ${x-7} ${y+4} Z`);
        edge.label.setAttribute('x',String((source.x+source.width+target.x)/2));
        edge.label.setAttribute('y',String((source.y+source.height/2+target.y+target.height/2)/2-9));
      }
    };
    for(const node of layout.nodes){
      const card=stage.createEl('button',{cls:'lrp-dependency-card',attr:{type:'button',title:node.task.title}});
      const position=()=>{card.style.left=`${node.x}px`;card.style.top=`${node.y}px`;};position();
      const title=card.createEl('strong',{text:node.task.title});
      const meta=card.createDiv('lrp-dependency-card-meta');
      const status=getLrpTaskDisplayStatus(this.plugin,node.task,tasks);
      meta.createSpan({text:status,cls:`lrp-dependency-status${status==='逾期'?' is-overdue':status==='已完成'?' is-complete':''}`});
      meta.createSpan({text:`${calculateLrpProgress(node.task,tasks)}%`,cls:'lrp-dependency-progress'});
      if(status==='已完成')title.classList.add('is-complete');
      let drag=null,suppressClick=false;
      card.onclick=event=>{if(suppressClick){suppressClick=false;return;}this.plugin.openTaskDetail(node.task,event);};
      card.onpointerdown=event=>{
        if(event.button!==0)return;
        drag={x:event.clientX,y:event.clientY,nodeX:node.x,nodeY:node.y};suppressClick=false;
        card.setPointerCapture(event.pointerId);this.dragNode=node;
      };
      card.onpointermove=event=>{
        if(!drag)return;
        if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4 && !suppressClick)return;
        suppressClick=true;card.classList.add('is-dragging');
        node.x=Math.max(12,drag.nodeX+event.clientX-drag.x);node.y=Math.max(12,drag.nodeY+event.clientY-drag.y);
        position();updateEdges();
        stage.style.width=`${Math.max(layout.width,...layout.nodes.map(item=>item.x+item.width+24))}px`;
        stage.style.height=`${Math.max(layout.height,...layout.nodes.map(item=>item.y+item.height+24))}px`;
      };
      const endDrag=()=>{drag=null;this.dragNode=null;card.classList.remove('is-dragging');if(this.needsRefresh)this.refresh();};
      card.onpointerup=endDrag;card.onpointercancel=endDrag;card.onlostpointercapture=endDrag;
    }
    if(!layout.nodes.length)stage.createDiv({text:'此项目暂无任务',cls:'lrp-dependency-empty-project'});
    updateEdges();
  }
  if(!count){const empty=content.createDiv('lrp-dependency-empty');empty.createEl('h4',{text:this.lrpDependencyProjectStatus && this.lrpDependencyProjectStatus!=='all'?'没有符合此状态的项目':'暂无项目'});empty.createEl('p',{text:this.lrpDependencyProjectStatus && this.lrpDependencyProjectStatus!=='all'?'可切换其他项目状态或选择“全部”查看所有项目。':'新建项目后，这里会显示项目内全部任务及已有依赖关系。'});}
  this.projectFinder?.refresh();
  content.scrollTop=scrollTop;content.scrollLeft=scrollLeft;
};
DependencyGraphView.prototype.resetLayout=function(){return this.refresh();};

DependencyGraphView.prototype.lrpRenderProjectScope=async function(){
  this.unsubscribe?.();this.unsubscribe=null;
  await this.onOpen();
};

DependencyGraphView.prototype.onLrpProjectScopeChange=async function(){
  await this.plugin.taskStore.load();
  await this.lrpRenderProjectScope();
};
