const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/../main.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
const Base = class {};
const sandbox = {
  require: () => new Proxy({}, {get: () => Base}),
  module: {exports: {}}, console,
};
vm.runInNewContext(source + '\nthis.check = {getWeekDates,toDateStr,MyDayView,GanttView,BoardView,TaskDetailView,DEFAULT_SETTINGS,KPI_DEFINITIONS,makePersonalBucket,LRP_BUCKET_PALETTE,getBoardPageSize,clampBoardStart,ensureProjectCalendarColors,getProjectCalendarColor,isUrgentPriority,bucketColorsAreSimilar,chooseBucketColor,getBoardLayout,createPersonalTag,lrpText,LRP_FUNCTION_HELP,addLrpHelpDisclosure,getLrpDetailGroup,groupLrpTaskDetails,TaskStore,getVisibleLrpProjects,openLrpProjectFromHeading,addLrpBoardProjectFilters,createLrpProjectFinder,createLrpProjectScope,calculateLrpProgress,applyLrpProgress,createLrpEmbeddedLeaf,clearLrpLeakedViewContainers,getLrpSubtaskSummary,getLrpPortfolio,getLrpTimelineRange,getLrpWeekInfo,getLrpHiddenProjectFolderCss,getLrpSoftTimelineColor,getLrpDayEntries,getLrpTimelineTree,flattenLrpTimelineTree,getLrpCalendarTasks,getLrpTaskTarget,updateLrpCalendarTask,getLrpPreviewPosition,DependencyGraphView,matchesLrpDependencyProject,getLrpDependencyLayout,getLrpDependencyPath,getLrpPortfolioRules,getLrpTaskDisplayStatus,isLrpTaskComplete,getLrpTaskState,getLrpProjectState,matchesLrpTaskStatus,matchesLrpProjectStatus,DashboardView,renderLrpPredecessorLinks,getLrpTaskCategory,matchesLrpTaskCategory,saveLrpPlanningDecision,updateLrpWeekLabels,formatLrpWeek,getLrpTaskSchedule,getLrpWeekDates,getLrpCompletionWeekUpdate,compareLrpScheduledTasks,renderLrpPortfolioTable,renderLrpPortfolioTimeline,GridView};', sandbox);
const api = sandbox.check;
assert.equal(manifest.id, 'long-range-planner');
assert.equal(manifest.name, 'Long Range Planner');
assert.ok(!source.includes('"project-planner-view"'));
assert.ok(!source.includes('obsidian://open-planner-task?'));
assert.equal(api.DEFAULT_SETTINGS.myDayDefaultView, 'week');
assert.equal(api.DEFAULT_SETTINGS.enableMarkdownSync, false);
assert.equal(api.DEFAULT_SETTINGS.projectsBasePath, 'long-range-planner');
for (const [anchor, monday, sunday] of [
 ['2026-11-16','2026-11-16','2026-11-22'],
 ['2026-11-22','2026-11-16','2026-11-22'],
 ['2027-01-01','2026-12-28','2027-01-03'],
 ['2028-02-29','2028-02-28','2028-03-05']
]) {
 const week=api.getWeekDates(new Date(anchor+'T12:00:00'));
 assert.equal(week[0].getDay(),1);
 assert.equal(week[6].getDay(),0);
 assert.equal(api.toDateStr(week[0]),monday);
 assert.equal(api.toDateStr(week[6]),sunday);
 assert.equal(new Set(week.map(api.toDateStr)).size,7);
}
const plugin = {settings: {projects:[],myDayDefaultView:'today'},taskStore:{getAllForProject:()=>[]}};
const view = new api.MyDayView({},plugin);
view.monthAnchor = new Date(2026,10,16);
const monthDates = [...view.getMonthTaskMap().keys()];
assert.equal(monthDates[0],'2026-10-26');
assert.equal(monthDates.at(-1),'2026-12-06');
assert.equal(monthDates.length % 7,0);
assert.equal(new api.GanttView({},plugin).zoomLevel,'week');
assert.ok(!api.KPI_DEFINITIONS.some(k=>k.id==='due-today'));
assert.ok(api.KPI_DEFINITIONS.some(k=>k.id==='critical-priority'));
assert.ok(api.KPI_DEFINITIONS.some(k=>k.id==='high-priority'));
assert.ok(api.KPI_DEFINITIONS.some(k=>k.id==='has-dependencies'));
assert.ok(!source.includes('text: "Today"'));
assert.ok(!source.includes('["day", "week", "month"].forEach'));
assert.ok(!source.includes('dueDate >= today && dueDate <= weekFromNow'));
assert.ok(source.includes('[...DAY_NAMES_SHORT.slice(1), DAY_NAMES_SHORT[0]]'));
console.log('PASS: independent identity, personal defaults, Monday weeks, month boundaries, weekly timeline, dashboard cards, removed day modes');
const buckets=[{name:'第1周',color:'#d9c4e8'},{name:'第5周',color:'#c6cdec'},{name:'New Bucket'}];
const sixth=api.makePersonalBucket(buckets,()=>0,'test-id');
assert.equal(sixth.name,'第6周');
assert.equal(sixth.id,'test-id');
assert.ok(api.LRP_BUCKET_PALETTE.includes(sixth.color));
assert.ok(!buckets.some(b=>b.color===sixth.color));
assert.equal(api.makePersonalBucket([],()=>0,'empty').name,'第1周');
assert.equal(api.makePersonalBucket([{name:'第 12 周 · 推进'},{name:'Week 15'}],()=>0,'mixed').name,'第16周');
const all=api.LRP_BUCKET_PALETTE.map((color,i)=>({name:`第${i+1}周`,color}));
assert.notEqual(api.makePersonalBucket(all,()=>0.999,'reuse').color,all.at(-1).color);
assert.equal(api.getBoardPageSize(1400),3);
assert.equal(api.getBoardPageSize(850),2);
assert.equal(api.clampBoardStart(-1,6,3),0);
assert.equal(api.clampBoardStart(10,6,3),3);
assert.equal(api.clampBoardStart(3,6,2),3);
assert.equal(api.clampBoardStart(1,1,2),0);
assert.ok(source.includes('const statsGrid = alertsGrid;'));
assert.ok(source.includes('this.boardResizeObserver?.disconnect()'));
console.log('PASS: next-week names, nonrepeating pastel colors, responsive 2/3-week pages, navigation boundaries');
const styles={};
const boardElement={clientWidth:1240,style:{setProperty:(k,v)=>styles[k]=v},children:Array.from({length:6},(_,i)=>({querySelector:()=>({textContent:`第${i+1}周`})}))};
Object.defineProperty(boardElement,'scrollWidth',{get:()=>parseFloat(styles['--lrp-column-width'])*6+16*5});
const boardView=new api.BoardView({},plugin);
boardView.containerEl={querySelector:()=>boardElement};
boardView.boardNavigation={previous:{},next:{},range:{}};
boardView.updateBoardPage();
assert.equal(boardView.boardNavigation.range.textContent,'第1周 — 第3周 · 共 6 周');
assert.equal(boardView.boardNavigation.previous.disabled,true);
boardView.boardStartIndex++;
boardView.updateBoardPage();
assert.equal(boardView.boardNavigation.range.textContent,'第2周 — 第4周 · 共 6 周');
assert.equal(boardElement.scrollLeft,(1240-32)/3+16);
boardElement.clientWidth=820;
boardView.updateBoardPage();
assert.equal(boardView.boardNavigation.range.textContent,'第2周 — 第3周 · 共 6 周');
assert.equal(styles['--lrp-column-width'],'402px');
boardView.boardStartIndex=100;
boardView.updateBoardPage();
assert.equal(boardView.boardNavigation.range.textContent,'第5周 — 第6周 · 共 6 周');
assert.equal(boardView.boardNavigation.next.disabled,true);
console.log('PASS: board navigation, right-panel resize preserving position, last-page clamping');
const projects=[{id:'a',name:'Python'},{id:'b',name:'阅读'}];
api.ensureProjectCalendarColors(projects);
assert.notEqual(projects[0].calendarColor,projects[1].calendarColor);
const originalColor=projects[0].calendarColor;
projects.reverse(); projects[1].name='重命名';
api.ensureProjectCalendarColors(projects);
assert.equal(api.getProjectCalendarColor(projects,'a'),originalColor);
projects.push({id:'c',calendarColor:originalColor});
api.ensureProjectCalendarColors(projects);
assert.equal(new Set(projects.map(p=>p.calendarColor)).size,3);
const reloaded=JSON.parse(JSON.stringify(projects));
api.ensureProjectCalendarColors(reloaded);
assert.equal(api.getProjectCalendarColor(reloaded,'a'),originalColor);
assert.equal(api.isUrgentPriority('High'),true);
assert.equal(api.isUrgentPriority('Critical'),true);
assert.equal(api.isUrgentPriority('Medium'),false);
assert.equal(api.isUrgentPriority('Low'),false);
function element() {
 return {style:{setProperty(k,v){this[k]=v;}},attrs:{},spans:[],addClass(){},setAttribute(k,v){this.attrs[k]=v;},createSpan(opts){const child=element();child.text=opts.text;this.spans.push(child);return child;}};
}
const calendar=new api.MyDayView({}, {settings:{projects},taskStore:{}});
const rendered=[];const cell={createDiv(){const el=element();rendered.push(el);return el;}};
calendar.renderMonthTask(cell,{projectId:'a',projectName:'Python',task:{title:'普通任务',priority:'Medium'}});
calendar.renderMonthTask(cell,{projectId:'a',projectName:'Python',task:{title:'紧急任务',priority:'Critical'}});
calendar.renderMonthTask(cell,{projectId:'b',projectName:'阅读',task:{title:'阅读任务',priority:'Medium'}});
assert.equal(rendered[0].style['--lrp-project-color'],rendered[1].style['--lrp-project-color']);
assert.notEqual(rendered[0].style['--lrp-project-color'],rendered[2].style['--lrp-project-color']);
assert.equal(rendered[0].spans.some(s=>s.text==='‼️'),false);
assert.equal(rendered[1].spans.some(s=>s.text==='‼️'),true);
console.log('PASS: persistent project colors, project renames/reordering, duplicate colors, calendar rendering and urgency markers');
assert.equal(api.bucketColorsAreSimilar('#d9c4e8','#dfd0eb'),true);
assert.equal(api.bucketColorsAreSimilar('#d9c4e8','#c8ddd5'),false);
for (let r=0;r<1;r+=0.1) {
 const previous={name:'第15周',color:'#d9c4e8'};
 const next=api.makePersonalBucket([previous],()=>r,'next');
 assert.equal(api.bucketColorsAreSimilar(previous.color,next.color),false);
 const inserted=api.makePersonalBucket([previous,{name:'第16周',color:'#c5d9e7'}],()=>r,'insert',[previous,{color:'#c5d9e7'}]);
 assert.ok(!api.bucketColorsAreSimilar(inserted.color,previous.color));
 assert.ok(!api.bucketColorsAreSimilar(inserted.color,'#c5d9e7'));
}
assert.ok(source.includes('await this.renderUnassignedBucket(pinned, tasks)'));
assert.ok(source.includes('const boardContainer = pane.createDiv("planner-board-container")'));
boardElement.scrollLeft=199;
boardView.updateBoardNavigation(boardElement,2,382);
assert.equal(boardElement.scrollLeft,199,'trackpad updates navigation without snapping scroll');
console.log('PASS: adjacent hue contrast, permanently separate inbox, trackpad navigation without snapping');

