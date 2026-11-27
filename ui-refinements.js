function setupLrpPinnedSections(pinned,view) {
    view.lrpPinnedSection ||= 'assessment';
    const columns=[...pinned.querySelectorAll('.planner-board-column')];
    const update=()=>{
        for(const column of columns){
            const kind=column.classList.contains('lrp-assessment-column')?'assessment':'unassigned';
            const expanded=view.lrpPinnedSection===kind;
            column.classList.toggle('lrp-pinned-collapsed',!expanded);
            const content=column.querySelector('.planner-board-column-content');if(content)content.hidden=!expanded;
            const toggle=column.querySelector('.lrp-pinned-toggle');if(toggle){toggle.textContent=expanded?'▾':'▸';toggle.setAttribute('aria-expanded',String(expanded));}
        }
    };
    for(const column of columns){
        const header=column.querySelector('.planner-board-column-header');
        const kind=column.classList.contains('lrp-assessment-column')?'assessment':'unassigned';
        const toggle=header.createEl('button',{text:'',cls:'lrp-pinned-toggle',attr:{type:'button','aria-label':kind==='assessment'?'展开或折叠考验':'展开或折叠未分组'}});
        toggle.onclick=event=>{event.preventDefault();event.stopPropagation();view.lrpPinnedSection=view.lrpPinnedSection===kind?(kind==='assessment'?'unassigned':'assessment'):kind;update();};
    }
    update();
}
async function saveLrpTaskCosts(plugin,task,draft) {
    const root=getLrpReviewRoot(plugin),target=getLrpTaskTarget(root,task);
    if(!target)throw new Error('任务不存在');
    if(!['fixed','hourly',''].includes(draft.costType))throw new Error('费用类型无效');
    const partial={costType:draft.costType || undefined};
    for(const key of ['costEstimate','costActual','hourlyRate']){
        const value=Number(draft[key] || 0);if(!Number.isFinite(value) || value<0)throw new Error('金额请填写非负数');partial[key]=value;
    }
    const before={...target.owner};
    try{await root.taskStore.updateTask(target.owner.id,partial);}
    catch(error){for(const key of Object.keys(target.owner))if(!Object.prototype.hasOwnProperty.call(before,key))delete target.owner[key];Object.assign(target.owner,before);throw error;}
}
class LrpTaskCostModal extends obsidian.Modal {
    constructor(plugin,task){super(plugin.app);this.plugin=plugin;this.task=task;}
    onOpen(){
        const form=this.contentEl.createEl('form',{cls:'lrp-cost-editor'});form.createEl('h3',{text:this.task.title});
        const type=form.createEl('select',{attr:{'aria-label':'费用方式'}});
        for(const [value,text] of [['fixed','固定金额'],['hourly','按工时'],['','不使用']])type.createEl('option',{value,text});type.value=this.task.costType || 'fixed';
        const fields={};
        for(const [key,title] of [['costEstimate','预计金额'],['costActual','实际金额'],['hourlyRate','每小时金额']]){
            const label=form.createEl('label',{text:title});const input=label.createEl('input',{attr:{type:'number',min:'0',step:'0.01','aria-label':title}});input.value=String(this.task[key] ?? 0);fields[key]={label,input};
        }
        const update=()=>{fields.hourlyRate.label.hidden=type.value!=='hourly';fields.costEstimate.label.hidden=fields.costActual.label.hidden=type.value!=='fixed';};type.onchange=update;update();
        const error=form.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});const actions=form.createDiv('lrp-new-project-actions');const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}});const save=actions.createEl('button',{text:'保存',attr:{type:'submit'}});cancel.onclick=()=>this.close();
        form.onsubmit=async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;try{await saveLrpTaskCosts(this.plugin,this.task,{costType:type.value,...Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.input.value]))});this.close();}catch(problem){error.textContent=problem.message;save.disabled=false;}};
    }
    onClose(){this.contentEl.empty();}
}
function renderLrpEditableCostCell(row,plugin,task,key,project,isRolledUp) {
    const currency=project?.currencySymbol || '$';const value=key==='costEstimate'?getTaskEstimatedCost(task,project):getTaskActualCost(task,project);
    const cell=row.createEl('td',{cls:'planner-effort-cell planner-cost-cell'});
    const button=cell.createEl('button',{text:task.costType?formatCurrency(value,currency):'—',cls:'lrp-cost-cell-button',attr:{type:'button','aria-label':key==='costEstimate'?'编辑预计费用':'编辑实际费用'}});
    button.disabled=Boolean(isRolledUp);
    button.onclick=event=>{event.stopPropagation();new LrpTaskCostModal(getLrpReviewRoot(plugin),task).open();};
}
function getLrpCostAnalysis(tasks,project) {
    const parents=new Set(tasks.filter(task=>task.parentId).map(task=>task.parentId));
    const rows=tasks.filter(task=>!parents.has(task.id) && task.costType).map(task=>({task,title:task.title,estimated:getTaskEstimatedCost(task,project),actual:getTaskActualCost(task,project)})).map(row=>({...row,difference:row.actual-row.estimated}));
    const estimated=rows.reduce((sum,row)=>sum+row.estimated,0),actual=rows.reduce((sum,row)=>sum+row.actual,0);
    const budget=project?.budgetTotal>0?project.budgetTotal:estimated;
    return {rows,estimated,actual,budget,difference:actual-budget,overCount:rows.filter(row=>row.difference>0).length};
}
function formatLrpCostDifference(value,currency) {return `${value>0?'+':''}${formatCurrency(value,currency)}`;}
async function saveLrpCostNote(plugin,projectId,note) {
    const root=getLrpReviewRoot(plugin),project=root.settings.projects.find(item=>item.id===projectId);
    if(!project)throw new Error('项目不存在');
    const before=project.costNote,had=Object.prototype.hasOwnProperty.call(project,'costNote');project.costNote=String(note);
    try{await root.saveSettings();}catch(error){if(had)project.costNote=before;else delete project.costNote;throw error;}
}
class LrpCostAnalysisModal extends obsidian.Modal {
    constructor(plugin,projectId,onlyOver=false){super(plugin.app);this.plugin=getLrpReviewRoot(plugin);this.projectId=projectId;this.onlyOver=onlyOver;}
    onOpen(){
        const project=this.plugin.settings.projects.find(item=>item.id===this.projectId);if(!project){this.close();return;}
        const currency=project.currencySymbol || '$',data=getLrpCostAnalysis(this.plugin.taskStore.getAllForProject(project.id)||[],project);
        this.contentEl.createEl('h3',{text:this.onlyOver?'超支任务明细':'预算与费用明细'});
        this.contentEl.createEl('p',{text:`${project.name} · 总预算 ${formatCurrency(data.budget,currency)} · 实际 ${formatCurrency(data.actual,currency)} · 差额 ${formatLrpCostDifference(data.difference,currency)}`});
        const table=this.contentEl.createEl('table',{cls:'lrp-cost-analysis-table'}),head=table.createEl('thead').createEl('tr');
        for(const title of ['任务','原预算','实际金额','超出／节余'])head.createEl('th',{text:title});
        const body=table.createEl('tbody');
        for(const row of data.rows.filter(row=>!this.onlyOver || row.difference>0)){
            const tr=body.createEl('tr');tr.createEl('td',{text:row.title});tr.createEl('td',{text:formatCurrency(row.estimated,currency)});tr.createEl('td',{text:formatCurrency(row.actual,currency)});tr.createEl('td',{text:formatLrpCostDifference(row.difference,currency),cls:row.difference>0?'lrp-cost-positive':'lrp-cost-negative'});
        }
    }
    onClose(){this.contentEl.empty();}
}
function renderLrpCostDashboardSection(parent,plugin,project,tasks) {
    const data=getLrpCostAnalysis(tasks,project),currency=project.currencySymbol || '$';
    const section=parent.createDiv('dashboard-section lrp-dashboard-cost-section');const heading=section.createDiv('lrp-dashboard-cost-heading');heading.createEl('h3',{text:'预算与费用'});
    const report=heading.createEl('button',{text:'查看费用报表',attr:{type:'button'}});report.onclick=()=>new LrpCostAnalysisModal(plugin,project.id).open();
    const grid=section.createDiv('dashboard-kpi-grid lrp-dashboard-cost-grid');
    for(const [title,value,kind] of [['预计金额',formatCurrency(data.estimated,currency),'estimated'],['实际金额',formatCurrency(data.actual,currency),'actual'],['超出预算',formatLrpCostDifference(data.difference,currency),'difference'],['超支任务数',String(data.overCount),'count'],['说明',project.costNote?'已填写':'无','note']]){
        const card=grid.createEl('button',{cls:'dashboard-kpi-card lrp-cost-metric',attr:{type:'button'}});card.createDiv({cls:'dashboard-kpi-title',text:title});
        card.createDiv({cls:`dashboard-kpi-value${kind==='difference'?(data.difference>0?' lrp-cost-positive':' lrp-cost-negative'):''}`,text:value});
        card.onclick=()=>{if(kind==='note'){editor.hidden=!editor.hidden;if(!editor.hidden)textarea.focus();}else new LrpCostAnalysisModal(plugin,project.id,kind==='count').open();};
    }
    const editor=section.createDiv('lrp-cost-note-editor');editor.hidden=true;
    const textarea=editor.createEl('textarea',{attr:{rows:'4','aria-label':'费用说明',placeholder:'填写费用说明…'}});textarea.value=project.costNote || '无';
    const error=editor.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});const actions=editor.createDiv('lrp-new-project-actions');const cancel=actions.createEl('button',{text:'收起',attr:{type:'button'}});const save=actions.createEl('button',{text:'保存说明',attr:{type:'button'}});cancel.onclick=()=>{editor.hidden=true;};
    save.onclick=async()=>{if(save.disabled)return;save.disabled=true;try{await saveLrpCostNote(plugin,project.id,textarea.value);editor.hidden=true;grid.lastElementChild.querySelector('.dashboard-kpi-value').textContent=project.costNote?'已填写':'无';}catch(problem){error.textContent=problem.message;}finally{save.disabled=false;}};
    return section;
}
async function saveLrpProjectReview(plugin,projectId,note) {
    const root=getLrpReviewRoot(plugin),project=root.settings.projects.find(item=>item.id===projectId);
    if(!project)throw new Error('项目不存在');
    const state=getLrpProjectState(root,root.taskStore.getAllForProject(projectId)||[]);
    if(!state.done && !state.abandoned)throw new Error('项目完成或放弃后可填写项目复盘');
    const before=project.review,had=Object.prototype.hasOwnProperty.call(project,'review');project.review=String(note);
    try{await root.saveSettings();}catch(error){if(had)project.review=before;else delete project.review;throw error;}
}
class LrpProjectReviewModal extends obsidian.Modal {
    constructor(plugin,project,onSaved){super(plugin.app);this.plugin=plugin;this.project=project;this.onSaved=onSaved;}
    onOpen(){
        this.contentEl.createEl('h3',{text:'编辑项目复盘'});const form=this.contentEl.createEl('form',{cls:'lrp-project-review-form'});
        const text=form.createEl('textarea',{attr:{rows:'7','aria-label':'项目复盘'}});text.value=this.project.review || '';
        const error=form.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});const actions=form.createDiv('lrp-new-project-actions');const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}});const save=actions.createEl('button',{text:'保存',attr:{type:'submit'}});cancel.onclick=()=>this.close();
        form.onsubmit=async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;try{await saveLrpProjectReview(this.plugin,this.project.id,text.value);this.onSaved?.();this.close();}catch(problem){error.textContent=problem.message;save.disabled=false;}};
    }
    onClose(){this.contentEl.empty();}
}
function renderLrpProjectReview(parent,plugin,project,tasks) {
    const state=getLrpProjectState(plugin,tasks);if(!state.done && !state.abandoned)return;
    const section=parent.createDiv('lrp-project-review-section'),heading=section.createDiv('lrp-project-review-heading');heading.createEl('h3',{text:'项目复盘'});
    const edit=heading.createEl('button',{text:'编辑',attr:{type:'button'}});
    const body=section.createDiv({cls:'lrp-project-review-body',text:project.review || '无'});
    edit.onclick=()=>new LrpProjectReviewModal(plugin,project,()=>{body.textContent=project.review || '无';}).open();
}
function getLrpPinnedFingerprint(view) {
    const tasks=view.taskStore.getAll(),project=view.plugin.settings.projects.find(item=>item.id===view.plugin.settings.activeProjectId);
    return JSON.stringify([project?.id,project?.unassignedBucketName,project?.calendarColor,view.currentFilters,tasks.filter(task=>!(project?.buckets || []).some(bucket=>bucket.id===task.bucketId) || isLrpAssessmentTask(task,tasks))]);
}
function getLrpScoreAnalysisRows(project,tasks) {
    const scores=getLrpProjectScores(project,tasks);
    const regular=scores.entries.filter(entry=>!entry.assessment && Boolean(entry.large)===(scores.regularBasis==='task') && isValidLrpSubtaskScore(getLrpEntryReview(entry))).map(entry=>({title:entry.title,score:entry.item.reviewScore.score}));
    const weighted=regular.map(entry=>({...entry,weight:scores.regularWeight/(regular.length || 1),contribution:entry.score*scores.regularWeight/(regular.length || 1)/100}));
    if(scores.examAverage!==null)weighted.push({title:'考验模块',score:scores.examAverage,weight:scores.examWeight,contribution:scores.examAverage*scores.examWeight/100});
    const exam=getLrpSubtaskReviewEntries(tasks).filter(entry=>entry.assessment && entry.completed && isValidLrpSubtaskScore(entry.item.reviewScore));
    const byId=new Map(tasks.map(task=>[task.id,task])),groups=new Map();
    for(const entry of exam){let root=byId.get(entry.ownerId),seen=new Set();while(root?.parentId && !seen.has(root.id)){seen.add(root.id);root=byId.get(root.parentId);}const key=root?.id || entry.ownerId;if(!groups.has(key))groups.set(key,{title:root?.title || entry.parentTitle,entries:[]});groups.get(key).entries.push({title:entry.title,score:entry.item.reviewScore.score});}
    return {scores,regular:regular.sort((a,b)=>b.score-a.score),weighted,examGroups:[...groups.values()]};
}
function renderLrpDetailedScoreAnalysis(host,project,tasks,category) {
    const data=getLrpScoreAnalysisRows(project,tasks),number=value=>value===null?'待评分':String(Number(value.toFixed(2)));
    const band=host.createDiv(`lrp-analysis-band is-${category}`);
    band.createSpan({text:category==='total'?'总分':category==='regular'?'平时均分':'考验均分'});
    band.createEl('strong',{text:number(category==='total'?data.scores.total:category==='regular'?data.scores.regularAverage:data.scores.examAverage)});
    if(category==='total')band.createSpan({text:`平时 ${data.scores.regularWeight}% · 考验 ${data.scores.examWeight}%`});
    if(category==='total'){
        const table=host.createEl('table',{cls:'lrp-weighted-analysis-table'}),head=table.createEl('thead').createEl('tr');for(const title of ['模块','原始分','权重','加权贡献'])head.createEl('th',{text:title});
        const body=table.createEl('tbody');for(const row of data.weighted){const tr=body.createEl('tr');tr.createEl('td',{text:row.title});tr.createEl('td',{text:number(row.score)});tr.createEl('td',{text:`${number(row.weight)}%`});const cell=tr.createEl('td');cell.createEl('strong',{text:number(row.contribution)});cell.createEl('progress',{attr:{max:'100',value:String(row.contribution),'aria-label':`${row.title}加权贡献`}});}
    }else if(category==='regular'){
        const list=host.createDiv('lrp-regular-rank');list.createEl('h4',{text:'平时任务排名'});
        data.regular.forEach((entry,index)=>{const row=list.createDiv('lrp-rank-row');row.createSpan({text:String(index+1),cls:'lrp-rank-index'});row.createSpan({text:entry.title});row.createEl('progress',{attr:{max:'100',value:String(entry.score)}});row.createEl('strong',{text:number(entry.score)});});
    }else{
        const scroll=host.createDiv('lrp-exam-chart-scroll');
        const groups=data.examGroups;if(!groups.length){scroll.createSpan({text:'暂无已评分考验小任务'});return;}
        const groupWidths=groups.map(group=>Math.max(100,(group.entries.length-1)*32+25+12,Math.min(160,String(group.title).length*12)));
        const groupStarts=[];let cursor=48;for(const groupWidth of groupWidths){groupStarts.push(cursor);cursor+=groupWidth+24;}
        const width=cursor-24+16,height=265;
        const svg=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','考验小任务分组得分，纵轴0至100分');svg.style.width=`${width}px`;svg.style.maxWidth='none';scroll.appendChild(svg);
        const element=(tag,attrs,text)=>{const node=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=String(text);svg.appendChild(node);return node;};
        for(let score=0;score<=100;score+=20){const y=215-score*1.75;element('line',{x1:40,y1:y,x2:width-10,y2:y,stroke:'var(--background-modifier-border)','stroke-dasharray':'4 4'});element('text',{x:32,y:y+4,'text-anchor':'end',fill:'var(--text-muted)','font-size':12},score);}
        groups.forEach((group,index)=>{const start=groupStarts[index]+(groupWidths[index]-((group.entries.length-1)*32+25))/2,colors=['#efb1bc','#df7d92','#bd4e68'];group.entries.forEach((entry,j)=>{const x=start+j*32,y=215-entry.score*1.75;const rect=element('rect',{x,y,width:25,height:entry.score*1.75,rx:5,fill:colors[j%colors.length]});const title=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`${group.title} · ${entry.title}：${entry.score}`;rect.appendChild(title);element('text',{x:x+12.5,y:y-7,'text-anchor':'middle',fill:'#a62f46','font-size':13,'font-weight':600},entry.score);});element('text',{x:start+(group.entries.length-1)*16+12,y:240,'text-anchor':'middle',fill:'var(--text-normal)','font-size':12},group.title);});
    }
}
