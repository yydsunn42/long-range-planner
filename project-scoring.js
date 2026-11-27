function getLrpScoringSettings(project) {
    const value = project?.scoring || {};
    const regularWeight = value.regularWeight ?? 60;
    const examWeight = value.examWeight ?? 40;
    const valid = [regularWeight,examWeight].every(weight => typeof weight === 'number' && Number.isFinite(weight) && weight >= 0 && weight <= 100) && Math.abs(regularWeight + examWeight - 100) < 0.000001;
    return {regularBasis:value.regularBasis === 'task' ? 'task' : 'subtask',enabled:value.enabled === true,regularWeight:valid?regularWeight:60,examWeight:valid?examWeight:40};
}
function validateLrpScoringSettings(value) {
    if (value.regularWeight === '' || value.examWeight === '') throw new Error('请填写平时分和考验分占比。');
    const regularWeight = Number(value.regularWeight ?? 60), examWeight = Number(value.examWeight ?? 40);
    if (![regularWeight,examWeight].every(weight => Number.isFinite(weight) && weight >= 0 && weight <= 100) || Math.abs(regularWeight + examWeight - 100) > 0.000001) throw new Error('平时分与考验分占比须在0%至100%之间，合计100%。');
    if (value.regularBasis !== undefined && !['task','subtask'].includes(value.regularBasis)) throw new Error('请选择平时分计分对象。');
    return {enabled:value.enabled === true,regularWeight,examWeight,regularBasis:value.regularBasis || 'subtask'};
}
function isLrpAssessmentTask(task,tasks) {
    const byId=new Map(tasks.map(item=>[item.id,item])),seen=new Set();
    while(task && !seen.has(task.id)){if(task.lrpAssessment===true)return true;seen.add(task.id);task=byId.get(task.parentId);}
    return false;
}
function getLrpEntryReview(entry) {
    const review=entry.item.reviewScore;
    return review ? {...review,category:entry.assessment?'exam':'regular'} : review;
}
async function addLrpAssessmentTask(plugin,projectId,title='新考验') {
    const root=getLrpReviewRoot(plugin),project=root.settings.projects.find(item=>item.id===projectId);
    if(!project)throw new Error('项目不存在');
    const task={id:crypto.randomUUID(),title,status:'Not Started',priority:'Medium',completed:false,parentId:null,lrpAssessment:true,createdDate:getTodayDate(),lastModifiedDate:getTodayDate(),subtasks:[]};
    const store=root.taskStore,before=[...(store.getAllForProject(projectId)||[])],timestamp=project.lastUpdatedDate;
    try{await store.addTaskToProject(task,projectId);return task;}
    catch(error){store.tasksByProject[projectId]=before;if(store.activeProjectId===projectId)store.tasks=before;store.rebuildIndex();project.lastUpdatedDate=timestamp;throw error;}
}
function getLrpSubtaskReviewEntries(tasks) {
    const entries = [];
    const byId = new Map(tasks.map(task => [task.id,task]));
    const parents = new Set(tasks.filter(task => task.parentId).map(task => task.parentId));
    const excluded = task => {
        const seen = new Set();
        while (task && !seen.has(task.id)) {
            if (task.planningDisposition === 'abandoned' || task.status === 'Abandoned') return true;
            seen.add(task.id); task = byId.get(task.parentId);
        }
        return false;
    };
    for (const owner of tasks) {
        if (excluded(owner)) continue;
        if (owner.parentId && !parents.has(owner.id) && !owner.subtasks?.length) {
            entries.push({key:JSON.stringify([owner.id,null]),ownerId:owner.id,subId:null,title:owner.title || '未命名子任务',parentTitle:byId.get(owner.parentId)?.title || '',completed:isLrpTaskComplete(owner,tasks),item:owner,assessment:isLrpAssessmentTask(owner,tasks)});
        }
        for (const sub of owner.subtasks || []) {
            if (sub.planningDisposition === 'abandoned' || sub.status === 'Abandoned') continue;
            entries.push({key:JSON.stringify([owner.id,sub.id]),ownerId:owner.id,subId:sub.id,title:sub.title || '未命名子任务',parentTitle:owner.title || '',completed:Boolean(sub.completed),item:sub,assessment:isLrpAssessmentTask(owner,tasks)});
        }
    }
    return entries;
}
// Large tasks are project roots; nested leaves remain small tasks.
function getLrpLargeReviewEntries(tasks) {
    return tasks.filter(task => !task.parentId && task.planningDisposition !== 'abandoned' && task.status !== 'Abandoned').map(task => ({key:JSON.stringify([task.id,null]),ownerId:task.id,subId:null,title:task.title || '未命名任务',parentTitle:'',completed:isLrpTaskComplete(task,tasks),item:task,large:true,assessment:task.lrpAssessment===true}));
}
function getLrpReviewEntries(project,tasks) {
    return [...getLrpSubtaskReviewEntries(tasks),...getLrpLargeReviewEntries(tasks).filter(entry=>entry.assessment || getLrpScoringSettings(project).regularBasis==='task')];
}
function getLrpLargeTaskScores(project,tasks) {
    const config=getLrpScoringSettings(project), children=getLrpSubtaskReviewEntries(tasks).filter(entry=>!entry.assessment), byId=new Map(tasks.map(task=>[task.id,task]));
    const rootId=entry=>{let task=byId.get(entry.ownerId);const seen=new Set();while(task?.parentId && !seen.has(task.id)){seen.add(task.id);task=byId.get(task.parentId);}return task?.id;};
    const mean=items=>items.length ? items.reduce((sum,value)=>sum+value,0)/items.length : null;
    return getLrpLargeReviewEntries(tasks).filter(entry=>!entry.assessment).map(entry=>{
        const leaves=children.filter(child=>rootId(child)===entry.ownerId);
        const valid=leaves.filter(child=>child.completed && isValidLrpSubtaskScore(child.item.reviewScore));
        const regular=config.regularBasis==='task' ? (entry.completed && isValidLrpSubtaskScore(entry.item.reviewScore) && !entry.assessment ? entry.item.reviewScore.score : null) : mean(valid.map(child=>child.item.reviewScore.score));
        const exam=mean(valid.filter(child=>child.item.reviewScore.category==='exam').map(child=>child.item.reviewScore.score));
        return {...entry,regularAverage:regular,examAverage:exam,childAverage:mean(valid.map(child=>child.item.reviewScore.score)),pending:leaves.filter(child=>child.completed && !isValidLrpSubtaskScore(child.item.reviewScore)).length};
    });
}
function isValidLrpSubtaskScore(score) {
    return score && score.pending !== true && typeof score.score === 'number' && Number.isFinite(score.score) && score.score >= 0 && score.score <= 100 && ['regular','exam'].includes(score.category);
}
function getLrpProjectScores(project,tasks) {
    const config = getLrpScoringSettings(project);
    const entries = getLrpReviewEntries(project,tasks).filter(entry => entry.completed);
    const regular = [], exam = [];
    let pending = 0;
    for (const entry of entries) {
        const review = getLrpEntryReview(entry);
        if (!isValidLrpSubtaskScore(review)) {if(!entry.assessment || !entry.large)pending++;continue;}
        if (entry.assessment && !entry.large) exam.push(review.score);
        if (!entry.assessment && Boolean(entry.large) === (config.regularBasis === 'task')) regular.push(review.score);
    }
    const mean = list => list.length ? list.reduce((sum,value) => sum + value,0) / list.length : null;
    const regularAverage = mean(regular), examAverage = mean(exam);
    const ready = (!config.regularWeight || regularAverage !== null) && (!config.examWeight || examAverage !== null);
    const total = config.enabled && ready ? (regularAverage ?? 0)*config.regularWeight/100 + (examAverage ?? 0)*config.examWeight/100 : null;
    return {...config,regularAverage,examAverage,total,pending,regularCount:regular.length,examCount:exam.length,entries};
}
function getLrpReviewRoot(plugin) { return plugin.lrpRootPlugin || plugin; }
function resolveLrpScoreTarget(plugin,reference) {
    const root = getLrpReviewRoot(plugin);
    const project = (root.settings.projects || []).find(project => project.id === reference.projectId);
    if (!project) return null;
    const tasks = root.taskStore.getAllForProject(project.id) || [];
    const entry = [...getLrpSubtaskReviewEntries(tasks),...getLrpLargeReviewEntries(tasks)].find(entry => entry.ownerId === reference.ownerId && entry.subId === (reference.subId ?? null));
    return entry ? {root,project,tasks,entry} : null;
}
// Called before a normal TaskStore update is persisted: only newly completed leaves are marked pending.
function prepareLrpSubtaskReviews(store,task,partial,projectId) {
    const project = (store.plugin.settings.projects || []).find(project => project.id === projectId);
    if (!getLrpScoringSettings(project).enabled) return [];
    const tasks = store.tasksByProject[projectId] || store.tasks;
    const previous = new Set(getLrpReviewEntries(project,tasks).filter(entry => entry.completed).map(entry => entry.key));
    const preview = tasks.map(item => ({...item,...(item.id === task.id ? partial : {}),subtasks:(item.id === task.id ? partial.subtasks ?? item.subtasks : item.subtasks)?.map(sub => ({...sub}))}));
    applyLrpProgress(preview);
    const added = getLrpReviewEntries(project,preview).filter(entry => entry.completed && !previous.has(entry.key));
    // Root roll-up completion also requires a fresh direct score in task mode.
    for (const entry of added.filter(entry => entry.large && entry.ownerId !== task.id)) {
        const root=tasks.find(item=>item.id===entry.ownerId);
        root.reviewScore={...root.reviewScore,pending:true};
    }
    for (const entry of added.filter(entry => entry.ownerId === task.id)) {
        if (entry.subId !== null) {
            partial.subtasks = (partial.subtasks || task.subtasks || []).map(sub => sub.id === entry.subId ? {...sub,reviewScore:{...sub.reviewScore,pending:true}} : sub);
        } else partial.reviewScore = {...task.reviewScore,pending:true};
    }
    return added.map(entry => ({projectId,ownerId:entry.ownerId,subId:entry.subId}));
}
async function saveLrpSubtaskScore(plugin,reference,draft) {
    const target = resolveLrpScoreTarget(plugin,reference);
    if (!target || !target.entry.completed) throw new Error('子任务已删除、放弃或恢复为未完成，请刷新后重试。');
    if (!getLrpScoringSettings(target.project).enabled) throw new Error('此项目已关闭评分复盘。');
    if (typeof draft.score === 'string' && !draft.score.trim() || draft.score === '' || draft.score === null || draft.score === undefined || !Number.isFinite(Number(draft.score)) || Number(draft.score) < 0 || Number(draft.score) > 100) throw new Error('请输入0至100之间的分数。');
    if (target.entry.large && !target.entry.assessment && getLrpScoringSettings(target.project).regularBasis === 'subtask') throw new Error('平时分按小任务统计，大任务平时分自动取均分。');
    if (draft.category !== (target.entry.assessment?'exam':'regular')) throw new Error('普通任务只计平时分，考验分请在独立考验区评分。');
    const item = target.entry.item;
    const had = Object.prototype.hasOwnProperty.call(item,'reviewScore'), before = item.reviewScore;
    item.reviewScore = {score:Number(draft.score),category:draft.category,note:String(draft.note || '').trim(),updatedAt:new Date().toISOString(),pending:false};
    try { await target.root.taskStore.writeProjectFile(target.project.id,target.tasks); }
    catch (error) {if (had) item.reviewScore = before; else delete item.reviewScore;throw error;}
    target.root.taskStore.refresh();
    return item.reviewScore;
}
class LrpSubtaskScoreModal extends obsidian.Modal {
    constructor(plugin,reference,onDone) {super(plugin.app);this.plugin=plugin;this.reference=reference;this.onDone=onDone;}
    onOpen() {
        const target = resolveLrpScoreTarget(this.plugin,this.reference);
        if (!target || !target.entry.completed || !getLrpScoringSettings(target.project).enabled) {this.close();return;}
        const content = this.contentEl;content.empty();
        content.createEl('h2',{text:target.entry.large?'大任务评分与复盘':'子任务评分与复盘'});
        content.createEl('p',{text:`${target.project.name} · ${target.entry.parentTitle}`,cls:'lrp-project-overview-placeholder'});
        content.createEl('h3',{text:target.entry.title});
        const form = content.createEl('form',{cls:'lrp-subtask-score-form'});
        const categoryLabel = form.createEl('label',{text:'评分类别（由所在区域决定）'});
        const category = categoryLabel.createEl('select',{attr:{'aria-label':'评分类别'}});
        category.createEl('option',{text:target.entry.assessment?'考验分':'平时分',value:target.entry.assessment?'exam':'regular'});
        category.value=target.entry.assessment?'exam':'regular';category.disabled=true;
        form.setAttribute('data-category',category.value);
        const scoreLabel = form.createEl('label',{text:'得分（满分100分）'});
        const score = scoreLabel.createEl('input',{attr:{type:'number',min:'0',max:'100',step:'any',required:'true','aria-label':'子任务得分'}});
        score.value = target.entry.item.reviewScore?.score !== undefined ? String(target.entry.item.reviewScore.score) : '';
        const noteLabel = form.createEl('label',{text:'复盘（可选）'});
        const note = noteLabel.createEl('textarea',{attr:{rows:'4',placeholder:'做得怎么样，下次如何改进？','aria-label':'子任务复盘'}});note.value = target.entry.item.reviewScore?.note || '';
        const errorText = form.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});
        const actions = form.createDiv('lrp-new-project-actions');
        const later = actions.createEl('button',{text:'稍后评分',attr:{type:'button'}});
        const save = actions.createEl('button',{text:'保存评分',cls:'mod-cta',attr:{type:'submit'}});
        later.onclick = () => this.close();
        form.onsubmit = async event => {
            event.preventDefault();if(save.disabled)return;save.disabled=true;later.disabled=true;
            try {await saveLrpSubtaskScore(this.plugin,this.reference,{score:score.value,category:category.value,note:note.value});this.close();}
            catch(error) {errorText.textContent=error.message || '保存失败，请重试。';save.disabled=false;later.disabled=false;}
        };
        score.focus();
    }
    onClose() {this.contentEl.empty();const done=this.onDone;this.onDone=null;done?.();}
}
function enqueueLrpSubtaskReviews(plugin,references) {
    const root = getLrpReviewRoot(plugin);
    const queue = root.lrpScoreQueue ||= [];
    const key = reference => JSON.stringify([reference.projectId,reference.ownerId,reference.subId ?? null]);
    for (const reference of references) {
        if (root.lrpActiveScoreKey !== key(reference) && !queue.some(item => key(item) === key(reference))) queue.push(reference);
    }
    const pump = () => {
        if (root.lrpScoringUnloaded || root.lrpActiveScoreKey) return;
        let reference,target;
        while ((reference=queue.shift())) {
            target=resolveLrpScoreTarget(root,reference);
            if(target && target.entry.completed && getLrpScoringSettings(target.project).enabled)break;
            target=null;
        }
        if(!reference || !target)return;
        root.lrpActiveScoreKey=key(reference);
        const done=()=>{root.lrpActiveScoreKey=null;root.lrpActiveScoreModal=null;setTimeout(pump,0);};
        try {
            if(typeof root.lrpReviewPrompt==='function')root.lrpReviewPrompt(reference,done);
            else {const modal=new LrpSubtaskScoreModal(root,reference,done);root.lrpActiveScoreModal=modal;modal.open();}
        }catch(error){console.error(error);done();}
    };
    pump();
}
function addLrpScoringSettingsEditor(form,project) {
    const config=getLrpScoringSettings(project);
    const section=form.createDiv('lrp-scoring-settings');
    const label=section.createEl('label',{cls:'lrp-scoring-toggle'});
    const enabled=label.createEl('input',{attr:{type:'checkbox'}});enabled.checked=config.enabled;
    label.createSpan({text:'启用任务评分与复盘'});
    const weights=section.createDiv('lrp-scoring-weights');
    const inputs={};
    for(const [key,title] of [['regularWeight','平时分占比'],['examWeight','考验分占比']]){
        const field=weights.createEl('label',{text:title});
        const input=field.createEl('input',{attr:{type:'number',min:'0',max:'100',step:'1','aria-label':title}});input.value=String(config[key]);
        field.createSpan({text:'%'});inputs[key]=input;
    }
    const basisLabel=weights.createEl('label',{text:'平时分计分对象'});
    const basis=basisLabel.createEl('select',{attr:{'aria-label':'平时分计分对象'}});
    basis.createEl('option',{text:'小任务（大任务自动显示均分）',value:'subtask'});
    basis.createEl('option',{text:'大任务（小任务评分仅作参考）',value:'task'});basis.value=config.regularBasis;
    const update=()=>{basis.disabled=!enabled.checked;weights.hidden=!enabled.checked;for(const input of Object.values(inputs))input.disabled=!enabled.checked;};
    enabled.onchange=update;update();
    inputs.regularWeight.oninput=()=>{const value=Number(inputs.regularWeight.value);if(inputs.regularWeight.value!=='' && Number.isFinite(value) && value>=0 && value<=100)inputs.examWeight.value=String(100-value);};
    inputs.examWeight.oninput=()=>{const value=Number(inputs.examWeight.value);if(inputs.examWeight.value!=='' && Number.isFinite(value) && value>=0 && value<=100)inputs.regularWeight.value=String(100-value);};
    section.createEl('p',{text:'平时分可按小任务或大任务计分；按小任务时大任务自动显示均分，按大任务时只统计大任务平时分，小任务仍可评分作参考。普通任务均为平时分；考验分仅统计独立考验区的小任务，考验大任务评分仅作参考。切换或关闭均保留已有评分。',cls:'lrp-project-overview-placeholder'});
    return ()=>enabled.checked ? {enabled:true,regularWeight:inputs.regularWeight.value,examWeight:inputs.examWeight.value,regularBasis:basis.value} : {...config,enabled:false};
}
function renderLrpProjectScores(parent,plugin,project) {
    if(!getLrpScoringSettings(project).enabled)return;
    const root=getLrpReviewRoot(plugin),tasks=root.taskStore.getAllForProject(project.id) || [];
    const scores=getLrpProjectScores(project,tasks);
    const section=parent.createDiv('lrp-project-score-section');section.createEl('h4',{text:'打分复盘'});
    const stats=section.createDiv('lrp-project-score-stats');
    const format=value=>value===null?'待评分':`${Number(value.toFixed(2))} 分`;
    stats.createSpan({text:`平时分（${scores.regularWeight}%）：${format(scores.regularAverage)} · ${scores.regularCount}项`});
    stats.createSpan({text:`考验分（${scores.examWeight}%）：${format(scores.examAverage)} · ${scores.examCount}项`});
    stats.createEl('strong',{text:`${scores.pending?'当前加权分':'加权总分'}：${format(scores.total)}`});
    section.createEl('p',{text:`已完成任务待评分：${scores.pending} 项。平时分按${scores.regularBasis==='task'?'大任务':'小任务'}计分，考验分按小任务计分。未评分不按0分计算；未完成及已放弃记录不计分。`,cls:'lrp-project-overview-placeholder'});
    renderLrpLargeScoreRows(section,plugin,project,tasks,false);
    if(!scores.entries.length){section.createEl('p',{text:'完成可评分的任务后会自动弹出评分窗口。'});return;}
    const history=section.createEl('details',{cls:'lrp-score-history'});history.createEl('summary',{text:'任务评分记录与补评'});
    const list=history.createDiv('lrp-score-history-list');
    for(const entry of scores.entries){
        const row=list.createDiv('lrp-score-history-row'),review=getLrpEntryReview(entry);
        row.createEl('strong',{text:`${entry.large?'大任务 · ':''}${entry.title}`});
        if(entry.parentTitle)row.createSpan({text:entry.parentTitle,cls:'lrp-project-overview-placeholder'});
        row.createSpan({text:isValidLrpSubtaskScore(review)?`${review.category==='regular'?'平时分':'考验分'} · ${review.score} 分${!entry.large && review.category==='regular' && scores.regularBasis==='task'?'（仅作参考，不计总分）':''}`:'待评分'});
        if(review?.note)row.createEl('p',{text:review.note});
        const button=row.createEl('button',{text:isValidLrpSubtaskScore(review)?'修改评分':'评分',attr:{type:'button'}});
        button.onclick=event=>{event.stopPropagation();enqueueLrpSubtaskReviews(root,[{projectId:project.id,ownerId:entry.ownerId,subId:entry.subId}]);};
    }
}