for(const total of [600,850,1100,1280,1500,1800]) {
 const metrics=api.getBoardLayout(total);
 const visible=metrics.visible;
 const pinned=metrics.columnWidth;
 const viewport=total-40-pinned-16;
 const weekWidth=(viewport-16*(visible-1))/visible;
 assert.ok(Math.abs(pinned-weekWidth)<0.001,'inbox and weeks must be equal width');
 assert.ok(Math.abs(viewport-(visible*weekWidth+(visible-1)*16))<0.001,'viewport must fit exact whole columns');
}
const tagSettings={availableTags:[]};
assert.equal(api.createPersonalTag(tagSettings,'  ', '#abcdef','empty'),null);
const firstTag=api.createPersonalTag(tagSettings,' 学习 ', '#abcdef','tag1');
assert.equal(firstTag.name,'学习');
assert.equal(tagSettings.availableTags.length,1);
assert.equal(api.createPersonalTag(tagSettings,'学习','#000000','tag2').id,'tag1');
assert.equal(tagSettings.availableTags.length,1);
assert.equal(api.createPersonalTag(tagSettings,'Writing','#123456','tag3').id,'tag3');
assert.equal(api.createPersonalTag(tagSettings,'writing','#123456','tag4').id,'tag3');
console.log('PASS: equal inbox/week widths, exact whole-column viewport across sizes, inline tag creation and deduplication');
assert.equal(api.lrpText('Dependencies'),'前置依赖');
assert.equal(api.lrpText('Default view'),'默认打开的视图');
assert.equal(api.lrpText('我的项目名称'),'我的项目名称');
assert.ok(api.DEFAULT_SETTINGS.availableStatuses.some(s=>s.name==='Not Started'));
assert.ok(api.LRP_FUNCTION_HELP['工时'].includes('小时'));
assert.ok(api.LRP_FUNCTION_HELP['前置依赖'].includes('完成后开始'));
const detail=new api.TaskDetailView({},plugin);
const enumOptions=[];
let savedStatus;
const select={createEl(tag,opts){enumOptions.push(opts);return {};}};
detail.createEditableSelect({createEl:()=>select},'Not Started',['Not Started','Completed'],value=>savedStatus=value,true);
assert.equal(enumOptions[0].text,'未开始');
assert.equal(enumOptions[0].value,'Not Started');
select.value='Completed'; select.onchange();
assert.equal(savedStatus,'Completed');
const projectOptions=[];
detail.createEditableSelect({createEl:()=>({createEl(tag,opts){projectOptions.push(opts);return {};}})},'Completed',['Completed'],()=>{});
assert.equal(projectOptions[0].text,'Completed','user project names must not be translated');
function HelpNode(tag,doc) {this.tagName=tag;this.ownerDocument=doc;this.children=[];this.className='';this.textContent='';this.events={};this.dataset={};}
HelpNode.prototype.appendChild=function(node){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);this.children.push(node);node.parentNode=this;return node;};
HelpNode.prototype.insertBefore=function(node,before){this.children.splice(this.children.indexOf(before),0,node);node.parentNode=this;};
HelpNode.prototype.closest=function(cls){let n=this;while(n){if(n.className==='lrp-help-toggle')return n;n=n.parentNode;}return null;};
HelpNode.prototype.addEventListener=function(type,handler){this.events[type]=handler;};
const doc={createElement:tag=>new HelpNode(tag,doc)};
function helpFixture(){const root=new HelpNode('div',doc);const heading=new HelpNode('h3',doc);heading.textContent='工时';root.appendChild(heading);root.querySelectorAll=selector=>selector==='h2,h3'?[heading]:[];return root;}
const helpOwner={};const helpRoot=helpFixture();
api.addLrpHelpDisclosure(helpOwner,helpRoot);
const disclosure=helpRoot.children[0];
assert.equal(disclosure.tagName,'details');
assert.equal(disclosure.open,false);
assert.ok(disclosure.children[1].textContent.includes('小时'));
disclosure.open=true;disclosure.events.toggle();
const rebuilt=helpFixture();api.addLrpHelpDisclosure(helpOwner,rebuilt);
assert.equal(rebuilt.children[0].open,true,'keep explanation expanded after task rerender');
disclosure.open=false;disclosure.events.toggle();
assert.equal(helpOwner.lrpHelpOpen.get('feature:工时'),false);
api.addLrpHelpDisclosure(helpOwner,helpRoot);
assert.equal(helpRoot.children.length,1,'do not duplicate help controls');
console.log('PASS: Chinese labels with original enum values, untouched user names, expandable help, collapse and rerender state');

