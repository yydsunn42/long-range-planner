function getLrpDayEntries(plugin,date) {
  return getVisibleLrpProjects(plugin.settings).flatMap(project=>getLrpCalendarTasks(plugin.taskStore.getAllForProject(project.id) || []).filter(task=>task.dueDate===date).map(task=>({project,task}))).sort((a,b)=>Number(Boolean(a.task.completed))-Number(Boolean(b.task.completed)) || Number(isUrgentPriority(b.task.priority))-Number(isUrgentPriority(a.task.priority)));
}
class LrpDayTasksModal extends obsidian.Modal {
  constructor(plugin,date){super(plugin.app);this.plugin=plugin;this.date=date;}
  onOpen(){
    this.modalEl.addClass('lrp-day-tasks-modal');
    this.render();this.unsubscribe=this.plugin.taskStore.subscribe(()=>this.render());
  }
  render(){
    const previousScroll=this.contentEl.querySelector('.lrp-day-task-list')?.scrollTop || 0;
    this.contentEl.empty();
    const items=getLrpDayEntries(this.plugin,this.date);
    this.contentEl.createEl('h3',{text:`${this.date} · 当天安排`});
    this.contentEl.createEl('p',{text:`共 ${items.length} 项 · ${formatLrpWeek(this.date)}`,cls:'lrp-day-count'});
    const list=this.contentEl.createDiv('lrp-day-task-list');
    if(!items.length)list.createDiv({text:'这一天暂无已安排的任务。',cls:'lrp-day-empty'});
    for(const {project,task} of items){
      const card=list.createEl('button',{cls:'lrp-day-task-card'});
      card.style.setProperty('--lrp-project-color',project.calendarColor);
      card.createSpan({text:project.name,cls:'lrp-day-project'});
      card.createEl('strong',{text:`${isUrgentPriority(task.priority)?'‼️ ':''}${task.title}`});
      const target=getLrpTaskTarget(this.plugin,task);
      if(target){
        const parent=target.embedded?target.owner:target.tasks.find(item=>item.id===task.parentId);
        if(parent)card.createSpan({text:`所属任务：${parent.title}`,cls:'lrp-day-parent'});
      }
      const tags=card.createDiv('lrp-preview-chips');
      renderLrpTaskStatus(tags,this.plugin,task);
      tags.createSpan({text:`优先级：${lrpText(task.priority || 'Medium')}`,cls:'lrp-preview-chip'});
      for(const id of task.tags || []){
        const tag=this.plugin.settings.availableTags?.find(tag=>tag.id===id);
        if(tag){const badge=tags.createSpan({text:tag.name,cls:'lrp-preview-chip'});badge.style.backgroundColor=tag.color;badge.style.color='#000';}
      }
      card.onclick=()=>{
        const rect=card.getBoundingClientRect();
        this.plugin.openTaskDetail(task,{anchor:{getBoundingClientRect:()=>rect}});
      };
    }
    list.scrollTop=previousScroll;
  }
  onClose(){this.plugin.lrpClosePreview?.();this.unsubscribe?.();this.contentEl.empty();}
}
