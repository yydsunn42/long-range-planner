const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../main.js','utf8'),Base=class{};
const context={require:()=>new Proxy({},{get:()=>Base}),module:{exports:{}},console};
vm.runInNewContext(source+'\nthis.Calendar=MyDayView;this.getEntries=getLrpCalendarTasks;',context);
class Node {
  constructor(cls='',opts={}){this.cls=cls;this.text=opts.text || '';this.attr=opts.attr || {};this.children=[];this.style={setProperty(){}};}
  createEl(_tag,opts={}){const child=new Node(opts.cls || '',opts);this.children.push(child);return child;}
  createDiv(opts={}){return this.createEl('div',typeof opts==='string'?{cls:opts}:opts);}
  createSpan(opts){return this.createEl('span',opts);}
  addClass(cls){this.cls+=' '+cls;}
  all(){return [this,...this.children.flatMap(child=>child.all())];}
}
const date='2026-11-28';
const tasks={
  p1:[{id:'owner-1',title:'大任务',subtasks:[
    {id:'a',title:'A',completed:true,dueDate:date,priority:'High'},
    {id:'b',title:'B',completed:true,dueDate:date,priority:'Medium'},
    {id:'c',title:'C',completed:false,dueDate:date,priority:'High'}]}],
  p2:[{id:'owner-2',title:'另一个大任务',subtasks:[
    {id:'d',title:'D',completed:true,dueDate:date,priority:'High'},
    {id:'e',title:'E',completed:false,dueDate:date,priority:'Medium'}]}]
};
const plugin={settings:{activeProjectId:'p1',showAllProjects:true,projects:[{id:'p1',name:'项目一'},{id:'p2',name:'项目二'}]},taskStore:{getAllForProject:id=>tasks[id] || []}};
const view=new context.Calendar({},plugin);view.weekAnchor=new Date(2026,10,28);view.monthAnchor=new Date(2026,10,1);
view.restoreScroll=()=>{};view.attachLrpCalendarDropTarget=()=>{};
view.renderWeekCard=(node,item)=>node.createDiv({cls:'test-card',text:item.task.title});
view.renderMonthTask=view.renderWeekCard;
const rows=()=>view.getTasksForDate(date);
function rendered(mode){
  const root=new Node();view[mode==='week'?'renderWeekContent':'renderMonthContent'](root,1);
  const cls=mode==='week'?'myday-week-col-count':'lrp-month-task-count';
  return {counts:root.all().filter(node=>node.cls.split(' ').includes(cls)),cards:root.all().filter(node=>node.cls==='test-card')};
}
assert.equal(view.getDayCompletionSummary(rows()).text,'3/5 项');
for(const mode of ['week','month']){
  const result=rendered(mode);
  assert.ok(result.counts.some(node=>node.text==='3/5 项'));
  assert.ok(result.counts.some(node=>node.text==='0/0 项'));
  assert.equal(result.cards.length,5);
  assert.match(result.counts.find(node=>node.text==='3/5 项').attr['aria-label'],/5项任务，已完成3个/);
}
console.log('PASS: week and month render 3/5 completed, 0/0 empty days, accessible descriptions and all five cards');
view.currentFilters.showCompleted=false;
for(const mode of ['week','month']){
  const result=rendered(mode);assert.ok(result.counts.some(node=>node.text==='3/5 项'));assert.equal(result.cards.length,2);
}
console.log('PASS: hiding completed cards retains the true 3/5 daily progress in both views');
view.currentFilters.priority='High';assert.equal(view.getDayCompletionSummary(rows()).text,'2/3 项');
view.currentFilters.priority='All';view.currentFilters.search='A';assert.equal(view.getDayCompletionSummary(rows()).text,'1/1 项');
view.currentFilters.search='';plugin.settings.showAllProjects=false;assert.equal(view.getDayCompletionSummary(rows()).text,'2/3 项');
plugin.settings.showAllProjects=true;console.log('PASS: search, priority and single/all-project scope count the matching day entries');
tasks.p1[0].subtasks.push({id:'abandoned',title:'放弃',completed:true,planningDisposition:'abandoned',dueDate:date});
assert.equal(view.getDayCompletionSummary(rows()).text,'3/6 项');
tasks.p2.push({id:'parent',title:'父任务'},{id:'leaf',title:'独立子任务',parentId:'parent',completed:true,status:'Completed',dueDate:date});
assert.equal(view.getDayCompletionSummary(rows()).text,'4/7 项');
console.log('PASS: abandoned items do not count as completed; independent parentId leaves use the same completion state');
tasks.p1[0].subtasks[2].completed=true;
for(const mode of ['week','month'])assert.ok(rendered(mode).counts.some(node=>node.text==='5/7 项'));
tasks.p1[0].subtasks[0].completed=false;
for(const mode of ['week','month'])assert.ok(rendered(mode).counts.some(node=>node.text==='4/7 项'));
console.log('PASS: completion and reopening immediately update both real render paths without modifying task data');

const standalone={id:'standalone',title:'没有子任务的大任务',dueDate:date,completed:false,status:'Not Started'};
tasks.p2.push(standalone);
assert.equal(view.getDayCompletionSummary(rows()).text,'4/8 项');
view.currentFilters.showCompleted=true;
for(const mode of ['week','month']){
  const result=rendered(mode);assert.ok(result.cards.some(node=>node.text===standalone.title));assert.ok(result.counts.some(node=>node.text==='4/8 项'));
}
standalone.completed=true;standalone.status='Completed';
assert.equal(view.getDayCompletionSummary(rows()).text,'5/8 项');
assert.ok(view.getTasksForDate(date).some(item=>item.task.id===standalone.id));
console.log('PASS: childless root tasks appear in week/month/day maps and contribute to completion counts');
const standaloneStart={id:'start-only',title:'只有开始日期',startDate:date,subtasks:[]};
const family=[standalone,standaloneStart,{id:'no-date',title:'未排日期'},
  {id:'has-undated-child',dueDate:date,subtasks:[{id:'undated'}]},
  {id:'parent',dueDate:date},{id:'child',parentId:'parent',dueDate:date}];
const before=JSON.stringify(family),entries=context.getEntries(family);
assert.deepEqual(Array.from(entries,item=>item.id).sort(),['child','standalone','start-only']);
assert.equal(entries.find(item=>item.id==='start-only').dueDate,date);
assert.equal(entries.find(item=>item.id==='start-only')._lrpRealDueDate,null);
assert.equal(JSON.stringify(family),before);
console.log('PASS: start-only/empty-subtask roots included, undated tasks and all parents excluded, dates remain unchanged');