HelpNode.prototype.querySelector=function(selector){
 for(const child of this.children){
  if(selector.startsWith('.') ? child.className===selector.slice(1) : child.tagName.toLowerCase()===selector.toLowerCase())return child;
  const found=child.querySelector(selector);if(found)return found;
 }
 return null;
};
assert.equal(api.getLrpDetailGroup('截止日期'),'时间安排');
assert.equal(api.getLrpDetailGroup('工时'),'完成进度');
assert.equal(api.getLrpDetailGroup('标签'),'基本信息');
const detailRoot=new HelpNode('div',doc);
const toolbar=new HelpNode('div',doc); detailRoot.appendChild(toolbar);
const kept=[];
for(const [label,tag] of [['任务名称','h2'],['状态','h3'],['开始日期','h3'],['截止日期','h3'],['工时','h3']]){
 const heading=new HelpNode(tag,doc);heading.textContent=label;detailRoot.appendChild(heading);
 const input=new HelpNode('input',doc);input.onchange=()=>label;kept.push(input);detailRoot.appendChild(input);
}
api.groupLrpTaskDetails(detailRoot);
const grouped=detailRoot.querySelector('.lrp-detail-cards');
assert.equal(grouped.children.length,3);
assert.equal(grouped.children[0].children[0].textContent,'基本信息');
assert.equal(grouped.children[1].children[0].textContent,'时间安排');
assert.equal(grouped.children[2].children[0].textContent,'完成进度');
assert.equal(detailRoot.children[0],toolbar);
assert.equal(kept[0].onchange(),'任务名称');
assert.ok(kept.every(input=>input.parentNode.className==='lrp-detail-field'));
api.groupLrpTaskDetails(detailRoot);
assert.equal(detailRoot.children.length,2);
console.log('PASS: related detail fields grouped into cards, original controls and handlers preserved, no duplicate grouping');

const scopeSettings={projects:[{id:'p1',name:'项目一'},{id:'p2',name:'项目二'}],activeProjectId:'p1',showAllProjects:false};
assert.equal(api.getVisibleLrpProjects(scopeSettings).length,1);
assert.equal(api.getVisibleLrpProjects(scopeSettings)[0].id,'p1');
scopeSettings.showAllProjects=true;
assert.equal(api.getVisibleLrpProjects(scopeSettings).length,2);
const scopedCalendar=new api.MyDayView({}, {settings:scopeSettings,taskStore:{getAllForProject:id=>[{id, dueDate:'2026-11-17'}]}});
assert.equal(scopedCalendar.getTasksForDate('2026-11-17').length,2);
scopeSettings.showAllProjects=false;
assert.equal(scopedCalendar.getTasksForDate('2026-11-17').length,1);
this.lrpAsyncChecks=(async()=>{
 const parentPlugin={settings:scopeSettings,saveSettings:async()=>{}};
 parentPlugin.taskStore=new api.TaskStore(parentPlugin);
 const ta={id:'a1',title:'A',status:'Not Started',completed:false};
 const tb={id:'b1',title:'B',status:'Not Started',completed:false};
 parentPlugin.taskStore.tasksByProject={p1:[ta],p2:[tb]};
 parentPlugin.taskStore.tasks=parentPlugin.taskStore.tasksByProject.p1;
 const scoped=api.createLrpProjectScope(parentPlugin,'p2');
 assert.equal(scoped.settings.activeProjectId,'p2');
 assert.equal(parentPlugin.settings.activeProjectId,'p1');
 assert.equal(scoped.taskStore.getAll()[0].id,'b1');
 const writes=[];scoped.taskStore.writeProjectFile=async(pid,tasks)=>writes.push({pid,tasks:[...tasks]});
 await scoped.taskStore.updateTask('b1',{status:'Completed'});
 assert.equal(tb.status,'Completed');
 assert.equal(tb.percentComplete,100);
 await scoped.taskStore.updateTask('b1',{subtasks:[{id:'one',completed:true},{id:'two',completed:false}]});
 assert.equal(tb.percentComplete,50);
 assert.equal(tb.completed,false);
 await scoped.taskStore.updateTask('b1',{progressMode:'manual',manualRemaining:20});
 assert.equal(tb.percentComplete,80);
 await scoped.taskStore.updateTask('b1',{completed:true});
 assert.equal(tb.manualRemaining,0);
 assert.equal(tb.percentComplete,100);
 await scoped.taskStore.updateTask('b1',{completed:false});
 assert.equal(tb.manualRemaining,100);
 assert.equal(tb.percentComplete,0);
 assert.equal(ta.status,'Not Started');
 assert.ok(writes.every(write=>write.pid==='p2'));
 await scoped.taskStore.deleteTask('b1');
 assert.equal(parentPlugin.taskStore.tasksByProject.p2.length,0);
 assert.equal(parentPlugin.taskStore.tasks[0].id,'a1');
 assert.equal(parentPlugin.settings.activeProjectId,'p1');
 const colorProject={id:'colors',buckets:[{id:'first',name:'第1周',color:'#d9c4e8'},{id:'second',name:'第2周',color:'#c5d9e7'}]};
 let storedColors;let colorRenders=0;
 const colorPlugin={settings:{activeProjectId:'colors',projects:[colorProject]},taskStore:{},saveSettings:async()=>{storedColors=JSON.parse(JSON.stringify(colorProject.buckets));}};
 const colorBoard=new api.BoardView({},colorPlugin);
 colorBoard.buckets=colorProject.buckets.map(bucket=>({...bucket}));
 colorBoard.render=async()=>{colorRenders++;};
 await colorBoard.setBucketColor('second','#dfd0eb');
 assert.equal(storedColors[1].color,'#dfd0eb','manual near-neighbor color must not be overwritten');
 assert.equal(storedColors[1].colorMode,'manual');
 assert.equal(colorRenders,1);
 colorBoard.buckets=storedColors.map(bucket=>({...bucket}));
 await colorBoard.saveBuckets();
 assert.equal(storedColors[1].color,'#dfd0eb','manual color persists through later saves');
 await colorBoard.setBucketColor('second',undefined);
 assert.equal(storedColors[1].color,undefined);
 assert.equal(storedColors[1].colorMode,'manual');
 assert.equal(colorRenders,2);
 console.log('PASS: manual bucket color updates canonical/stale references, persists through autosave, resets default and refreshes board');
 console.log('PASS: all/single-project calendar filtering and isolated per-project writes in combined pages');
})();

assert.equal(api.calculateLrpProgress({id:'done',status:'Completed',percentComplete:0}),100);
assert.equal(api.calculateLrpProgress({id:'check',subtasks:[{completed:true},{completed:false}]}),50);
const family=[{id:'parent'},{id:'c1',parentId:'parent',completed:true},{id:'c2',parentId:'parent',completed:false}];
assert.equal(api.calculateLrpProgress(family[0],family),50);
api.applyLrpProgress(family);
assert.equal(family[0].percentComplete,50);
assert.equal(family[0].completed,false);
assert.equal(api.calculateLrpProgress({id:'manual',progressMode:'manual',manualRemaining:30,subtasks:[{completed:false}]}),70);
assert.equal(api.calculateLrpProgress({id:'manual',progressMode:'manual',manualRemaining:0}),100);
const cycle=[{id:'a',parentId:'b'},{id:'b',parentId:'a'}];
assert.ok(Number.isFinite(api.calculateLrpProgress(cycle[0],cycle)));
console.log('PASS: checklist-based progress, equal-weight child progress, manual remaining values, completed tasks and cycle guard');

