function getLrpBucketNumber(bucket) {
    const match=String(bucket.name).match(/第\s*(\d+)\s*周|Week\s*(\d+)/i);
    return match ? Number(match[1] || match[2]) : 0;
}
function getLrpNextBucketNumber(project,buckets=project.buckets || []) {
    return Math.max(0,...buckets.map(getLrpBucketNumber),...(project.skippedWeekNumbers || []).filter(Number.isInteger))+1;
}
function makeLrpNextBucket(project,buckets,neighbors) {
    const bucket=makePersonalBucket(buckets,Math.random,crypto.randomUUID(),neighbors);
    bucket.name=`第${getLrpNextBucketNumber(project,buckets)}周`;
    return bucket;
}
function getLrpBucketCalendar(bucket) {
    const dates=getLrpWeekDates(bucket.calendarWeek);
    if(!dates)return null;
    const info=getLrpWeekInfo(dates.start);
    return {...info,monday:dates.start,dateLabel:dates.start.slice(5).replace('-','.')};
}
/** Default dates for a new task created in this bucket: Monday to Sunday of its calendar week. */
function getLrpBucketTaskDefaults(bucket) {
    const dates=getLrpWeekDates(bucket.calendarWeek);
    return dates ? {startDate:dates.start,dueDate:dates.end} : null;
}
/** Dates a task should take when its bucket week changes, while its own dates are still empty/default. */
function getLrpBucketMoveDefaults(task,fromBucketId,toBucketId,projects=[]) {
    if(!task || !toBucketId || fromBucketId===toBucketId)return null;
    const project=projects.find(item=>(item.buckets || []).some(bucket=>bucket.id===toBucketId))
        || (fromBucketId && projects.find(item=>(item.buckets || []).some(bucket=>bucket.id===fromBucketId)));
    if(!project)return null;
    const buckets=project.buckets || [];
    const from=fromBucketId ? buckets.find(bucket=>bucket.id===fromBucketId) : null;
    const to=buckets.find(bucket=>bucket.id===toBucketId);
    if(!to)return null;
    const source=from ? getLrpBucketTaskDefaults(from) : null,target=getLrpBucketTaskDefaults(to);
    if(!target)return null;
    const start=String(task.startDate || '').slice(0,10),due=String(task.dueDate || '').slice(0,10);
    const sourceMatches=Boolean(source) && start===source.startDate && due===source.dueDate;
    // Tasks created before bucket defaults existed only carry the creation-day start date.
    const untouchedCreation=!due && Boolean(task.createdDate) && start===String(task.createdDate).slice(0,10);
    // Assessment tasks are created without dates; assigning a week group fills them in.
    const emptyDates=!start && !due;
    if(!sourceMatches && !untouchedCreation && !emptyDates)return null;
    return target;
}
async function saveLrpBucketSchedule(plugin,projectId,bucketId,draft) {
    const root=getLrpReviewRoot(plugin),project=root.settings.projects.find(item=>item.id===projectId);
    const bucket=project?.buckets?.find(item=>item.id===bucketId);
    if(!bucket)throw new Error('周分组已不存在');
    const number=Number(draft.number);
    if(!Number.isInteger(number) || number<1 || number>9999)throw new Error('项目周数请填写1至9999的整数');
    if(!draft.skip && project.buckets.some(item=>item.id!==bucketId && getLrpBucketNumber(item)===number))throw new Error('已有相同项目周数，请选择其他周数');
    if(!draft.skip && draft.calendarWeek && !getLrpWeekDates(draft.calendarWeek))throw new Error('请选择有效的实际日历周');
    const previousBuckets=project.buckets,previousSkipped=project.skippedWeekNumbers;
    const tasks=root.taskStore.getAllForProject(projectId) || [],previousTasks=tasks.map(task=>({...task}));
    let tasksWritten=false;
    try{
        if(draft.skip){
            project.skippedWeekNumbers=[...new Set([...(previousSkipped || []),number])];
            project.buckets=previousBuckets.filter(item=>item.id!==bucketId);
            for(const task of tasks)if(task.bucketId===bucketId)task.bucketId=null;
            if(tasks.some((task,index)=>task.bucketId!==previousTasks[index].bucketId)){await root.taskStore.writeProjectFile(projectId,tasks);tasksWritten=true;}
        }else{
            project.buckets=previousBuckets.map(item=>item.id===bucketId?{...item,name:`第${number}周`,calendarWeek:draft.calendarWeek || null}:item);
            // Editing the latest project week redefines what '+ next week' means.
            project.skippedWeekNumbers=(previousSkipped || []).filter(value=>value<=Math.max(...project.buckets.map(getLrpBucketNumber)));
        }
        await root.saveSettings();
    }catch(error){
        project.buckets=previousBuckets;
        if(previousSkipped===undefined)delete project.skippedWeekNumbers;else project.skippedWeekNumbers=previousSkipped;
        for(let i=0;i<tasks.length;i++){Object.assign(tasks[i],previousTasks[i]);if(!Object.prototype.hasOwnProperty.call(previousTasks[i],'bucketId'))delete tasks[i].bucketId;}
        if(tasksWritten){try{await root.taskStore.writeProjectFile(projectId,tasks);}catch(rollback){throw new Error(`保存失败，任务恢复写入失败：${rollback.message}`);}}
        throw error;
    }
    return project;
}
class LrpBucketScheduleModal extends obsidian.Modal {
    constructor(view,bucket){super(view.app);this.view=view;this.bucket=bucket;}
    onOpen(){
        const form=this.contentEl.createEl('form',{cls:'lrp-week-schedule-form'});
        form.createEl('h2',{text:'设置对应周'});
        const number=form.createEl('label',{text:'项目第几周'}).createEl('input',{attr:{type:'number',min:'1',max:'9999','aria-label':'项目周数'}});number.value=String(getLrpBucketNumber(this.bucket)||1);
        const week=form.createEl('label',{text:'对应实际日历周'}).createEl('input',{attr:{type:'week','aria-label':'对应实际日历周'}});
        const today=getLrpWeekInfo(new Date());week.value=this.bucket.calendarWeek || `${today.year}-W${String(today.week).padStart(2,'0')}`;
        const skipLabel=form.createEl('label',{cls:'lrp-week-skip'});const skip=skipLabel.createEl('input',{attr:{type:'checkbox'}});skipLabel.createSpan({text:'跳过此周'});
        const error=form.createDiv({cls:'lrp-new-project-error',attr:{role:'alert'}});
        const actions=form.createDiv('lrp-new-project-actions');const cancel=actions.createEl('button',{text:'取消',attr:{type:'button'}});const save=actions.createEl('button',{text:'保存',attr:{type:'submit'}});
        cancel.onclick=()=>this.close();skip.onchange=()=>{week.disabled=skip.checked;};
        form.onsubmit=async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;try{
            const project=await saveLrpBucketSchedule(this.view.plugin,this.view.plugin.settings.activeProjectId,this.bucket.id,{number:number.value,calendarWeek:week.value,skip:skip.checked});
            this.view.buckets=project.buckets;this.close();await this.view.render();
        }catch(problem){error.textContent=problem.message;save.disabled=false;}};
    }
    onClose(){this.contentEl.empty();}
}
function addLrpBucketScheduleHeader(header,view,bucket) {
    const calendar=getLrpBucketCalendar(bucket);
    const title=header.querySelector('.planner-board-column-title');
    if(calendar)title.createSpan({text:` / ${calendar.year} ${calendar.week}周`,cls:'lrp-bucket-calendar-label'});
    const date=header.createEl('button',{text:calendar?calendar.dateLabel:'选择周',cls:'lrp-bucket-monday',attr:{type:'button',title:'设置对应日历周、项目周数或跳周'}});
    date.onclick=event=>{event.stopPropagation();new LrpBucketScheduleModal(view,bucket).open();};
}
