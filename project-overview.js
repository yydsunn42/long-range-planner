const LRP_PROJECT_OVERVIEW_FIELDS = [
    ['introduction', '简介与目标', '这个项目是什么，为什么要做，希望达成什么？'],
    ['approach', '实现思路', '准备如何实现，需要哪些资源？'],
    ['plan', '阶段规划', '分几个阶段推进，有哪些关键节点？'],
];
function getLrpProjectBriefText(project, key) {
    if (key === 'introduction') return [project.overview?.introduction,project.overview?.goals].filter(Boolean).join('\n\n');
    return project.overview?.[key] || '';
}
function formatLrpProjectDuration(duration) {
    return [['years','年'],['months','个月'],['days','天']].filter(([key]) => Number(duration?.[key]) > 0).map(([key,unit]) => `${duration[key]} ${unit}`).join(' ') || '未设置';
}
async function saveLrpProjectOverview(plugin, projectId, draft) {
    const project = (plugin.settings.projects || []).find(item => item.id === projectId);
    if (!project) throw new Error('项目已不存在，请刷新后重试。');
    const name = String(draft.name || '').trim();
    if (!name) throw new Error('请输入项目名称。');
    if (plugin.settings.projects.some(item => item.id !== projectId && item.name === name)) throw new Error('已有同名项目，请换一个名称。');
    let duration = project.estimatedDuration;
    if (draft.estimatedDuration !== undefined) {
        duration = {};
        for (const key of ['years','months','days']) {
            const value = Number(draft.estimatedDuration?.[key] ?? 0);
            if (!Number.isInteger(value) || value < 0 || value > 9999) throw new Error('预计时间请填写0至9999之间的整数。');
            duration[key] = value;
        }
    }
    const scoring = draft.scoring !== undefined ? validateLrpScoringSettings(draft.scoring) : project.scoring;
    const before = {name:project.name, overview:project.overview, estimatedDuration:project.estimatedDuration, scoring:project.scoring, lastUpdatedDate:project.lastUpdatedDate};
    const had = Object.fromEntries(Object.keys(before).map(key => [key,Object.prototype.hasOwnProperty.call(project,key)]));
    project.name = name;
    if (draft.scoring !== undefined) project.scoring = scoring;
    if (draft.estimatedDuration !== undefined) project.estimatedDuration = duration;
    project.overview = {...project.overview};
    for (const [key] of LRP_PROJECT_OVERVIEW_FIELDS) project.overview[key] = String(draft[key] || '').trim();
    delete project.overview.goals;
    project.lastUpdatedDate = new Date().toISOString();
    try { await plugin.saveSettings(); }
    catch (error) {
        for (const key of Object.keys(before)) { if (had[key]) project[key] = before[key]; else delete project[key]; }
        throw error;
    }
    return project;
}
class LrpProjectOverviewModal extends obsidian.Modal {
    constructor(plugin, projectId, onSaved) {
        super(plugin.app);
        this.plugin = plugin; this.projectId = projectId; this.onSaved = onSaved;
    }
    onOpen() {
        const project = (this.plugin.settings.projects || []).find(item => item.id === this.projectId);
        if (!project) { this.close(); return; }
        this.modalEl?.classList.add('lrp-project-overview-modal');
        const content = this.contentEl; content.empty();
        content.style.setProperty('--lrp-project-color',project.calendarColor || '#9874b5');
        content.createEl('h2',{text:'编辑项目'});
        const form = content.createEl('form',{cls:'lrp-project-overview-form'});
        const label = form.createEl('label',{text:'项目名称'});
        const name = label.createEl('input',{attr:{type:'text',required:'true','aria-label':'项目名称'}}); name.value = project.name;
        const grid = form.createDiv('lrp-project-overview-form-fields');
        const inputs = {};
        for (const [key,title,hint] of LRP_PROJECT_OVERVIEW_FIELDS) {
            const card = grid.createEl('label',{cls:'lrp-project-overview-field'});
            card.createEl('strong',{text:title});
            const input = card.createEl('textarea',{attr:{rows:'5',placeholder:hint,'aria-label':title}});
            input.value = getLrpProjectBriefText(project,key); inputs[key] = input;
        }
        const durationCard = form.createDiv('lrp-project-duration-editor');
        durationCard.createEl('strong',{text:'预计所需时间'});
        const durationFields = durationCard.createDiv('lrp-project-duration-fields');
        const durationInputs = {};
        for (const [key,title] of [['years','年'],['months','个月'],['days','天']]) {
            const label = durationFields.createEl('label');
            const input = label.createEl('input',{attr:{type:'number',min:'0',max:'9999',step:'1','aria-label':`预计时间（${title}）`}});
            input.value = String(project.estimatedDuration?.[key] || 0);
            label.createSpan({text:title});durationInputs[key] = input;
        }
        durationCard.createEl('p',{text:'可组合填写，如1年2个月12天；全部为0表示未设置，不修改任务日期。',cls:'lrp-project-overview-placeholder'});
        const readScoringSettings = addLrpScoringSettingsEditor(form,project);
        const errorText = form.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});
        const actions = form.createDiv('lrp-new-project-actions');
        const cancel = actions.createEl('button',{text:'取消',attr:{type:'button'}});
        const save = actions.createEl('button',{text:'保存项目',cls:'mod-cta',attr:{type:'submit'}});
        cancel.onclick = () => this.close();
        form.onsubmit = async event => {
            event.preventDefault(); if (save.disabled) return;
            save.disabled = true; cancel.disabled = true; errorText.textContent = '';
            const draft = {name:name.value,scoring:readScoringSettings(),estimatedDuration:Object.fromEntries(Object.entries(durationInputs).map(([key,input]) => [key,input.value]))};
            for (const [key] of LRP_PROJECT_OVERVIEW_FIELDS) draft[key] = inputs[key].value;
            try { await saveLrpProjectOverview(this.plugin,this.projectId,draft); }
            catch (error) { errorText.textContent = error.message || '保存失败，请重试。'; save.disabled = false; cancel.disabled = false; return; }
            this.close();
            try { if (this.onSaved) await this.onSaved(); }
            catch (error) { console.error(error); new obsidian.Notice('项目已保存，刷新面板后即可查看。'); }
        };
        name.focus();
    }
    onClose() { this.contentEl.empty(); }
}
function addLrpProjectEditButton(parent, plugin, project, onSaved) {
    const button = parent.createEl('button',{text:'编辑项目',cls:'lrp-project-edit-btn',attr:{type:'button',title:'编辑项目名称、简介、目标与规划'}});
    const color=project.calendarColor || '#9874b5';
    button.style.setProperty('--lrp-project-edit-color',color);
    button.onclick = event => {event.preventDefault();event.stopPropagation();new LrpProjectOverviewModal(plugin,project.id,onSaved).open();};
    button.ondblclick = event => event.stopPropagation();
    return button;
}
function renderLrpProjectOverview(parent, plugin, project, onSaved) {
    const panel = parent.createEl('details',{cls:'lrp-project-overview'});
    panel.style.setProperty('--lrp-project-color',project.calendarColor || '#9874b5');
    const duration = formatLrpProjectDuration(project.estimatedDuration);
    const filled = LRP_PROJECT_OVERVIEW_FIELDS.some(([key]) => getLrpProjectBriefText(project,key)) || duration !== '未设置';
    panel.open = false;
    const summary = panel.createEl('summary');
    summary.createSpan({text:filled?'项目概括':'项目概括 · 添加简介与目标、规划'});
    const tagBox = summary.createSpan({cls:'lrp-project-summary-tags'});
    const projectTags = getLrpProjectTags(plugin.settings, project.id);
    if (projectTags.length) {
        for (const tag of projectTags) {
            const chip = tagBox.createEl('button',{text:tag.name,cls:'lrp-project-summary-tag',attr:{type:'button',title:'编辑项目标签'}});
            chip.style.setProperty('--lrp-tag-color',tag.color);
            chip.style.backgroundColor=tag.color;
            chip.style.backgroundImage='none';
            chip.style.color='#000';
            chip.style.border='none';
            chip.style.boxShadow='none';
            chip.onclick = (event) => {event.preventDefault();event.stopPropagation();new LrpProjectTagModal(plugin,project,tag,onSaved).open();};
        }
    }
    else {
        const addTag = tagBox.createEl('button',{text:'新建标签',cls:'lrp-project-summary-tag-add',attr:{type:'button',title:'为本项目新建标签'}});
        addTag.onclick = (event) => {event.preventDefault();event.stopPropagation();new LrpProjectTagModal(plugin,project,null,onSaved).open();};
    }
    const durationBox = summary.createSpan({cls:'lrp-project-overview-duration'});
    durationBox.createSpan({text:'预计所需时间',cls:'lrp-project-overview-duration-label'});
    durationBox.createSpan({text:duration,cls:'lrp-project-overview-duration-value'});
    const grid = panel.createDiv('lrp-project-overview-content');
    // Left column stacks 简介与目标 and 实现思路; 阶段规划 fills the right column beside both.
    for (const [key,title,hint] of [LRP_PROJECT_OVERVIEW_FIELDS[0],LRP_PROJECT_OVERVIEW_FIELDS[1]]) {
        const card = grid.createDiv('lrp-project-overview-section lrp-project-overview-brief');
        card.createEl('h4',{text:title});
        card.createEl('p',{text:getLrpProjectBriefText(project,key) || hint,cls:getLrpProjectBriefText(project,key)?'':'lrp-project-overview-placeholder'});
    }
    const stageCard = grid.createDiv('lrp-project-overview-section lrp-project-overview-stage');
    stageCard.createEl('h4',{text:LRP_PROJECT_OVERVIEW_FIELDS[2][1]});
    stageCard.createEl('p',{text:getLrpProjectBriefText(project,'plan') || LRP_PROJECT_OVERVIEW_FIELDS[2][2],cls:getLrpProjectBriefText(project,'plan')?'':'lrp-project-overview-placeholder'});
    const scoringForm=grid.createEl('form',{cls:'lrp-overview-scoring-form'});
    const readScoring=addLrpScoringSettingsEditor(scoringForm,project);
    const error=scoringForm.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});
    const save=scoringForm.createEl('button',{text:'保存评分设置',cls:'lrp-overview-save-scoring',attr:{type:'submit'}});
    addLrpProjectEditButton(scoringForm,plugin,project,onSaved);
    scoringForm.onsubmit=async event=>{
        event.preventDefault();event.stopPropagation();if(save.disabled)return;save.disabled=true;
        try{
            const draft={name:project.name,scoring:readScoring()};
            for(const [key] of LRP_PROJECT_OVERVIEW_FIELDS)draft[key]=getLrpProjectBriefText(project,key);
            await saveLrpProjectOverview(plugin,project.id,draft);if(onSaved)await onSaved();
        }catch(problem){error.textContent=problem.message || '保存失败，请重试。';}
        finally{save.disabled=false;}
    };
    return panel;
}