const mainLeafHost={children:[],appendChild(node){this.children.push(node);}};
const embeddedHost={children:[],appendChild(node){this.children.push(node);}};
const leaf={containerEl:mainLeafHost,app:{id:'real-app'},history:{backHistory:[],forwardHistory:[]},getReal(){return this;}};
const embeddedLeaf=api.createLrpEmbeddedLeaf(leaf,embeddedHost);
function SimulatedObsidianView(viewLeaf){this.containerEl={nativeHeader:true};viewLeaf.containerEl.appendChild(this.containerEl);}
new SimulatedObsidianView(embeddedLeaf);
assert.equal(mainLeafHost.children.length,0,'constructor must never attach native view chrome to the real workspace');
assert.equal(embeddedHost.children.length,1);
assert.equal(embeddedLeaf.app,leaf.app);
assert.equal(embeddedLeaf.history,leaf.history);
assert.equal(embeddedLeaf.getReal(),leaf);
let removed=false;
const current={matches:()=>true,remove(){throw Error('must keep current view');}};
const leaked={matches:()=>true,remove(){removed=true;}};
const unrelated={matches:()=>false,remove(){throw Error('must keep unrelated content');}};
api.clearLrpLeakedViewContainers({containerEl:current,leaf:{containerEl:{children:[current,leaked,unrelated]}}});
assert.equal(removed,true);
console.log('PASS: embedded view constructor isolation, correct leaf method binding, safe cleanup of leaked native headers');

const manualTask={id:'manual-parent',progressMode:'manual',manualRemaining:60,subtasks:[{completed:true},{completed:false}]};
const subSummary=api.getLrpSubtaskSummary(manualTask,[manualTask]);
assert.equal(subSummary.automatic,50);
assert.equal(subSummary.completed,1);
assert.equal(subSummary.total,2);
assert.equal(api.calculateLrpProgress(manualTask,[manualTask]),40);
const portfolioPlugin={settings:{projects:[{id:'p1',name:'一'},{id:'p2',name:'二'},{id:'empty',name:'空'}]},taskStore:{getAllForProject:id=>id==='p1'?[{id:'a',startDate:'2026-11-16',dueDate:'2026-11-29',completed:true}]:id==='p2'?[{id:'b',startDate:'2026-11-23',dueDate:'2026-12-06',progressMode:'manual',manualRemaining:60}]:[]}};
const portfolio=api.getLrpPortfolio(portfolioPlugin);
assert.equal(portfolio.length,3);
assert.equal(portfolio[0].progress,100);
assert.equal(portfolio[1].progress,40);
assert.equal(portfolio[0].start,'2026-11-16');
assert.equal(portfolio[1].end,'2026-12-06');
assert.equal(portfolio[2].start,null);
const range=api.getLrpTimelineRange(portfolio);
assert.equal(range.weeks,3);
assert.equal(new Date(range.start).toISOString().slice(0,10),'2026-11-16');
assert.equal(api.getLrpTimelineRange([portfolio[2]]),null);
console.log('PASS: always-available automatic subtask summary alongside manual progress; combined project rows, project spans and empty projects');

assert.equal(typeof sandbox.module.exports,'function','plugin must retain its runtime export');
for(const [date,year,week] of [['2026-11-16',2026,47],['2026-11-22',2026,47],['2026-11-23',2026,48],['2027-01-01',2026,53],['2027-01-04',2027,1],['2024-12-30',2025,1]]){
 const info=api.getLrpWeekInfo(date);assert.equal(info.year,year);assert.equal(info.week,week);
 const dates=api.getLrpWeekDates(`${year}-W${String(week).padStart(2,'0')}`);
 assert.ok(dates.start<=date && date<=dates.end);
}
assert.equal(api.getLrpWeekInfo(undefined),null);
assert.equal(api.getLrpWeekInfo('2026-02-30'),null);
assert.equal(api.getLrpWeekDates('2027-W53'),null);
assert.equal(api.getLrpTaskSchedule({}).week,'—');
assert.equal(api.getLrpTaskSchedule({startDate:'2026-11-16',dueDate:'2026-11-22'}).duration,'1周');
assert.equal(api.getLrpTaskSchedule({startDate:'2026-11-16',dueDate:'2026-11-16'}).duration,'1天');
assert.equal(api.getLrpCompletionWeekUpdate({startDate:'2026-11-16',dueDate:'2026-11-29'},'2026-W50').startDate,'2026-11-30');
assert.equal(api.getLrpCompletionWeekUpdate({},'2026-W50').dueDate,'2026-12-13');
const ordered=[{id:'empty'},{id:'next',dueDate:'2026-11-29'},{id:'first',dueDate:'2026-11-22'}].sort(api.compareLrpScheduledTasks);
assert.equal(ordered.map(x=>x.id).join(','),'first,next,empty');
const gridColumns=new api.GridView({},plugin).getColumnDefinitions().map(c=>c.key);
assert.ok(gridColumns.includes('completionWeek'));
assert.ok(!gridColumns.includes('start') && !gridColumns.includes('due'));
function RenderNode(tag,opts={}){
 this.tag=tag;this.text=opts.text || '';this.cls=opts.cls || '';this.attrs=opts.attr || {};this.children=[];this.style={setProperty(k,v){this[k]=v;}};
}
RenderNode.prototype.createEl=function(tag,opts){const node=new RenderNode(tag,opts);this.children.push(node);return node;};
RenderNode.prototype.createDiv=function(opts){return this.createEl('div',typeof opts==='string'?{cls:opts}:opts);};
RenderNode.prototype.createSpan=function(opts){return this.createEl('span',opts);};
RenderNode.prototype.empty=function(){this.children=[];};
const descendants=node=>[node,...node.children.flatMap(descendants)];
const domRoot=new RenderNode('div');
const rendererPortfolio=[{project:{id:'p1',name:'甲',calendarColor:'#aabbcc',buckets:[{id:'w',name:'第1周'}]},tasks:[{id:'late',title:'后',startDate:'2026-11-23',dueDate:'2026-11-29',bucketId:'w',progressMode:'manual',manualRemaining:60}]},{project:{id:'p2',name:'乙'},tasks:[{id:'early',title:'先',startDate:'2026-11-16',dueDate:'2026-11-22'}]}];
api.renderLrpPortfolioTable(domRoot,{plugin:{openTaskDetail(){}}},rendererPortfolio);
const renderedNodes=descendants(domRoot);
assert.equal(renderedNodes.filter(n=>n.tag==='th').map(n=>n.text).join(','),'项目,完成周,任务／阶段,周分组,持续时间,状态,子任务完成,完成进度,处理');
assert.equal(renderedNodes.filter(n=>n.cls==='lrp-task-open').map(n=>n.text).join(','),'先,后');
assert.ok(!renderedNodes.some(n=>n.text.includes('手动')));
assert.equal(renderedNodes.filter(n=>n.tag==='progress').length,2);
assert.ok(renderedNodes.some(n=>n.text==='2026年第47周'));
const timelineRoot=new RenderNode('div');
api.renderLrpPortfolioTimeline(timelineRoot,{plugin:{}},portfolio);
const timelineNodes=descendants(timelineRoot);
assert.equal(timelineNodes.filter(n=>n.cls==='lrp-project-span').map(n=>n.text).join(','),'100%,40%');
assert.ok(timelineNodes.some(n=>n.text==='2026年11月'));
assert.ok(timelineNodes.some(n=>n.text==='第48周'));
console.log('PASS: ISO year boundaries, missing/invalid dates, inclusive duration, week edits preserving duration, chronological rows, week-only columns, unified progress renderers, monthly timeline axis and runtime export');