function renderLrpLargeScoreRows(parent,plugin,project,tasks) {
    const sections=parent.createDiv('lrp-score-lists');
    const regular=getLrpLargeTaskScores(project,tasks).filter(entry=>entry.regularAverage!==null).map(entry=>({title:entry.title,value:entry.regularAverage}));
    const exam=getLrpSubtaskReviewEntries(tasks).filter(entry=>entry.assessment && entry.completed && isValidLrpSubtaskScore(entry.item.reviewScore)).map(entry=>({title:`${entry.parentTitle} · ${entry.title}`,value:entry.item.reviewScore.score}));
    for(const [category,title,rows] of [['regular','平时 · 大任务',regular],['exam','考验 · 小任务',exam]]){
        if(!rows.length)continue;
        const list=sections.createDiv(`lrp-score-category-list is-${category}`);list.createEl('h4',{text:title});
        for(const entry of rows){
            const row=list.createDiv('lrp-score-list-row');row.createSpan({text:entry.title,attr:{title:entry.title}});
            row.createEl('progress',{attr:{max:'100',value:String(entry.value),'aria-label':`${entry.title} ${title} ${entry.value}`}});
            row.createEl('strong',{text:String(Number(entry.value.toFixed(2)))});
        }
    }
}
function renderLrpScoreAnalysis(parent,plugin,project,tasks) {
    if(!getLrpScoringSettings(project).enabled)return;
    const scores=getLrpProjectScores(project,tasks);
    if(!scores.entries.some(entry=>isValidLrpSubtaskScore(entry.item.reviewScore)))return;
    const section=parent.createDiv('lrp-score-analysis');
    const heading=section.createDiv('lrp-score-analysis-heading');heading.createEl('h3',{text:'评分分析'});
    heading.createSpan({text:`平时 ${scores.regularWeight}% · 考验 ${scores.examWeight}%${scores.pending?` · ${scores.pending}项待评`:''}`,cls:'lrp-project-overview-placeholder'});
    const stats=section.createDiv('lrp-score-metrics');
    for(const [title,value,category] of [[scores.pending?'当前加权分':'加权总分',scores.total,'total'],['平时均分',scores.regularAverage,'regular'],['考验均分',scores.examAverage,'exam']]){
        const metric=stats.createEl('button',{cls:`lrp-score-metric is-${category}`,attr:{type:'button'}});
        metric.onclick=event=>{event.stopPropagation();new LrpScoreAnalysisModal(plugin,project.id,category).open();};metric.createSpan({text:title});metric.createEl('strong',{text:value===null?'—':String(Number(value.toFixed(2)))});
    }
}
function renderLrpBoardScore(parent,plugin,task,subId=null) {
    const root=getLrpReviewRoot(plugin),target=getLrpTaskTarget(root,task);
    if(!target || !getLrpScoringSettings(target.project).enabled)return;
    const reference={projectId:target.project.id,ownerId:task.id,subId};
    const entry=[...getLrpSubtaskReviewEntries(target.tasks),...getLrpLargeReviewEntries(target.tasks)].find(entry=>entry.ownerId===task.id && entry.subId===subId);
    if(!entry)return;
    const config=getLrpScoringSettings(target.project),review=getLrpEntryReview(entry);
    if(entry.large && !entry.assessment && config.regularBasis==='subtask'){
        const derived=getLrpLargeTaskScores(target.project,target.tasks).find(row=>row.ownerId===task.id);
        if(derived && derived.regularAverage!==null){parent.createSpan({text:String(Number(derived.regularAverage.toFixed(2))),cls:'lrp-score-chip is-regular',attr:{title:'平时分：小任务均分（自动计算）','aria-label':'大任务自动平时均分'}});}
        return;
    }
    const valid=isValidLrpSubtaskScore(review) && entry.completed && !(entry.large && config.regularBasis==='subtask' && review.category==='regular');
    const category=valid?review.category:'';
    const button=parent.createEl('button',{text:valid?String(Number(review.score.toFixed(2))):'评分',cls:`lrp-score-chip ${category?'is-'+category:'is-pending'}`,attr:{type:'button',title:valid?`${category==='regular'?'平时分':'考验分'}${entry.large && entry.assessment?'（仅作参考，不计总分）':''}：${review.score}，点击修改`:'选择类别并评分','aria-label':`${entry.title}评分`}});
    button.disabled=!entry.completed;
    if(!entry.completed)button.title='完成后可评分';
    button.onclick=event=>{event.preventDefault();event.stopPropagation();enqueueLrpSubtaskReviews(root,[reference]);};
}

