function calculateLrpProgress(task, tasks = [], visiting = new Set()) {
  if (visiting.has(task.id)) return 0;
  const next = new Set(visiting); next.add(task.id);
  if (task.progressMode === 'manual') return 100 - Math.max(0, Math.min(100, Number(task.manualRemaining ?? 100)));
  const children = tasks.filter(child => child.parentId === task.id);
  if (children.length) return Math.min(isLrpTaskComplete(task,tasks)?100:99,Math.round(children.reduce((sum, child) => sum + calculateLrpProgress(child, tasks, next), 0) / children.length));
  if (task.subtasks?.length) return Math.min(isLrpTaskComplete(task,tasks)?100:99,Math.round(task.subtasks.filter(item => item.completed).length / task.subtasks.length * 100));
  if (task.completed || task.status === 'Completed') return 100;
  return Math.max(0, Math.min(100, Number(task.percentComplete) || 0));
}
function applyLrpProgress(tasks) {
  for (const task of tasks) {
    const derived = task.progressMode === 'manual' || task.subtasks?.length || tasks.some(child => child.parentId === task.id);
    task.percentComplete = calculateLrpProgress(task, tasks);
    if (derived) {
      task.completed = task.percentComplete === 100;
      if (task.completed) task.status = 'Completed';
      else if (task.status === 'Completed' || task.percentComplete > 0 && task.status === 'Not Started') task.status = 'In Progress';
    }
  }
}
TaskDetailView.prototype.renderPercentComplete = function(container, task) {
  const tasks = Object.values(this.plugin.taskStore.tasksByProject || {}).flat();
  const percent = calculateLrpProgress(task, tasks);
  const wrapper = container.createDiv('lrp-personal-progress');
  const sub=getLrpSubtaskSummary(task,tasks);
  const automatic=wrapper.createDiv('lrp-subtask-progress');
  automatic.createDiv({text:`子任务完成：${sub.completed} / ${sub.total}`,cls:'lrp-progress-value'});
  automatic.createEl('progress',{attr:{max:'100',value:String(sub.automatic),'aria-label':'子任务自动进度'}});
  automatic.createDiv({text:`自动进度 ${sub.automatic}%${sub.total ? '' : ' · 暂无子任务'}`,cls:'lrp-progress-description'});
  wrapper.createDiv({text:`已完成 ${percent}% · 剩余 ${100-percent}%`,cls:'lrp-progress-value'});
  const bar = wrapper.createEl('progress', {attr:{max:'100',value:String(percent),'aria-label':'完成进度'}});
  const mode = wrapper.createEl('select', {attr:{'aria-label':'进度计算方式'}});
  mode.createEl('option', {text:'自动：按子任务／子任务',value:'auto'});
  mode.createEl('option', {text:'手动：估计剩余比例',value:'manual'});
  mode.value = task.progressMode === 'manual' ? 'manual' : 'auto';
  mode.onchange = async () => {
    if (mode.value === 'manual') {
      const remaining = Math.max(10, Math.min(100, Math.round((100-percent)/10)*10));
      await this.update({progressMode:'manual',manualRemaining:remaining});
    } else await this.update({progressMode:'auto',manualRemaining:undefined,percentComplete:0});
  };
  if (mode.value === 'manual') {
    const select = wrapper.createEl('select', {attr:{'aria-label':'手动选择剩余百分比'}});
    if (percent === 100) select.createEl('option',{text:'已完成（剩余 0%）',value:'0',attr:{disabled:'true'}});
    for (let remaining=100; remaining>=10; remaining-=10) select.createEl('option',{text:`剩余 ${remaining}%`,value:String(remaining)});
    select.value = String(task.manualRemaining ?? 100);
    select.onchange = async () => this.update({manualRemaining:Number(select.value),progressMode:'manual'});
    const complete = wrapper.createEl('button',{text:'标记为已完成'});
    complete.onclick = async () => this.update({progressMode:'manual',manualRemaining:0});
  } else {
    wrapper.createDiv({text:'按子任务的平均完成情况计算；没有子任务时，按子任务的勾选数量计算。也可切换为手动估计。',cls:'lrp-progress-description'});
  }
};