const liveWeek={isConnected:true,textContent:''};
const staleWeek={isConnected:false};
const weekLabels=new Set([liveWeek,staleWeek]);
api.updateLrpWeekLabels(weekLabels,new Date('2026-11-22T12:00:00'));
assert.equal(liveWeek.textContent,'今天 · 2026年第47周');
api.updateLrpWeekLabels(weekLabels,new Date('2026-11-23T12:00:00'));
assert.equal(liveWeek.textContent,'今天 · 2026年第48周');
assert.equal(weekLabels.size,1);
console.log('PASS: week label advances across Monday without a view render, detached labels pruned');

const rules=api.getLrpPortfolioRules({});
assert.equal(rules.overdueDays,7);assert.equal(rules.previousWeeks,1);
const categoryAt=(task,date='2026-11-16')=>api.getLrpTaskCategory(task,[task],rules,new Date(date+'T12:00:00'));
assert.equal(categoryAt({id:'a',dueDate:'2026-11-08'}).key,'overdue');
assert.equal(categoryAt({id:'a',dueDate:'2026-11-09'}).key,'pending','exactly 7 days is not beyond 7');
assert.equal(categoryAt({id:'a',dueDate:'2026-11-15'}).previous,true);
assert.equal(categoryAt({id:'a',dueDate:'2026-11-22'}).current,true);
assert.equal(categoryAt({id:'a',dueDate:'2026-11-23'}).future,true);
assert.equal(categoryAt({id:'a',dueDate:'2026-11-08',completed:true}).key,'completed');
assert.equal(categoryAt({id:'a',dueDate:'2026-11-08',planningDisposition:'abandoned'}).key,'abandoned');
assert.equal(categoryAt({id:'a'}).key,'unscheduled');
assert.equal(categoryAt({id:'a',dueDate:'2026-11-08',completed:true}).recent,false);
assert.equal(categoryAt({id:'a',dueDate:'2026-11-15',completed:true}).recent,true);
assert.equal(categoryAt({id:'a',dueDate:'2025-01-01'}).recent,true,'old incomplete tasks stay visible');
assert.equal(categoryAt({id:'a',dueDate:'2027-01-03'},'2027-01-01').current,true);
assert.equal(api.matchesLrpTaskCategory(categoryAt({id:'a',dueDate:'2026-11-22',completed:true}),'current'),true);
const previousChecks=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await previousChecks;
 const current={id:'active',title:'当前',completed:false};
 const late={id:'late',title:'逾期',startDate:'2026-11-02',dueDate:'2026-11-08',progressMode:'manual',manualRemaining:60};
 const decisionPlugin={settings:{activeProjectId:'one',projects:[{id:'one'},{id:'two'}]},saveSettings:async()=>{}};
 const store=new api.TaskStore(decisionPlugin);decisionPlugin.taskStore=store;
 store.tasksByProject={one:[current],two:[late]};store.tasks=store.tasksByProject.one;store.loaded=true;store.rebuildIndex();
 const writes=[];let refreshes=0;store.subscribe(()=>refreshes++);
 const originalWrite=api.TaskStore.prototype.writeProjectFile;
 api.TaskStore.prototype.writeProjectFile=async function(pid,tasks){writes.push(pid);};
 try{
  await api.saveLrpPlanningDecision(decisionPlugin,'two','late','abandon',undefined,new Date('2026-11-16T04:00:00Z'));
  assert.equal(late.planningDisposition,'abandoned');assert.equal(late.percentComplete,40);
  assert.equal(late.dueDate,'2026-11-08');assert.equal(late.planningHistory.length,1);
  await api.saveLrpPlanningDecision(decisionPlugin,'two','late','restore');
  assert.equal(late.planningDisposition,'active');
  await api.saveLrpPlanningDecision(decisionPlugin,'two','late','replan','2026-W49');
  assert.equal(late.startDate,'2026-11-30');assert.equal(late.dueDate,'2026-12-06');assert.equal(late.percentComplete,40);
  assert.equal(late.planningHistory[2].dueDate,'2026-11-08');
  assert.equal(late.planningHistory.length,3);assert.equal(refreshes,3);
  assert.ok(writes.every(pid=>pid==='two'));assert.equal(store.tasks[0],current);assert.equal(decisionPlugin.settings.activeProjectId,'one');
  await assert.rejects(()=>api.saveLrpPlanningDecision(decisionPlugin,'two','late','replan','2027-W53'));
  assert.equal(late.planningHistory.length,3,'invalid replanning must not mutate history');
 }finally{api.TaskStore.prototype.writeProjectFile=originalWrite;}
 console.log('PASS: configurable overdue boundaries, previous/current/future weeks, retained history, abandoned/complete separation, isolated abandon/restore/replan writes, duration and progress preserved');
})();

const scheduledFamily=[{id:'stage',title:'阶段',dueDate:'2026-11-22',subtasks:[{id:'sub',title:'执行',dueDate:'2026-11-18',priority:'High'},{id:'undated',title:'未安排'}]}];
const calendarItems=api.getLrpCalendarTasks(scheduledFamily);
assert.equal(calendarItems.length,1);assert.equal(calendarItems[0]._lrpOwnerId,'stage');assert.equal(calendarItems[0].priority,'High');
assert.equal(api.getLrpCalendarTasks([{id:'simple',dueDate:'2026-11-22'}]).length,1);
assert.equal(api.getLrpCalendarTasks([{id:'parent',dueDate:'2026-11-22'},{id:'child',parentId:'parent',dueDate:'2026-11-18'}]).length,1);
for(const anchor of [{left:50,right:150,top:100,bottom:150},{left:900,right:1000,top:100,bottom:150},{left:200,right:1000,top:200,bottom:400}]){
 const pos=api.getLrpPreviewPosition(anchor,380,400,1200,800);
 assert.ok(pos.left>=12 && pos.left+pos.width<=1188);
 assert.ok(pos.left>=anchor.right || pos.left+pos.width<=anchor.left || pos.top>=anchor.bottom || pos.top+Math.min(400,pos.maxHeight)<=anchor.top);
}
const previewPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await previewPrevious;
 const plugin={settings:{activeProjectId:'a',projects:[{id:'a'},{id:'b'}]},saveSettings:async()=>{}};
 const store=new api.TaskStore(plugin);plugin.taskStore=store;store.tasksByProject={a:[{id:'other'}],b:scheduledFamily};store.tasks=store.tasksByProject.a;store.loaded=true;store.rebuildIndex();
 const old=api.TaskStore.prototype.writeProjectFile,writes=[];api.TaskStore.prototype.writeProjectFile=async function(pid){writes.push(pid);};
 try{
  await api.updateLrpCalendarTask(store,calendarItems[0],{completed:true});
  assert.equal(scheduledFamily[0].subtasks[0].completed,true);
  assert.equal(scheduledFamily[0].subtasks[0].dueDate,'2026-11-18');assert.equal(scheduledFamily[0].subtasks[0].priority,'High');
  assert.equal(scheduledFamily[0].subtasks[1].completed,undefined);
  await api.updateLrpCalendarTask(store,calendarItems[0],{description:'说明'});
  assert.equal(scheduledFamily[0].subtasks[0].description,'说明');assert.equal(plugin.settings.activeProjectId,'a');assert.ok(writes.every(id=>id==='b'));
 }finally{api.TaskStore.prototype.writeProjectFile=old;}
 console.log('PASS: scheduled embedded and independent subtasks prioritized without duplicating parents, preview placement avoids anchors, subtask completion/description saved to correct owner and project with metadata retained');
})();