async function renderLrpAssessmentColumn(parent,view,tasks) {
    const column=parent.createDiv('planner-board-column lrp-assessment-column');
    const header=column.createDiv('planner-board-column-header');header.createDiv({cls:'planner-board-column-title',text:'考验'});header.createDiv({cls:'planner-board-column-count',text:String(tasks.length)});
    const content=column.createDiv('planner-board-column-content');content.setAttribute('data-bucket-id','assessment');
    const add=content.createDiv({text:'+ 添加考验',cls:'planner-board-add-card',attr:{role:'button',tabindex:'0'}});
    const error=content.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});
    add.onclick=async event=>{event.stopPropagation();if(add.disabled)return;add.disabled=true;error.textContent='';try{await addLrpAssessmentTask(view.plugin,view.plugin.settings.activeProjectId);}catch(problem){error.textContent=problem.message || '创建失败，请重试。';add.disabled=false;}};
    add.onkeydown=event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();if(!add.disabled)void add.onclick(event);}};
    for(const task of tasks)await view.renderCard(content,task);
}

class LrpScoreAnalysisModal extends obsidian.Modal {
    constructor(plugin,projectId,category){super(plugin.app);this.plugin=getLrpReviewRoot(plugin);this.projectId=projectId;this.category=category;}
    onOpen(){
        const project=this.plugin.settings.projects.find(item=>item.id===this.projectId);if(!project){this.close();return;}
        this.modalEl?.classList.add('lrp-score-analysis-modal');
        if(this.modalEl)this.modalEl.style.width='min(540px,92vw)';
        const host=this.contentEl.createDiv('lrp-score-analysis-content');host.style.setProperty('--lrp-project-color',project.calendarColor || '#9874b5');
        renderLrpDetailedScoreAnalysis(host,project,this.plugin.taskStore.getAllForProject(project.id)||[],this.category);
        if(this.modalEl && this.category==='exam'){const chart=host.querySelector('svg');if(chart){const width=Number(chart.getAttribute('viewBox').split(' ')[2]);this.modalEl.style.width=`min(${Math.min(540,Math.max(320,width+48))}px,92vw)`;}}
    }
    onClose(){this.contentEl.empty();}
}