const timelineProject={id:'tree',calendarColor:'#aa99bb',buckets:[{id:'w',name:'第1周',color:'#d9c4e8'}]};
const timelineData=[{id:'main',bucketId:'w',title:'任务',startDate:'2026-11-16',dueDate:'2026-11-22',subtasks:[{id:'small',title:'执行',dueDate:'2026-11-18'}]}];
const hierarchyPlugin={settings:{activeProjectId:'tree',projects:[timelineProject]},taskStore:{getAllForProject:()=>timelineData}};
const tree=api.getLrpTimelineTree(hierarchyPlugin,false);
assert.equal(tree[0].name,'第1周');assert.equal(tree[0].children[0].name,'任务');assert.equal(tree[0].children[0].children[0].name,'执行');
assert.equal(tree[0].children[0].color,tree[0].color);assert.equal(tree[0].children[0].children[0].color,tree[0].color);
assert.equal(api.flattenLrpTimelineTree(tree,new Set(),Date.parse('2026-11-16'),Date.parse('2026-11-22')).length,3);
assert.equal(api.flattenLrpTimelineTree(tree,new Set([tree[0].id]),Date.parse('2026-11-16'),Date.parse('2026-11-22')).length,1);
assert.equal(api.flattenLrpTimelineTree(tree,new Set(),Date.parse('2026-12-01'),Date.parse('2026-12-08')).length,0);
assert.equal(api.getLrpTimelineTree(hierarchyPlugin,true)[0].kind,'project');
assert.equal(timelineData[0].parentId,undefined);
console.log('PASS: week/task/subtask timeline hierarchy inherits board colors, collapse is view-only, offscreen date filtering preserves matching ancestors');

const dayPlugin={settings:{showAllProjects:true,activeProjectId:'a',projects:[{id:'a'},{id:'b'}]},taskStore:{getAllForProject:id=>id==='a'?[{id:'parent',title:'父任务',subtasks:[{id:'sub',title:'当天子任务',dueDate:'2026-11-16',priority:'High'}]},{id:'done',title:'完成',dueDate:'2026-11-16',completed:true}]:[{id:'b-task',title:'另一个项目',dueDate:'2026-11-16'},{id:'next',dueDate:'2026-11-17'}]}};
const dayItems=api.getLrpDayEntries(dayPlugin,'2026-11-16');assert.equal(dayItems.length,3);assert.equal(dayItems[0].task._lrpSubId,'sub');assert.equal(dayItems[2].task.completed,true);
dayPlugin.settings.showAllProjects=false;assert.equal(api.getLrpDayEntries(dayPlugin,'2026-11-16').length,2);assert.equal(api.getLrpDayEntries(dayPlugin,'2026-11-18').length,0);
console.log('PASS: daily card list includes all dated subtasks/tasks in selected project scope, excludes other dates, supports empty days and prioritizes urgent unfinished work');

assert.equal(api.getLrpSoftTimelineColor('#d9c4e8'),'#d9c4e8');
for(const color of ['#582b91','#007bff','#008000'])assert.match(api.getLrpSoftTimelineColor(color),/82%/);
console.log('PASS: existing pastel swatches retained; legacy dark purple, blue and green displayed as soft pastels without data migration');

const hideSettings={projectsBasePath:'long-range-planner',projects:[{name:'项目甲',storageKey:'实际目录'}]};
const hiddenCss=api.getLrpHiddenProjectFolderCss(hideSettings);
assert.ok(hiddenCss.includes('long-range-planner/实际目录'));
assert.ok(hiddenCss.includes('data-type="file-explorer"'));
assert.ok(!hiddenCss.includes('功能说明.md'));
hideSettings.projects.push({name:'新项目'});
assert.ok(api.getLrpHiddenProjectFolderCss(hideSettings).includes('long-range-planner/新项目'));
assert.equal(api.getLrpHiddenProjectFolderCss({projects:[]}), '');
console.log('PASS: folder hiding uses project storage paths, includes future projects, preserves guide visibility, is scoped to file explorer');

// Shared status is derived without overwriting task data, across the grace boundary.
const statusPlugin={settings:{}};
const statusNow=new Date('2026-11-16T12:00:00');
const statusTask={id:'status-test',status:'In Progress',dueDate:'2026-11-08'};
const statusBefore=JSON.stringify(statusTask);
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,statusTask,[statusTask],statusNow),'逾期');
assert.equal(JSON.stringify(statusTask),statusBefore);
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,{...statusTask,dueDate:'2026-11-09'},[],statusNow),'进行中');
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,{...statusTask,completed:true},[],statusNow),'已完成');
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,{...statusTask,planningDisposition:'abandoned'},[],statusNow),'已放弃');
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,{...statusTask,dueDate:'2026-11-22'},[],statusNow),'进行中');
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,{...statusTask,dueDate:null},[],statusNow),'进行中');
assert.equal(api.getLrpTaskDisplayStatus(statusPlugin,{...statusTask,subtasks:[{completed:true}]},undefined,statusNow),'已完成');
console.log('PASS: shared overdue status, seven-day grace, completion, abandonment, replanning, no mutation');

// Each dependency opens the actual predecessor, never the dependent task.
const dependencyRoot=new RenderNode('td');
const predecessorA={id:'pre-a',title:'前置甲'},predecessorB={id:'pre-b',title:'前置乙'};
const dependent={id:'dependent',dependencies:[{predecessorId:'pre-a',type:'FS'},{predecessorId:'pre-b',type:'SS'},{predecessorId:'deleted'}]};
const openedPredecessors=[];
api.renderLrpPredecessorLinks(dependencyRoot,{openTaskDetail:task=>openedPredecessors.push(task)},dependent,[predecessorA,predecessorB,dependent]);
const predecessorButtons=descendants(dependencyRoot).filter(node=>node.tag==='button');
assert.equal(predecessorButtons.map(node=>node.text).join(','),'前置甲,前置乙');
let stopped=0;
for(const button of predecessorButtons)button.onclick({stopPropagation(){stopped++;}});
assert.equal(openedPredecessors[0],predecessorA);
assert.equal(openedPredecessors[1],predecessorB);
assert.equal(stopped,2);
assert.ok(descendants(dependencyRoot).some(node=>node.text==='前置任务已不存在'));
assert.ok(source.includes("row.classList.add('lrp-completed-row')"));
console.log('PASS: predecessor links resolve correct targets, multiple and missing dependencies, event propagation, completed row hook');

// Dependency layout is deterministic, project-local and directed left to right.
const graphTasks=[{id:'a',title:'A'},{id:'b',dependencies:[{predecessorId:'a'}]},{id:'c',dependencies:[{predecessorId:'a'}]},{id:'d',dependencies:[{predecessorId:'b'},{predecessorId:'c'}]},{id:'unrelated'},{id:'orphan',dependencies:[{predecessorId:'missing'}]}];
const graphBefore=JSON.stringify(graphTasks),graphLayout=api.getLrpDependencyLayout(graphTasks);
assert.equal(graphLayout.nodes.length,6);assert.equal(graphLayout.edges.length,4);
for(const edge of graphLayout.edges)assert.ok(graphLayout.nodes.find(n=>n.id===edge.source).x<graphLayout.nodes.find(n=>n.id===edge.target).x);
for(const a of graphLayout.nodes)for(const b of graphLayout.nodes)if(a!==b)assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y);
assert.equal(JSON.stringify(api.getLrpDependencyLayout(graphTasks)),JSON.stringify(graphLayout));
assert.equal(JSON.stringify(graphTasks),graphBefore);
assert.equal(api.getLrpDependencyLayout([{id:'a',dependencies:[{predecessorId:'b'}]},{id:'b',dependencies:[{predecessorId:'a'}]}]).nodes.length,2);
assert.equal(api.getLrpDependencyLayout([]).nodes.length,0);
const graphPath=api.getLrpDependencyPath(graphLayout.nodes[0],graphLayout.nodes[1]);assert.ok(graphPath.startsWith('M '));assert.ok(!graphPath.includes('NaN'));
console.log('PASS: stable dependency layers, branches/joins without overlapping cards, missing links, cycle safety, unchanged data');

// Exercise the production DOM renderer, project scoping, SVG edges, click and drag.
function GraphNode(tag,opts={}){RenderNode.call(this,tag,opts);this.classList={add(){},remove(){}};this.scrollTop=0;this.scrollLeft=0;this.ownerDocument={createElementNS:(_ns,tag)=>new GraphNode(tag)};}
GraphNode.prototype=Object.create(RenderNode.prototype);
GraphNode.prototype.createEl=function(tag,opts){const child=new GraphNode(tag,opts);this.children.push(child);return child;};
GraphNode.prototype.appendChild=function(child){this.children.push(child);};
GraphNode.prototype.setAttribute=function(key,value){this.attrs[key]=value;};
GraphNode.prototype.setPointerCapture=function(){};
const graphOpened=[];
const graphView=new api.DependencyGraphView({}, {settings:{showAllProjects:true,projects:[{id:'graph-p',name:'虚构项目',calendarColor:'#cabbdd'}]},taskStore:{getAllForProject:()=>graphTasks},openTaskDetail:t=>graphOpened.push(t)});
graphView.graphContent=new GraphNode('div');
const graphRenderCheck=graphView.refresh();
const graphRendered=descendants(graphView.graphContent),graphCards=graphRendered.filter(n=>n.cls==='lrp-dependency-card');
assert.equal(graphCards.length,6);assert.equal(graphRendered.filter(n=>n.tag==='svg').length,1);
graphCards[0].onclick({});assert.equal(graphOpened[0],graphTasks[0]);
graphCards[0].onpointerdown({button:0,clientX:0,clientY:0,pointerId:1});
graphCards[0].onpointermove({clientX:15,clientY:10});graphCards[0].onpointerup();graphCards[0].onclick({});
assert.equal(graphOpened.length,1);assert.equal(graphView.dragNode,null);assert.equal(JSON.stringify(graphTasks),graphBefore);
assert.equal(graphCards[0].style.left,'39px');
console.log('PASS: production dependency DOM/SVG render, task click, drag without accidental open or task mutation');

// Project filters retain every task, including incomplete and unlinked tasks.
const projectFilterPlugin={settings:{}};
const mixedProject=[{id:'done',completed:true},{id:'working',status:'In Progress'},{id:'unlinked',status:'Not Started'}];
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,mixedProject,'completed',statusNow),false);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,mixedProject,'inProgress',statusNow),true);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,mixedProject,'unfinished',statusNow),true);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,[{id:'new',status:'Not Started'}],'notStarted',statusNow),true);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,[{id:'late',dueDate:'2026-11-08'}],'overdue',statusNow),true);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,[{id:'blocked',status:'Blocked'}],'blocked',statusNow),true);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,[{id:'abandoned',planningDisposition:'abandoned'}],'abandoned',statusNow),true);
assert.equal(api.matchesLrpDependencyProject(projectFilterPlugin,[],'completed',statusNow),false);
graphView.lrpDependencyProjectStatus='completed';graphView.refresh();assert.equal(descendants(graphView.graphContent).filter(node=>node.cls==='lrp-dependency-card').length,6);
const allDoneGraph=graphTasks.map(task=>({...task,completed:true,status:'Completed'}));
graphView.plugin.taskStore.getAllForProject=()=>allDoneGraph;graphView.refresh();
assert.equal(descendants(graphView.graphContent).filter(node=>node.cls==='lrp-dependency-card').length,6);
assert.equal(descendants(graphView.graphContent).filter(node=>node.tag==='g').length,4);
assert.equal(api.getLrpDependencyLayout([{id:'alone',title:'无依赖任务'}]).nodes.length,1);
console.log('PASS: project-level completed/in-progress/not-started/overdue/blocked/abandoned filters; full project tasks and edges retained, including unlinked tasks');

const headingPreviousChecks=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await headingPreviousChecks;
 const calls=[],taskData=[{id:'preserved',title:'保留'}];
 const settings={showAllProjects:true,activeProjectId:'old',projects:[{id:'p-heading'}]};
 const headingView={plugin:{settings,saveSettings:async()=>calls.push('save'),taskStore:{load:async()=>calls.push('load'),tasks:taskData}},render:async()=>calls.push('render')};
 await api.openLrpProjectFromHeading(headingView,'p-heading');
 assert.equal(settings.showAllProjects,false);assert.equal(settings.activeProjectId,'p-heading');
 assert.equal(calls.join(','),'save,load,render');assert.equal(headingView.plugin.taskStore.tasks,taskData);assert.equal(headingView.lrpProjectOpening,false);
 calls.length=0;await api.openLrpProjectFromHeading(headingView,'missing');assert.equal(calls.length,0);
 headingView.lrpProjectOpening=true;await api.openLrpProjectFromHeading(headingView,'p-heading');assert.equal(calls.length,0);
 console.log('PASS: project heading opens correct single-project scope, saves and reloads before rendering, preserves tasks, ignores invalid/repeated opens');
})();

// Project status and search hide whole sections without filtering or changing tasks.
const boardFilterRoot=new GraphNode('div');
const boardProjects=[{id:'board-done',name:'海风展览'},{id:'board-mixed',name:'星桥活动'}];
const boardProjectTasks={'board-done':[{id:'bd',completed:true}],'board-mixed':[{id:'bm-d',completed:true},{id:'bm-w',status:'In Progress'}]};
const boardFilterRecords=boardProjects.map(project=>({project,section:{hidden:false}}));
const boardFilterView={plugin:{settings:{},taskStore:{getAllForProject:id=>boardProjectTasks[id]}}};
api.addLrpBoardProjectFilters(boardFilterRoot,boardFilterView,boardFilterRecords);
const boardStatus=descendants(boardFilterRoot).find(node=>node.tag==='select');
const boardSearch=descendants(boardFilterRoot).find(node=>node.tag==='input');
boardStatus.value='completed';boardStatus.onchange();
assert.equal(boardFilterRecords[0].section.hidden,false);assert.equal(boardFilterRecords[1].section.hidden,true);
boardStatus.value='all';boardStatus.onchange();boardSearch.value='星桥';boardSearch.oninput();
assert.equal(boardFilterRecords[0].section.hidden,true);assert.equal(boardFilterRecords[1].section.hidden,false);
assert.equal(boardProjectTasks['board-mixed'].length,2);assert.equal(boardFilterView.lrpBoardProjectSearch,'星桥');
boardSearch.value='不存在';boardSearch.oninput();assert.equal(descendants(boardFilterRoot).find(node=>node.cls==='lrp-project-finder-empty').hidden,false);
console.log('PASS: board project filters/search operate on full projects, preserve all tasks, persist view choices and show empty results');

assert.equal(api.getBoardLayout(1800,2).visible,2);
assert.equal(api.getBoardLayout(1800).visible,3);
const finderRoot=new GraphNode('div');let scrolled=0;
const finderRecords=boardProjects.map(project=>({project,section:{hidden:false,classList:{toggle(){}},scrollIntoView(){scrolled++;}}}));
const finderView={plugin:boardFilterView.plugin};
const finder=api.createLrpProjectFinder(finderRoot,finderView,finderRecords,'testFinder');
const finderButtons=descendants(finderRoot).filter(node=>node.tag==='button');finderButtons[1].onclick();
assert.equal(finderView.testFinderFocusedProject,'board-mixed');assert.equal(scrolled,1);assert.equal(finderButtons[1].attrs['aria-pressed'],'true');
assert.equal(finderRecords[0].section.hidden,false);assert.equal(finderRecords[1].section.hidden,false);
assert.equal(typeof finderButtons[1].ondblclick,'function');
console.log('PASS: sidebar finder focuses/scrolls/highlights without hiding other matching projects; all-project board forced to two weeks, single-project responsive layout preserved');

assert.equal(api.getBoardLayout(2200,2).visible,2);
assert.equal(api.getBoardLayout(2200).visible,3);
const finderPreviousChecks=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await finderPreviousChecks;
 const calls=[];
 const dependencyScopeView={plugin:{settings:{projects:[{id:'dep-open'}],showAllProjects:true},saveSettings:async()=>calls.push('save'),taskStore:{load:async()=>calls.push('load')}},lrpRenderProjectScope:async()=>calls.push('scope')};
 await api.openLrpProjectFromHeading(dependencyScopeView,'dep-open');
 assert.equal(dependencyScopeView.plugin.settings.activeProjectId,'dep-open');assert.equal(dependencyScopeView.plugin.settings.showAllProjects,false);
 assert.equal(calls.join(','),'save,load,scope');
 console.log('PASS: dependency project entry rebuilds the single-project UI after save/load; embedded boards use two weeks even on large screens');
})();

const headingControls=renderedNodes.find(node=>node.cls==='lrp-portfolio-heading-controls');
assert.ok(headingControls.children.some(node=>node.tag==='h3'));
assert.ok(headingControls.children.some(node=>node.cls==='lrp-portfolio-filters'));
const scopeChangePreviousChecks=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await scopeChangePreviousChecks;
 const events=[];
 const scopeChangeView={plugin:{taskStore:{load:async()=>events.push('load')}},lrpRenderProjectScope:async()=>events.push('rebuild-finder')};
 await api.DependencyGraphView.prototype.onLrpProjectScopeChange.call(scopeChangeView);
 assert.equal(events.join(','),'load,rebuild-finder');
 console.log('PASS: portfolio controls share title row; dependency project selector rebuilds finder rather than refreshing obsolete layout');
})();

// All views share one task/project model; progress rounding cannot mark work done.
const unifiedPlugin={settings:{projects:[]}};
const unifiedDashboard=new api.DashboardView({},unifiedPlugin);
const zeroStarted=[{id:'u0',status:'In Progress',percentComplete:0}];
assert.equal(api.getLrpProjectState(unifiedPlugin,zeroStarted).inProgress,true);
assert.equal(api.matchesLrpProjectStatus(unifiedPlugin,zeroStarted,'in-progress'),true);
assert.equal(api.matchesLrpDependencyProject(unifiedPlugin,zeroStarted,'inProgress'),true);
assert.equal(api.getLrpProjectState(unifiedPlugin,zeroStarted).notStarted,false);
const restoredDate=api.toDateStr(new Date());
const abandonedTasks=[{id:'ua',status:'Not Started',planningDisposition:'abandoned',dueDate:restoredDate,priority:'High'}];
const abandonedStats=unifiedDashboard.calculateProjectStats('p','归档',abandonedTasks);
assert.equal(abandonedStats.notStartedTasks,0);assert.equal(abandonedStats.dueTodayTasks,0);assert.equal(abandonedStats.dueThisWeekTasks,0);assert.equal(abandonedStats.highPriorityTasks,0);
assert.equal(api.getLrpProjectState(unifiedPlugin,abandonedTasks).abandoned,true);
assert.equal(api.matchesLrpProjectStatus(unifiedPlugin,abandonedTasks,'unfinished'),false);
assert.equal(api.getLrpTaskState(unifiedPlugin,abandonedTasks[0],abandonedTasks).status,'Abandoned');
const partialTask={id:'up',status:'Not Started',percentComplete:20};
assert.equal(api.getLrpTaskDisplayStatus(unifiedPlugin,partialTask,[partialTask]),'进行中');
assert.equal(unifiedDashboard.calculateProjectStats('p','有进展',[partialTask]).inProgressTasks,1);
const nearlyDone=Array.from({length:21},(_,index)=>({id:'n'+index,status:index===20?'In Progress':'Completed',percentComplete:index===20?90:100}));
assert.equal(api.getLrpProjectState(unifiedPlugin,nearlyDone).progress,99);
assert.equal(api.matchesLrpProjectStatus(unifiedPlugin,nearlyDone,'completed'),false);
assert.equal(unifiedDashboard.calculateProjectStats('p','尚未全完成',nearlyDone).completionPercentage,99);
const almostChecklist={id:'many',subtasks:Array.from({length:201},(_,i)=>({id:String(i),completed:i!==200}))};
assert.equal(api.calculateLrpProgress(almostChecklist,[almostChecklist]),99);assert.equal(api.isLrpTaskComplete(almostChecklist,[almostChecklist]),false);
const oldParent={id:'parent',status:'Completed',completed:true},incompleteChild={id:'child',parentId:'parent',status:'Not Started'};
assert.equal(api.isLrpTaskComplete(oldParent,[oldParent,incompleteChild]),false);
assert.notEqual(api.getLrpTaskState(unifiedPlugin,oldParent,[oldParent,incompleteChild]).status,'Completed');
const lateBlocked={id:'ul',status:'Blocked',dueDate:'2026-11-08'};
assert.equal(api.getLrpTaskState(unifiedPlugin,lateBlocked,[lateBlocked],statusNow).status,'Overdue');
assert.equal(api.matchesLrpTaskStatus(unifiedPlugin,lateBlocked,[lateBlocked],'Blocked',statusNow),false);
assert.equal(api.getLrpProjectState(unifiedPlugin,[lateBlocked],statusNow).blocked,true);
assert.equal(api.getLrpProjectState(unifiedPlugin,[lateBlocked],statusNow).overdue,true);
assert.equal(api.getLrpTaskState(unifiedPlugin,{...lateBlocked,planningDisposition:'abandoned'},[],statusNow).overdue,false);
assert.equal(api.getLrpTaskState(unifiedPlugin,{...lateBlocked,dueDate:'2026-11-22'},[],statusNow).status,'Blocked');
const startOnly=api.getLrpCalendarTasks([{id:'startOnly',startDate:'2026-10-01'}])[0];
assert.equal(api.getLrpTaskState(unifiedPlugin,startOnly,[startOnly],statusNow).overdue,false);
const unifiedBefore=JSON.stringify(nearlyDone);api.getLrpProjectState(unifiedPlugin,nearlyDone);assert.equal(JSON.stringify(nearlyDone),unifiedBefore);
console.log('PASS: unified project/task states, zero-percent started, archived reminders excluded, progress/status disagreement, strict structural completion, no rounded false completion, overlapping project alerts, calendar start-only safety and no mutation');

const archivedChild={id:'arch-child',parentId:'arch-parent',completed:true,status:'Completed',planningDisposition:'abandoned'};
const archivedParent={id:'arch-parent',status:'Not Started'};
assert.equal(api.isLrpTaskComplete(archivedParent,[archivedParent,archivedChild]),false);
assert.equal(api.getLrpSubtaskSummary(archivedParent,[archivedParent,archivedChild]).completed,0);
assert.equal(api.getLrpProjectState(unifiedPlugin,[]).notStarted,true);
assert.equal(api.getLrpProjectState(unifiedPlugin,[]).done,false);
const fullyDone=[{id:'done-a',completed:true},{id:'done-b',status:'Completed'}];
assert.equal(api.getLrpProjectState(unifiedPlugin,fullyDone).done,true);
assert.equal(api.getLrpProjectState(unifiedPlugin,fullyDone).progress,100);
console.log('PASS: abandoned children never count as completed; empty and fully completed projects remain distinct');
