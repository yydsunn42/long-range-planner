const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/../main.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync(__dirname + '/../manifest.json', 'utf8'));
const Base = class {};
const sandbox = {
  require: () => new Proxy({}, {get: () => Base}),
  module: {exports: {}}, console,
  crypto: require('node:crypto').webcrypto,
};
vm.runInNewContext(source + '\nthis.check = {getLrpDependencyConnection,refreshLrpDateStatus,bindLrpBoardSubtaskPreview,getLrpPreviewTaskContext,renderLrpPreviewTaskContext,captureLrpViewState,restoreLrpViewState,installLrpViewState,applyLrpModalExperience,getLrpProjectGroups,getLrpProjectGroupId,sortLrpGroupedProjects,saveLrpProjectGroup,renderLrpGroupedProjectPicker,buildLrpGroupedProjectFinder,LrpManageProjectsModal,getLrpPinnedFingerprint,LrpProjectReviewModal,saveLrpProjectReview,renderLrpProjectReview,getLrpScoreAnalysisRows,renderLrpDetailedScoreAnalysis,getLrpCostAnalysis,formatLrpCostDifference,saveLrpCostNote,LrpCostAnalysisModal,renderLrpCostDashboardSection,setupLrpPinnedSections,saveLrpTaskCosts,LrpTaskCostModal,renderLrpEditableCostCell,LrpScoreAnalysisModal,getLrpBucketNumber,getLrpNextBucketNumber,getLrpBucketCalendar,getLrpBucketTaskDefaults,getLrpBucketMoveDefaults,saveLrpBucketSchedule,LrpBucketScheduleModal,getLrpEntryReview,isLrpAssessmentTask,addLrpAssessmentTask,renderLrpAssessmentColumn,getLrpLargeTaskScores,renderLrpBoardScore,renderLrpScoreAnalysis,getLrpScoringSettings,validateLrpScoringSettings,getLrpSubtaskReviewEntries,getLrpProjectScores,prepareLrpSubtaskReviews,saveLrpSubtaskScore,enqueueLrpSubtaskReviews,addLrpScoringSettingsEditor,renderLrpProjectScores,LrpSubtaskScoreModal,getLrpProjectBriefText,formatLrpProjectDuration,renderLrpProjectOverview,saveLrpProjectOverview,createLrpProject,getWeekDates,toDateStr,MyDayView,GanttView,BoardView,TaskDetailView,DEFAULT_SETTINGS,KPI_DEFINITIONS,makePersonalBucket,LRP_BUCKET_PALETTE,getBoardPageSize,clampBoardStart,ensureProjectCalendarColors,getProjectCalendarColor,isUrgentPriority,bucketColorsAreSimilar,chooseBucketColor,getBoardLayout,createPersonalTag,lrpText,LRP_FUNCTION_HELP,addLrpHelpDisclosure,getLrpDetailGroup,groupLrpTaskDetails,TaskStore,getVisibleLrpProjects,openLrpProjectFromHeading,createLrpSubtaskDraft,getLrpProjectTags,getLrpTaskTagIds,LrpProjectTagModal,addLrpBoardProjectFilters,createLrpProjectFinder,deleteLrpProjects,LrpDeleteProjectsModal,createLrpProjectScope,calculateLrpProgress,applyLrpProgress,createLrpEmbeddedLeaf,clearLrpLeakedViewContainers,getLrpSubtaskSummary,getLrpPortfolio,getLrpTimelineRange,getLrpWeekInfo,getLrpHiddenProjectFolderCss,getLrpSoftTimelineColor,getLrpDayEntries,getLrpTimelineTree,flattenLrpTimelineTree,getLrpCalendarTasks,getLrpTaskTarget,updateLrpCalendarTask,getLrpPreviewPosition,DependencyGraphView,matchesLrpDependencyProject,getLrpDependencyLayout,getLrpDependencyPath,getLrpPortfolioRules,getLrpTaskDisplayStatus,isLrpTaskComplete,getLrpTaskState,getLrpProjectState,matchesLrpTaskStatus,matchesLrpProjectStatus,DashboardView,renderLrpPredecessorLinks,getLrpTaskCategory,matchesLrpTaskCategory,saveLrpPlanningDecision,updateLrpWeekLabels,formatLrpWeek,getLrpTaskSchedule,getLrpWeekDates,getLrpCompletionWeekUpdate,compareLrpScheduledTasks,renderLrpPortfolioTable,renderLrpPortfolioTimeline,GridView};', sandbox);
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
assert.ok(source.includes('await this.renderUnassignedBucket(pinned, tasks.filter'));
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
assert.equal(helpRoot.children[0].tagName,'h3');
assert.equal(helpRoot.children[0].textContent,'工时','heading retained without help disclosure');
assert.equal(helpRoot.children.length,1);
console.log('PASS: Chinese labels and user content preserved, help disclosures removed');

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
const detailCss=fs.readFileSync(__dirname+'/../styles.css','utf8');
assert.ok(detailCss.includes('.lrp-detail-field { display: flex; flex-direction: column; gap: 10px; min-width: 0; }'),'fields keep one vertical rhythm');
assert.ok(detailCss.includes('.lrp-detail-field > * { margin-top: 0; margin-bottom: 0; }'),'stray control margins must not double the gap');
assert.ok(detailCss.includes('.lrp-detail-field > button { align-self: flex-start; }'),'wide flex column must not stretch inline buttons');
console.log('PASS: related detail fields grouped into cards, original controls and handlers preserved, no duplicate grouping');

const scopeSettings={projects:[{id:'p1',name:'项目一'},{id:'p2',name:'项目二'}],activeProjectId:'p1',showAllProjects:false};
assert.equal(api.getVisibleLrpProjects(scopeSettings).length,1);
assert.equal(api.getVisibleLrpProjects(scopeSettings)[0].id,'p1');
scopeSettings.showAllProjects=true;
assert.equal(api.getVisibleLrpProjects(scopeSettings).length,2);
const scopedCalendar=new api.MyDayView({}, {settings:scopeSettings,taskStore:{getAllForProject:id=>[{id:'owner-'+id},{id,parentId:'owner-'+id,dueDate:'2026-11-17'}]}});
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
assert.equal(liveWeek.textContent,'2026年第47周');
api.updateLrpWeekLabels(weekLabels,new Date('2026-11-23T12:00:00'));
assert.equal(liveWeek.textContent,'2026年第48周');
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
  await api.updateLrpCalendarTask(store,calendarItems[0],{dueDate:'2026-11-20'});
  assert.equal(scheduledFamily[0].subtasks[0].dueDate,'2026-11-20');
  assert.equal(scheduledFamily[0].subtasks[0].priority,'High');
  assert.equal(scheduledFamily[0].subtasks[0].startDate,undefined);
  assert.equal(scheduledFamily[0].subtasks[1].dueDate,undefined);
  assert.equal(scheduledFamily[0].dueDate,'2026-11-22','moving a subtask must not move its owner task');
  const calendarView=new api.MyDayView({},plugin);
  const freshItem=api.getLrpCalendarTasks(scheduledFamily)[0];
  assert.equal(await calendarView.moveLrpCalendarEntry({task:freshItem},'2026-11-20'),false,'same-day drops write nothing');
  assert.equal(await calendarView.moveLrpCalendarEntry({task:freshItem},'2026-11-21'),true);
  assert.equal(scheduledFamily[0].subtasks[0].dueDate,'2026-11-21');
  assert.equal(scheduledFamily[0].subtasks[0].priority,'High');
  const topTask={id:'top',title:'顶层任务',dueDate:'2026-11-19'};store.tasksByProject.b.push(topTask);store.rebuildIndex();
  assert.equal(api.getLrpCalendarTasks(store.tasksByProject.b).some(task=>task.id==='top'),true);
  const topItem=topTask;
  assert.equal(await calendarView.moveLrpCalendarEntry({task:topItem},'2026-11-23'),true);
  assert.equal(topTask.dueDate,'2026-11-23');
  assert.equal(topTask.startDate,undefined);
  const calendarCss=fs.readFileSync(__dirname+'/../styles.css','utf8');
  assert.ok(calendarCss.includes('.myday-drop-target'));
  assert.ok(calendarCss.includes('.myday-card-dragging'));
  assert.ok(source.includes('attachLrpCalendarDropTarget(column, dateStr)'));
  assert.ok(source.includes('attachLrpCalendarDropTarget(cell, dateStr)'));
 }finally{api.TaskStore.prototype.writeProjectFile=old;}
 console.log('PASS: week/month drag targets move due dates for tasks and embedded subtasks without touching owners or start dates, same-day drops do nothing, and calendar update keeps metadata');
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

const dayPlugin={settings:{showAllProjects:true,activeProjectId:'a',projects:[{id:'a'},{id:'b'}]},taskStore:{getAllForProject:id=>id==='a'?[{id:'parent',title:'父任务',subtasks:[{id:'sub',title:'当天子任务',dueDate:'2026-11-16',priority:'High'}]},{id:'done',parentId:'parent',title:'完成',dueDate:'2026-11-16',completed:true}]:[{id:'b-root',title:'所属任务'},{id:'b-task',parentId:'b-root',title:'另一个项目',dueDate:'2026-11-16'},{id:'next',parentId:'b-root',dueDate:'2026-11-17'}]}};
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
const graphFirstX=parseFloat(graphCards[0].style.left);
graphCards[0].onpointerdown({button:0,clientX:0,clientY:0,pointerId:1});
graphCards[0].onpointermove({clientX:15,clientY:10});graphCards[0].onpointerup();graphCards[0].onclick({});
assert.equal(graphOpened.length,1);assert.equal(graphView.dragNode,null);assert.equal(JSON.stringify(graphTasks),graphBefore);
assert.equal(graphCards[0].style.left,`${graphFirstX+15}px`);
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
const finderRoot=new GraphNode('div');let scrolled=0,finderScrollOptions;
const finderRecords=boardProjects.map(project=>({project,section:{hidden:false,classList:{toggle(){}},scrollIntoView(options){scrolled++;finderScrollOptions=options;}}}));
const finderView={plugin:boardFilterView.plugin};
const finder=api.createLrpProjectFinder(finderRoot,finderView,finderRecords,'testFinder');
const finderButtons=descendants(finderRoot).filter(node=>node.tag==='button'&&node.attrs.title).sort((a,b)=>a.text.localeCompare(b.text));const mixedButton=finderButtons.find(button=>button.text==='星桥活动');mixedButton.onclick();
assert.equal(finderView.testFinderFocusedProject,'board-mixed');assert.equal(scrolled,1);assert.equal(finderScrollOptions.block,'start');assert.equal(finderScrollOptions.inline,'nearest');assert.equal(mixedButton.attrs['aria-pressed'],'true');
assert.equal(finderRecords[0].section.hidden,false);assert.equal(finderRecords[1].section.hidden,false);
assert.equal(typeof mixedButton.ondblclick,'function');
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
const startOnly=api.getLrpCalendarTasks([{id:'startOnly',parentId:'start-parent',startDate:'2026-10-01'}])[0];
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

const projectCreationPrevious = this.lrpAsyncChecks;
this.lrpAsyncChecks = (async () => {
 await projectCreationPrevious;
 let nextId = 0;
 sandbox.crypto = {randomUUID: () => `new-project-id-${++nextId}`};
 const existing = {id:'existing',name:'已有项目',storageKey:'New Project',calendarColor:'#5d99a7',buckets:[{id:'old',name:'保留分组'}]};
 const original = JSON.stringify(existing);
 const settings = {projects:[existing],activeProjectId:'existing',showAllProjects:true};
 let writes = 0;
 const creationPlugin = {settings,saveSettings:async()=>{writes++;}};
 await assert.rejects(api.createLrpProject(creationPlugin,'  '),/请输入/);
 await assert.rejects(api.createLrpProject(creationPlugin,' 已有项目 '),/同名/);
 assert.equal(writes,0);
 const created = await api.createLrpProject(creationPlugin,'  新目标  ');
 assert.equal(created.name,'新目标');
 assert.notEqual(created.storageKey,existing.storageKey);
 assert.equal(settings.activeProjectId,created.id);
 assert.equal(settings.showAllProjects,false);
 assert.equal(created.buckets.map(b=>b.name).join(','),'第1周,第2周,第3周');
 assert.equal(new Set(created.buckets.map(b=>b.id)).size,3);
 assert.equal(created.tasks,undefined);
 assert.equal(JSON.stringify(existing),original);
 assert.equal(settings.projects.length,2);
 const before = JSON.stringify(settings);
 creationPlugin.saveSettings=async()=>{throw new Error('disk full');};
 await assert.rejects(api.createLrpProject(creationPlugin,'保存失败的项目'),/disk full/);
 assert.equal(JSON.stringify(settings),before);
 console.log('PASS: project creation validates names, isolates storage, preserves existing data, selects new blank weeks and rolls back failed saves');
})();

const overviewPrevious = this.lrpAsyncChecks;
this.lrpAsyncChecks = (async () => {
 await overviewPrevious;
 const project={id:'brief-p',name:'原名',storageKey:'fixed-data-folder',calendarColor:'#123456',buckets:[{id:'b'}],overview:{custom:'保留扩展'}};
 const other={id:'other',name:'另一个项目'};
 const plugin={settings:{projects:[project,other],activeProjectId:'other',showAllProjects:true},saveSettings:async()=>{}};
 const tasks=[{id:'task',projectId:'brief-p',title:'已有任务'}];
 const protectedBefore=JSON.stringify({storageKey:project.storageKey,buckets:project.buckets,color:project.calendarColor,tasks,other,active:plugin.settings.activeProjectId,all:plugin.settings.showAllProjects});
 await api.saveLrpProjectOverview(plugin,'brief-p',{name:' 新名称 ',introduction:' 简介\n第二行 ',goals:'<script>纯文本</script>',approach:'实现办法',plan:'阶段一'});
 assert.equal(project.name,'新名称');assert.equal(project.overview.introduction,'简介\n第二行');assert.equal(project.overview.custom,'保留扩展');assert.equal(project.overview.goals,undefined);
 assert.equal(JSON.stringify({storageKey:project.storageKey,buckets:project.buckets,color:project.calendarColor,tasks,other,active:plugin.settings.activeProjectId,all:plugin.settings.showAllProjects}),protectedBefore);
 const saved=JSON.stringify(project);
 await assert.rejects(api.saveLrpProjectOverview(plugin,'brief-p',{name:'另一个项目'}),/同名/);
 await assert.rejects(api.saveLrpProjectOverview(plugin,'brief-p',{name:' '}),/请输入/);
 await assert.rejects(api.saveLrpProjectOverview(plugin,'deleted',{name:'不存在'}),/不存在/);
 assert.equal(JSON.stringify(project),saved);
 plugin.saveSettings=async()=>{throw new Error('disk error');};
 await assert.rejects(api.saveLrpProjectOverview(plugin,'brief-p',{name:'失败',plan:'不应保存'}),/disk error/);
 assert.equal(JSON.stringify(project),saved);
 delete project.overview;delete project.lastUpdatedDate;
 const legacy=JSON.stringify(project);
 await assert.rejects(api.saveLrpProjectOverview(plugin,'brief-p',{name:'旧项目失败'}),/disk error/);
 assert.equal(JSON.stringify(project),legacy);
 console.log('PASS: project overview rename/brief persistence, multiline plain text, legacy records, duplicate/empty/missing validation, storage/task/scope preservation and save rollback');
})();

const briefParent=new GraphNode('div');
const briefProject={id:'cards',name:'项目',calendarColor:'#5d99a7',overview:{goals:'第一行\n<目标>'}};
const briefPanel=api.renderLrpProjectOverview(briefParent,{settings:{projects:[briefProject]}},briefProject,()=>{});
assert.equal(briefPanel.open,false);
const briefNodes=descendants(briefPanel);
const briefSections=briefNodes.filter(n=>typeof n.cls==='string' && n.cls.split(' ').includes('lrp-project-overview-section'));
assert.equal(briefSections.length,3);
assert.deepEqual(briefSections.map(n=>n.children[0].text),['简介与目标','实现思路','阶段规划']);
assert.equal(briefSections.filter(n=>n.cls.includes('lrp-project-overview-stage')).length,1,'stage planning spans the right column');
const briefSummary=briefNodes.find(n=>n.tag==='summary');
assert.ok(briefSummary,'summary stays the disclosure toggle');
const briefDuration=descendants(briefSummary).find(n=>n.cls==='lrp-project-overview-duration');
assert.ok(briefDuration,'duration lives on the summary line');
assert.deepEqual(briefDuration.children.map(n=>n.text),['预计所需时间','未设置']);
assert.ok(briefNodes.some(n=>n.text==='第一行\n<目标>'));
const overviewCss=fs.readFileSync(__dirname+'/../styles.css','utf8');
assert.ok(!overviewCss.includes('.lrp-project-overview-summary-title'),'inline summary title keeps the native marker gap');
assert.ok(overviewCss.includes('.lrp-project-overview-duration { float: right;'));
assert.ok(overviewCss.includes('.lrp-project-summary-tags { display: inline-flex'));
assert.ok(overviewCss.includes('.lrp-project-summary-tag {'));
assert.ok(overviewCss.includes('border: 0 !important'));
assert.ok(briefNodes.some(n=>n.cls==='lrp-project-summary-tag-add' && n.text==='新建标签'),'a project without tags offers the create-tag button');
const taggedProject={id:'tagged',name:'带标签项目',tags:['pt-1'],overview:{}};
const taggedSettings={projects:[taggedProject],availableTags:[{id:'pt-1',name:'学习',color:'#d9c4e8'}]};
const taggedPanel=api.renderLrpProjectOverview(new GraphNode('div'),{settings:taggedSettings},taggedProject,()=>{});
const taggedNodes=descendants(taggedPanel);
const tagChip=taggedNodes.find(n=>n.cls==='lrp-project-summary-tag');
assert.equal(tagChip.text,'学习','the project tag sits on the summary line');
assert.equal(tagChip.style.backgroundColor,'#d9c4e8','project chips carry the tag color inline, like task tags');
assert.equal(tagChip.style.color,'#000');
assert.ok(!taggedNodes.some(n=>n.text==='新建标签'),'the create button disappears once a project tag exists');
assert.equal(api.getLrpProjectTags(taggedSettings,'tagged').length,1);
assert.equal(api.getLrpProjectTags(taggedSettings,'missing').length,0);
assert.equal(JSON.stringify(api.getLrpTaskTagIds(taggedSettings,{tags:['pt-1','other']},'tagged')),JSON.stringify(['pt-1','other']));
assert.equal(JSON.stringify(api.getLrpTaskTagIds(taggedSettings,{},'tagged')),JSON.stringify(['pt-1']),'tasks inherit the project tag without owning it');
assert.equal(JSON.stringify(api.getLrpTaskTagIds(taggedSettings,{},'missing')),JSON.stringify([]));
const blankPanel=api.renderLrpProjectOverview(new GraphNode('div'),{settings:{}},{id:'blank'},()=>{});
assert.equal(blankPanel.open,false);
assert.ok(source.includes(fs.readFileSync(__dirname+'/../project-overview.js','utf8')));
assert.ok(source.includes(fs.readFileSync(__dirname+'/../multi-project.js','utf8')));
assert.ok(source.includes(fs.readFileSync(__dirname+'/../dependency-graph.js','utf8')));
console.log('PASS: brief card shows duration inline on the summary line, three body sections with stage planning spanning the right column, collapsed by default and literal multiline text');

const durationPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await durationPrevious;
 const p={id:'duration',name:'时长',storageKey:'unchanged',estimatedDuration:{years:1,months:2,days:12}};
 const plugin={settings:{projects:[p]},saveSettings:async()=>{}};
 assert.equal(api.formatLrpProjectDuration(p.estimatedDuration),'1 年 2 个月 12 天');
 assert.equal(api.formatLrpProjectDuration({days:12}),'12 天');
 assert.equal(api.formatLrpProjectDuration({years:0,months:0,days:0}),'未设置');
 await api.saveLrpProjectOverview(plugin,p.id,{name:p.name,estimatedDuration:{years:'2',months:'3',days:'4'}});
 assert.equal(api.formatLrpProjectDuration(p.estimatedDuration),'2 年 3 个月 4 天');
 const before=JSON.stringify(p);
 for(const days of [-1,1.5,'abc',10000])await assert.rejects(api.saveLrpProjectOverview(plugin,p.id,{name:'不能保存',estimatedDuration:{days}}),/整数/);
 assert.equal(JSON.stringify(p),before);
 plugin.saveSettings=async()=>{throw new Error('failed');};
 await assert.rejects(api.saveLrpProjectOverview(plugin,p.id,{name:p.name,estimatedDuration:{days:7}}),/failed/);
 assert.equal(JSON.stringify(p),before);
 console.log('PASS: year/month/day estimates, duration persistence/formatting, integer validation, rollback and unchanged task scheduling');
})();

assert.equal(api.getLrpProjectBriefText({overview:{introduction:'简介',goals:'目标'}},'introduction'),'简介\n\n目标');
assert.equal(api.getLrpProjectBriefText({overview:{goals:'旧目标'}},'introduction'),'旧目标');

assert.ok(source.includes('options.active === "board" && selected && !settings.showAllProjects'));
assert.ok(!source.includes('renderLrpProjectOverview(projectCard,'));
assert.ok(!fs.readFileSync(__dirname+'/../dependency-graph.js','utf8').includes('renderLrpProjectOverview('));
console.log('PASS: project brief restricted to single/all-project boards; filled and blank briefs default closed');


const scoringPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await scoringPrevious;sandbox.setTimeout=fn=>fn();
 assert.equal(api.getLrpScoringSettings({}).enabled,false);
 assert.throws(()=>api.validateLrpScoringSettings({enabled:true,regularWeight:80,examWeight:30}),/合计/);
 const project={id:'grade',name:'评分',scoring:{enabled:true,regularWeight:60,examWeight:40,regularBasis:'task'}};
 const normal={id:'normal',title:'日常',completed:true,reviewScore:{score:80,category:'regular'},subtasks:[{id:'a',completed:true,reviewScore:{score:0,category:'regular'}},{id:'b',completed:true,reviewScore:{score:100,category:'exam'}}]};
 const exam={id:'exam',title:'考验一',lrpAssessment:true,completed:true,reviewScore:{score:1,category:'exam'},subtasks:[{id:'c',title:'考验小任务',completed:true,reviewScore:{score:90,category:'exam'}},{id:'d',completed:true,reviewScore:{score:100,category:'exam'}},{id:'pending',completed:true}]};
 const exam2={id:'exam2',title:'考验二',lrpAssessment:true,subtasks:[{id:'e',completed:true,reviewScore:{score:80,category:'exam'}},{id:'f',completed:false,reviewScore:{score:100,category:'exam'}}]};
 const tasks=[normal,exam,exam2],before=JSON.stringify(tasks);
 let summary=api.getLrpProjectScores(project,tasks);
 assert.equal(summary.regularAverage,80);assert.equal(summary.examAverage,90);assert.equal(summary.total,84);assert.equal(summary.examCount,3);assert.equal(summary.pending,1);
 assert.equal(JSON.stringify(tasks),before,'calculation does not mutate historical scores');
 project.scoring.regularBasis='subtask';summary=api.getLrpProjectScores(project,tasks);assert.equal(summary.regularAverage,50,'old ordinary exam score is regular now, zero counts');assert.equal(summary.total,66);
 assert.equal(api.getLrpLargeTaskScores(project,tasks).length,1,'assessments excluded from regular root comparison');
 project.scoring.regularBasis='task';
 const abandoned=JSON.parse(before);abandoned[1].planningDisposition='abandoned';assert.equal(api.getLrpProjectScores(project,abandoned).examAverage,80,'abandoned assessment and descendants excluded');
 const hierarchical=[{id:'root',lrpAssessment:true},{id:'leaf',parentId:'root',completed:true,reviewScore:{score:70,category:'regular'}}];
 assert.equal(api.getLrpProjectScores(project,hierarchical).examAverage,70);assert.equal(api.isLrpAssessmentTask(hierarchical[1],hierarchical),true);
 const root={settings:{projects:[{id:'active'},project],activeProjectId:'active'},saveSettings:async()=>{}};
 root.taskStore=new api.TaskStore(root);const store=root.taskStore;store.tasksByProject={active:[{id:'unchanged'}],grade:tasks};store.tasks=store.tasksByProject.active;store.loaded=true;store.rebuildIndex();
 const originalWrite=api.TaskStore.prototype.writeProjectFile;let writes=[];api.TaskStore.prototype.writeProjectFile=async function(pid,items){writes.push({pid,data:JSON.stringify(items)});};
 const prompts=[];let done;root.lrpReviewPrompt=(ref,finish)=>{prompts.push(ref);done=finish;};
 try{
  await api.saveLrpSubtaskScore(root,{projectId:'grade',ownerId:'exam',subId:'pending'},{score:0,category:'exam',note:'复盘'});
  assert.equal(exam.subtasks[2].reviewScore.score,0);assert.equal(writes.at(-1).pid,'grade');assert.equal(store.tasks[0].id,'unchanged');
  await api.saveLrpSubtaskScore(root,{projectId:'grade',ownerId:'exam',subId:null},{score:100,category:'exam'});
  assert.equal(api.getLrpProjectScores(project,tasks).examAverage,67.5,'root assessment score is reference only');
  await assert.rejects(api.saveLrpSubtaskScore(root,{projectId:'grade',ownerId:'normal',subId:'a'},{score:90,category:'exam'}),/普通任务/);
  const old=JSON.stringify(exam.subtasks[2]);api.TaskStore.prototype.writeProjectFile=async()=>{throw new Error('write failed');};
  await assert.rejects(api.saveLrpSubtaskScore(root,{projectId:'grade',ownerId:'exam',subId:'pending'},{score:50,category:'exam'}),/write failed/);assert.equal(JSON.stringify(exam.subtasks[2]),old);
  api.TaskStore.prototype.writeProjectFile=async function(pid,items){writes.push({pid,data:JSON.stringify(items)});};
  await store.updateTask('exam',{subtasks:exam.subtasks.map(sub=>sub.id==='c'?{...sub,completed:false}:sub)});
  assert.equal(api.getLrpProjectScores(project,tasks).examCount,3);
  await store.updateTask('exam',{subtasks:exam.subtasks.map(sub=>({...sub,completed:true}))});
  assert.equal(exam.subtasks[0].reviewScore.pending,true);assert.ok(prompts.length>=1);api.enqueueLrpSubtaskReviews(root,[prompts[0]]);assert.ok(!root.lrpScoreQueue.some(ref=>ref.ownerId===prompts[0].ownerId && ref.subId===prompts[0].subId));done();while(root.lrpActiveScoreKey)done();
  const added=await api.addLrpAssessmentTask(root,'grade','新考验一');const added2=await api.addLrpAssessmentTask(root,'grade','新考验二');assert.ok(added.lrpAssessment && added2.lrpAssessment);assert.notEqual(added.id,added2.id);assert.equal(root.settings.activeProjectId,'active');
  const priorCount=store.tasksByProject.grade.length;api.TaskStore.prototype.writeProjectFile=async()=>{throw new Error('cannot create');};await assert.rejects(api.addLrpAssessmentTask(root,'grade'),/cannot create/);assert.equal(store.tasksByProject.grade.length,priorCount);
  api.TaskStore.prototype.writeProjectFile=async()=>{};
  project.scoring.enabled=false;await assert.rejects(api.saveLrpSubtaskScore(root,{projectId:'grade',ownerId:'normal',subId:'a'},{score:88,category:'regular'}),/关闭/);assert.equal(normal.subtasks[0].reviewScore.score,0);project.scoring.enabled=true;
  GraphNode.prototype.focus=function(){};
  const modal=new api.LrpSubtaskScoreModal(root,{projectId:'grade',ownerId:'exam',subId:'pending'});modal.contentEl=new GraphNode('div');modal.close=()=>{};modal.onOpen();const nodes=descendants(modal.contentEl),cat=nodes.find(n=>n.attrs['aria-label']==='评分类别'),score=nodes.find(n=>n.attrs['aria-label']==='子任务得分');assert.equal(cat.value,'exam');assert.equal(cat.disabled,true);score.value='88';await nodes.find(n=>n.tag==='form').onsubmit({preventDefault(){}});assert.equal(exam.subtasks[2].reviewScore.score,88);
  const host=new GraphNode('div');api.renderLrpScoreAnalysis(host,root,project,tasks);const rendered=descendants(host);assert.ok(!rendered.some(n=>n.text==='考验 · 小任务'),'details moved into clicked score modal');assert.ok(!rendered.some(n=>n.cls==='lrp-score-empty'));const metrics=rendered.filter(n=>n.cls.startsWith('lrp-score-metric '));assert.ok(metrics[0].cls.includes('is-total'));
  const slot=new GraphNode('div');api.renderLrpBoardScore(slot,root,exam,'pending');assert.ok(descendants(slot).some(n=>n.text==='88' && n.cls.includes('is-exam')));
  const configHost=new GraphNode('div'),read=api.addLrpScoringSettingsEditor(configHost,project);assert.equal(read().enabled,true);
  const formHost=new GraphNode('div');api.renderLrpProjectOverview(formHost,root,project,()=>{});assert.ok(!descendants(formHost).some(n=>n.text.includes('评分记录与补评')));
  assert.ok(source.includes(fs.readFileSync(__dirname+'/../project-scoring.js','utf8')));
 }finally{api.TaskStore.prototype.writeProjectFile=originalWrite;}
 console.log('PASS: ordinary scores all regular, independent multi-assessment groups, child-only assessment average, root reference-only, zeros/pending/abandon/reopen, cross-project isolated persistence, creation/write rollback, queue deduplication, disabled retention, category-controlled form, compact separate lists, inline score chips');
})();

const schedulePrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await schedulePrevious;
 const project={id:'weeks',buckets:[{id:'one',name:'第1周'},{id:'four',name:'第4周'}]};
 const tasks=[{id:'kept',title:'保留任务',bucketId:'four',reviewScore:{score:82,category:'regular'}}];let writes=0;
 const root={settings:{projects:[project]},saveSettings:async()=>{},taskStore:{getAllForProject:()=>tasks,writeProjectFile:async()=>{writes++;}}};
 await api.saveLrpBucketSchedule(root,'weeks','one',{number:1,calendarWeek:'2026-W47'});
 assert.equal(api.getLrpBucketCalendar(project.buckets[0]).monday,'2026-11-16');assert.equal(api.getLrpBucketCalendar(project.buckets[0]).dateLabel,'11.16');
 const bucketDefaults=api.getLrpBucketTaskDefaults({calendarWeek:'2026-W48'});assert.equal(bucketDefaults.startDate,'2026-11-23');assert.equal(bucketDefaults.dueDate,'2026-11-29');
 assert.equal(api.getLrpBucketTaskDefaults({}),null);assert.equal(api.getLrpBucketTaskDefaults({calendarWeek:'2027-W53'}),null);
 assert.ok(source.includes('getLrpBucketTaskDefaults(bucket)'));
 assert.ok(source.includes('addTask("New Task", { ...(defaults || {}), bucketId: bucket.id })'));
 const overrideStore=new api.TaskStore({settings:{projects:[{id:'one'}]}});overrideStore.activeProjectId='one';overrideStore.loaded=true;overrideStore.writeProjectFile=async()=>{};
 const created=await overrideStore.addTask('New Task',{...bucketDefaults,bucketId:'bucket-48'});
 assert.equal(created.startDate,'2026-11-23');assert.equal(created.dueDate,'2026-11-29');assert.equal(created.bucketId,'bucket-48');
 const plainStore=new api.TaskStore({settings:{projects:[{id:'one'}]}});plainStore.activeProjectId='one';plainStore.loaded=true;plainStore.writeProjectFile=async()=>{};
 const plain=await plainStore.addTask('默认任务');assert.match(plain.startDate,/^\d{4}-\d{2}-\d{2}$/);assert.equal(plain.dueDate,undefined);
 const moveProject={id:'moves',buckets:[{id:'w48',name:'第2周',calendarWeek:'2026-W48'},{id:'w49',name:'第3周',calendarWeek:'2026-W49'},{id:'raw',name:'第4周'}]};
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-23',dueDate:'2026-11-29'},'w48','w49',[moveProject]).startDate,'2026-11-30');
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-16',dueDate:'2026-11-22'},'w48','w49',[moveProject]),null);
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-23',dueDate:'2026-11-29'},'w48','w48',[moveProject]),null);
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-23',dueDate:'2026-11-29'},'w48','raw',[moveProject]),null);
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-16',dueDate:'',createdDate:'2026-11-16'},'w48','w49',[moveProject]).startDate,'2026-11-30');
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-17',createdDate:'2026-11-17'},'raw','w48',[moveProject]).dueDate,'2026-11-29');
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-01',dueDate:'',createdDate:'2026-11-16'},'w48','w49',[moveProject]),null);
 assert.equal(api.getLrpBucketMoveDefaults({},'w48','w49',[moveProject]).startDate,'2026-11-30');
 assert.equal(api.getLrpBucketMoveDefaults({},undefined,'w48',[moveProject]).dueDate,'2026-11-29');
 assert.equal(api.getLrpBucketMoveDefaults({},undefined,'raw',[moveProject]),null);
 assert.equal(api.getLrpBucketMoveDefaults({startDate:'2026-11-20'},'w48','w49',[moveProject]),null);
 const movePlugin={settings:{projects:[moveProject],activeProjectId:'moves',enableDependencyScheduling:false,enableParentRollUp:false}};
 const moveStore=new api.TaskStore(movePlugin);moveStore.activeProjectId='moves';moveStore.loaded=true;moveStore.writeProjectFile=async()=>{};
 const moveTask={id:'move',title:'默认日期任务',bucketId:'w48',startDate:'2026-11-23',dueDate:'2026-11-29'};
 const customTask={id:'custom',title:'自定义日期任务',bucketId:'w48',startDate:'2026-11-02',dueDate:'2026-11-05'};
 const unboundTask={id:'unbound',title:'未绑定目标',bucketId:'w48',startDate:'2026-11-23',dueDate:'2026-11-29'};
 moveStore.tasks=[moveTask,customTask,unboundTask];moveStore.tasksByProject={moves:moveStore.tasks};
 await moveStore.updateTask('move',{bucketId:'w49'});
 assert.equal(moveTask.bucketId,'w49');assert.equal(moveTask.startDate,'2026-11-30');assert.equal(moveTask.dueDate,'2026-12-06');
 await moveStore.updateTask('move',{bucketId:'w48'});
 assert.equal(moveTask.startDate,'2026-11-23');assert.equal(moveTask.dueDate,'2026-11-29');
 await moveStore.updateTask('custom',{bucketId:'w49'});
 assert.equal(customTask.bucketId,'w49');assert.equal(customTask.startDate,'2026-11-02');assert.equal(customTask.dueDate,'2026-11-05');
 await moveStore.updateTask('unbound',{bucketId:'raw'});
 assert.equal(unboundTask.bucketId,'raw');assert.equal(unboundTask.startDate,'2026-11-23');assert.equal(unboundTask.dueDate,'2026-11-29');
 await moveStore.updateTask('unbound',{bucketId:undefined});
 assert.equal(unboundTask.bucketId,undefined);assert.equal(unboundTask.startDate,'2026-11-23');
 const explicitTask={id:'explicit',title:'显式日期任务',bucketId:'w48',startDate:'2026-11-23',dueDate:'2026-11-29'};moveStore.tasks.push(explicitTask);
 await moveStore.updateTask('explicit',{bucketId:'w49',startDate:'2026-12-01',dueDate:'2026-12-02'});
 assert.equal(explicitTask.startDate,'2026-12-01');assert.equal(explicitTask.dueDate,'2026-12-02');
 const legacyTask={id:'legacy',title:'旧默认任务',bucketId:'w48',startDate:'2026-11-16',createdDate:'2026-11-16'};moveStore.tasks.push(legacyTask);
 await moveStore.updateTask('legacy',{bucketId:'w49'});
 assert.equal(legacyTask.startDate,'2026-11-30');assert.equal(legacyTask.dueDate,'2026-12-06');
 const unboundCreated={id:'raw-created',title:'未绑定周创建',bucketId:'raw',startDate:'2026-11-17',createdDate:'2026-11-17'};moveStore.tasks.push(unboundCreated);
 await moveStore.updateTask('raw-created',{bucketId:'w48'});
 assert.equal(unboundCreated.startDate,'2026-11-23');assert.equal(unboundCreated.dueDate,'2026-11-29');
 const examTask={id:'exam',title:'新考验',lrpAssessment:true,subtasks:[]};moveStore.tasks.push(examTask);
 await moveStore.updateTask('exam',{bucketId:'w49'});
 assert.equal(examTask.startDate,'2026-11-30');assert.equal(examTask.dueDate,'2026-12-06');
 const emptyTask={id:'empty',title:'空日期任务',bucketId:'w48'};moveStore.tasks.push(emptyTask);
 await moveStore.updateTask('empty',{bucketId:'w49'});
 assert.equal(emptyTask.startDate,'2026-11-30');assert.equal(emptyTask.dueDate,'2026-12-06');
 const halfTask={id:'half',title:'只有开始',bucketId:'w48',startDate:'2026-11-20'};moveStore.tasks.push(halfTask);
 await moveStore.updateTask('half',{bucketId:'w49'});
 assert.equal(halfTask.startDate,'2026-11-20');assert.equal(halfTask.dueDate,undefined);
 assert.ok(source.includes('getLrpBucketMoveDefaults(task, task.bucketId, partial.bucketId, this.plugin.settings.projects || [])'));
 await api.saveLrpBucketSchedule(root,'weeks','four',{number:4,skip:true});assert.equal(project.buckets.length,1);assert.equal(tasks[0].bucketId,null);assert.equal(tasks[0].reviewScore.score,82);assert.equal(writes,1);assert.equal(api.getLrpNextBucketNumber(project),5);
 project.buckets.push({id:'five',name:'第5周'});
 await api.saveLrpBucketSchedule(root,'weeks','five',{number:4,calendarWeek:'2027-W01'});assert.equal(api.getLrpNextBucketNumber(project),5);assert.equal(api.getLrpBucketCalendar(project.buckets[1]).monday,'2027-01-04');
 const prior=JSON.stringify(project);await assert.rejects(api.saveLrpBucketSchedule(root,'weeks','five',{number:1,calendarWeek:'2026-W47'}),/相同/);assert.equal(JSON.stringify(project),prior);
 await assert.rejects(api.saveLrpBucketSchedule(root,'weeks','five',{number:4,calendarWeek:'2027-W53'}),/有效/);
 root.saveSettings=async()=>{throw new Error('save failed');};tasks[0].bucketId='five';const oldTask=JSON.stringify(tasks);
 await assert.rejects(api.saveLrpBucketSchedule(root,'weeks','five',{number:4,skip:true}),/save failed/);assert.equal(JSON.stringify(project),prior);assert.equal(JSON.stringify(tasks),oldTask);
 root.saveSettings=async()=>{};
 const modal=new api.LrpBucketScheduleModal({app:{},plugin:root,buckets:project.buckets,render:async()=>{}},project.buckets[1]);modal.contentEl=new GraphNode('div');modal.close=()=>{};modal.onOpen();const nodes=descendants(modal.contentEl);assert.ok(nodes.some(n=>n.attrs.type==='week'));assert.ok(nodes.some(n=>n.text==='跳过此周'));
 const emptyProject={id:'empty-skipped',buckets:[],skippedWeekNumbers:[1,2]};const emptyView={plugin:{settings:{projects:[emptyProject],activeProjectId:emptyProject.id},saveSettings:async()=>{throw new Error('must not recreate skipped weeks');}}};await api.BoardView.prototype.initializeBuckets.call(emptyView);assert.equal(emptyView.buckets.length,0);assert.equal(api.getLrpNextBucketNumber(emptyProject),3);
 console.log('PASS: calendar week mapping/Monday/cross-year, skip preserves tasks and scores, next-number/manual reversal, duplicate/invalid week validation, failure rollback and actual week-selection form; new-task Monday–Sunday defaults and move-follow only for untouched default dates');
})();

const refinementPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await refinementPrevious;
 const column=assessment=>{
  const header=new GraphNode('div'),content={hidden:false},classes=new Set(assessment?['lrp-assessment-column']:[]);
  return {header,content,classes,classList:{contains:name=>classes.has(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);}},querySelector(selector){return selector==='.planner-board-column-header'?header:selector==='.planner-board-column-content'?content:header.children.find(n=>n.cls==='lrp-pinned-toggle');}};
 };
 const normal=column(false),assessment=column(true),view={};api.setupLrpPinnedSections({querySelectorAll:()=>[normal,assessment]},view);
 assert.equal(normal.content.hidden,true);assert.equal(assessment.content.hidden,false);
 normal.header.children[0].onclick({preventDefault(){},stopPropagation(){}});assert.equal(normal.content.hidden,false);assert.equal(assessment.content.hidden,true);
 normal.header.children[0].onclick({preventDefault(){},stopPropagation(){}});assert.equal(normal.content.hidden,true);assert.equal(assessment.content.hidden,false);
 const project={id:'cost',scoring:{enabled:true,regularBasis:'task',regularWeight:60,examWeight:40}},task={id:'t',title:'费用任务',completed:true,reviewScore:{score:80,category:'regular'},costType:'fixed',costEstimate:20,costActual:10};
 const plugin={settings:{projects:[project]},taskStore:{getAllForProject:()=>[task],updateTask:async(_id,partial)=>Object.assign(task,partial)}};
 await api.saveLrpTaskCosts(plugin,task,{costType:'fixed',costEstimate:'42.5',costActual:'30',hourlyRate:0});assert.equal(task.costEstimate,42.5);assert.equal(task.costActual,30);
 await assert.rejects(api.saveLrpTaskCosts(plugin,task,{costType:'fixed',costEstimate:-1}),/非负/);
 const before=JSON.stringify(task);plugin.taskStore.updateTask=async(_id,partial)=>{Object.assign(task,partial);throw new Error('save failed');};await assert.rejects(api.saveLrpTaskCosts(plugin,task,{costType:'fixed',costEstimate:88,costActual:0}),/save failed/);assert.equal(JSON.stringify(task),before);
 const cellHost=new GraphNode('tr');api.renderLrpEditableCostCell(cellHost,plugin,task,'costEstimate',project,false);assert.ok(descendants(cellHost).some(n=>n.attrs['aria-label']==='编辑预计费用' && typeof n.onclick==='function'));
 const scoreHost=new GraphNode('div');api.renderLrpScoreAnalysis(scoreHost,plugin,project,[task]);const cards=descendants(scoreHost).filter(n=>n.cls.startsWith('lrp-score-metric '));assert.equal(cards.length,3);assert.ok(cards.every(n=>n.tag==='button' && typeof n.onclick==='function'));assert.ok(!descendants(scoreHost).some(n=>n.tag==='progress'));
 const modal=new api.LrpScoreAnalysisModal(plugin,'cost','total');modal.contentEl=new GraphNode('div');modal.onOpen();assert.ok(descendants(modal.contentEl).some(n=>n.tag==='progress' && n.attrs.value==='48'));
 console.log('PASS: mutually exclusive default-left collapses, repeated toggles, editable cost validation/save/rollback, score metric click controls and modal-only details');
})();

const budgetPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await budgetPrevious;
 const project={id:'budget',name:'预算',currencySymbol:'¥'},tasks=[{id:'a',title:'超支项',costType:'fixed',costEstimate:100,costActual:120},{id:'b',title:'节余项',costType:'fixed',costEstimate:200,costActual:100}];
 let data=api.getLrpCostAnalysis(tasks,project);assert.equal(data.difference,-80);assert.equal(data.overCount,1);assert.equal(api.formatLrpCostDifference(-80,'¥'),'-¥80');assert.equal(api.formatLrpCostDifference(20,'¥'),'+¥20');
 assert.equal(api.getLrpCostAnalysis(tasks,{...project,budgetTotal:150}).difference,70,'explicit project budget takes precedence');
 const nested=[{id:'p',costType:'fixed',costEstimate:1000,costActual:2000},{id:'c',parentId:'p',costType:'fixed',costEstimate:10,costActual:15}];assert.equal(api.getLrpCostAnalysis(nested,project).actual,15,'no parent/child double count');
 const plugin={settings:{projects:[project]},saveSettings:async()=>{},taskStore:{getAllForProject:()=>tasks}};
 await api.saveLrpCostNote(plugin,'budget','预算调整说明');assert.equal(project.costNote,'预算调整说明');plugin.saveSettings=async()=>{throw new Error('failed');};await assert.rejects(api.saveLrpCostNote(plugin,'budget','cannot save'),/failed/);assert.equal(project.costNote,'预算调整说明');
 const modal=new api.LrpCostAnalysisModal(plugin,'budget',true);modal.contentEl=new GraphNode('div');modal.onOpen();const nodes=descendants(modal.contentEl);assert.ok(nodes.some(n=>n.text==='原预算'));assert.ok(nodes.some(n=>n.text==='+¥20'));assert.ok(!nodes.some(n=>n.text==='节余项'));
 const host=new GraphNode('div');api.renderLrpCostDashboardSection(host,plugin,project,tasks);const children=descendants(host);assert.equal(children.filter(n=>n.cls==='dashboard-kpi-card lrp-cost-metric').length,5);assert.ok(children.some(n=>n.text==='-¥80' && n.cls.includes('lrp-cost-negative')));const editor=children.find(n=>n.cls==='lrp-cost-note-editor');assert.equal(editor.hidden,true);children.find(n=>n.cls==='dashboard-kpi-card lrp-cost-metric' && n.children[0].text==='说明').onclick();assert.equal(editor.hidden,false);
 console.log('PASS: signed net costs and individual over-budget counts, project budget precedence, no double count, detailed task deltas, cost-note persistence/rollback and five-card inline note editor');
})();

const reviewPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await reviewPrevious;
 const project={id:'review',name:'复盘',calendarColor:'#b77999',scoring:{enabled:true,regularBasis:'task',regularWeight:60,examWeight:40}};
 const tasks=[92,78,86,94].map((score,index)=>({id:'r'+index,title:'阶段'+index,completed:true,reviewScore:{score,category:'regular'}}));tasks.push({id:'exam-root',title:'考验一',lrpAssessment:true,subtasks:[{id:'one',title:'小任务一',completed:true,reviewScore:{score:90,category:'exam'}},{id:'two',title:'小任务二',completed:true,reviewScore:{score:100,category:'exam'}}]});
 const plugin={settings:{projects:[project]},saveSettings:async()=>{},taskStore:{getAllForProject:()=>tasks}};
 const analysis=api.getLrpScoreAnalysisRows(project,tasks);assert.equal(analysis.regular[0].score,94);assert.equal(analysis.weighted[0].weight,15);assert.equal(analysis.weighted.at(-1).weight,40);assert.equal(analysis.weighted.reduce((sum,row)=>sum+row.contribution,0),analysis.scores.total);assert.equal(analysis.examGroups[0].entries.length,2);
 const weightedHost=new GraphNode('div');api.renderLrpDetailedScoreAnalysis(weightedHost,project,tasks,'total');assert.ok(descendants(weightedHost).some(n=>n.text==='加权贡献'));
 const chartHost=new GraphNode('div');api.renderLrpDetailedScoreAnalysis(chartHost,project,tasks,'exam');assert.ok(descendants(chartHost).some(n=>n.tag==='svg' && n.attrs['aria-label'].includes('0至100')));assert.equal(descendants(chartHost).filter(n=>n.tag==='rect').length,2);
 const host=new GraphNode('div');api.renderLrpProjectReview(host,plugin,project,tasks);assert.ok(descendants(host).some(n=>n.cls==='lrp-project-review-body'));assert.ok(!descendants(host).some(n=>n.text==='保存复盘'));assert.ok(descendants(host).some(n=>n.text==='编辑'));
 await api.saveLrpProjectReview(plugin,'review','达成目标，保留复盘');assert.equal(project.review,'达成目标，保留复盘');plugin.saveSettings=async()=>{throw new Error('failed');};await assert.rejects(api.saveLrpProjectReview(plugin,'review','不会覆盖'),/failed/);assert.equal(project.review,'达成目标，保留复盘');
 tasks[0].completed=false;const incomplete=new GraphNode('div');api.renderLrpProjectReview(incomplete,plugin,project,tasks);assert.equal(incomplete.children.length,0);await assert.rejects(api.saveLrpProjectReview(plugin,'review','not allowed'),/完成或放弃/);
 tasks.forEach(task=>task.planningDisposition='abandoned');const abandoned=new GraphNode('div');api.renderLrpProjectReview(abandoned,plugin,project,tasks);assert.ok(descendants(abandoned).some(n=>n.text==='项目复盘'));
 console.log('PASS: per-module weighted contributions sum to total, descending regular ranking, grouped 0-100 exam SVG, review visibility for completed/abandoned projects, unfinished save guard and failure rollback');
})();

const stabilityPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await stabilityPrevious;
 const project={id:'stable',buckets:[{id:'w'}]},tasks=[{id:'pinned',title:'未分组'},{id:'week',title:'周任务',bucketId:'w'}],view={plugin:{settings:{activeProjectId:'stable',projects:[project]}},taskStore:{getAll:()=>tasks},currentFilters:{priority:'All',search:''}};
 const initial=api.getLrpPinnedFingerprint(view);tasks.push({id:'added',title:'新周任务',bucketId:'w'});assert.equal(api.getLrpPinnedFingerprint(view),initial,'weekly additions must reuse the existing left DOM');tasks.push({id:'inbox',title:'新未分组'});assert.notEqual(api.getLrpPinnedFingerprint(view),initial,'left additions refresh their own content');
 const completed=[{id:'done',completed:true}],reviewProject={id:'review-edit',review:'原复盘'},root={settings:{projects:[reviewProject]},taskStore:{getAllForProject:()=>completed},saveSettings:async()=>{}};
 let saved=0;const modal=new api.LrpProjectReviewModal(root,reviewProject,()=>saved++);modal.contentEl=new GraphNode('div');modal.close=()=>{};modal.onOpen();const nodes=descendants(modal.contentEl);nodes.find(n=>n.tag==='textarea').value='编辑后的复盘';await nodes.find(n=>n.tag==='form').onsubmit({preventDefault(){}});assert.equal(reviewProject.review,'编辑后的复盘');assert.equal(saved,1);
 assert.ok(source.includes('placeholder.replaceWith(oldPinned)'));
 assert.ok(source.includes('const page=wrapper.createDiv("lrp-board-page")'));
 assert.ok(!source.includes('taskItem.onclick = () => {\n                this.close();'));
 console.log('PASS: unchanged pinned fingerprint across week additions, left-content invalidation, preserved-list task navigation and review edit form persistence');
})();

// Manage mode in the project finder plus the settings-only batch delete it feeds.
const managePreviousChecks=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await managePreviousChecks;
 const summary={projects:[{id:'m1',name:'甲项目',calendarColor:'#aa0000'},{id:'m2',name:'乙项目',calendarColor:'#00aa00'},{id:'m3',name:'丙项目',calendarColor:'#0000aa'}],activeProjectId:'m2',showAllProjects:true};
 const plugin={settings:summary,saveSettings:async()=>{plugin.saves=(plugin.saves||0)+1;},taskStore:{getAllForProject:()=>[]}};
 const records=summary.projects.map(project=>({project,section:{hidden:false,classList:{toggle(){}},scrollIntoView(){}}}));
 const root=new GraphNode('div');const view={plugin};
 api.createLrpProjectFinder(root,view,records,'manageFinder',{onDeleted:()=>{}});
 const byCls=cls=>descendants(root).find(node=>node.cls===cls);
 const manageButton=byCls('lrp-project-finder-manage');
 assert.equal(manageButton.text,'管理');
 let openedManager;
 api.LrpManageProjectsModal.prototype.open=function(){openedManager=this;};
 manageButton.onclick();assert.ok(openedManager instanceof api.LrpManageProjectsModal);
 openedManager.contentEl=new GraphNode('div');openedManager.onOpen();
 const boxes=descendants(openedManager.contentEl).filter(node=>node.tag==='input'&&node.attrs.type==='checkbox');
 assert.equal(boxes.length,3);
 boxes[0].checked=true;boxes[0].onchange();
 assert.equal(openedManager.chosen.size,1);
 assert.ok(descendants(openedManager.contentEl).some(node=>node.textContent==='删除所选（1）'));
 assert.ok(descendants(openedManager.contentEl).some(node=>node.text==='新建分组'));
 assert.ok(descendants(openedManager.contentEl).some(node=>node.text==='新建项目'));
 assert.ok(descendants(openedManager.contentEl).some(node=>node.text==='移动所选项目'));
 console.log('PASS: shared finder opens full management card with group/project creation, assignment and checkbox deletion');

 const folders=new Set(['long-range-planner/甲','long-range-planner/乙','long-range-planner/丙']);const rmdirs=[];
 const adapter={exists:async path=>folders.has(path),rmdir:async (path,recursive)=>{rmdirs.push([path,recursive]);folders.delete(path);}};
 const deleteSummary={projects:[{id:'d1',name:'甲',storageKey:'甲'},{id:'d2',name:'乙',storageKey:'乙'},{id:'d3',name:'丙',storageKey:'丙'}],activeProjectId:'d2',showAllProjects:true,projectsBasePath:'long-range-planner'};
 const deletePlugin={settings:deleteSummary,app:{vault:{adapter}},saveSettings:async()=>{deletePlugin.saves=(deletePlugin.saves||0)+1;}};
 const result=await api.deleteLrpProjects(deletePlugin,['d2','d3']);
 assert.deepEqual(result.removed.map(project=>project.id),['d2','d3']);assert.equal(result.failures.length,0);
 assert.deepEqual(rmdirs.map(item=>item[0]).sort(),['long-range-planner/丙','long-range-planner/乙']);
 assert.deepEqual(rmdirs.map(item=>item[1]),[true,true]);
 assert.deepEqual(deleteSummary.projects.map(project=>project.id),['d1']);
 assert.equal(deleteSummary.activeProjectId,'d1');assert.equal(deleteSummary.showAllProjects,true);assert.equal(deletePlugin.saves,1);
 await assert.rejects(api.deleteLrpProjects(deletePlugin,[]),/请先选择/);
 await assert.rejects(api.deleteLrpProjects(deletePlugin,['missing']),/已不存在/);
 await assert.rejects(api.deleteLrpProjects(deletePlugin,['d1']),/至少保留一个项目/);
 assert.equal(deleteSummary.projects.length,1);assert.equal(rmdirs.length,2,'guarded deletes touch no folders');
 const failingSummary={projects:[{id:'f1',name:'甲',storageKey:'甲'},{id:'f2',name:'乙',storageKey:'乙'}],activeProjectId:'f2',showAllProjects:true,projectsBasePath:'long-range-planner'};
 const rollbackRmdirs=[];
 const failingPlugin={settings:failingSummary,app:{vault:{adapter:{exists:async()=>true,rmdir:async path=>rollbackRmdirs.push(path)}}},saveSettings:async()=>{throw new Error('disk full');}};
 await assert.rejects(api.deleteLrpProjects(failingPlugin,['f2']),/disk full/);
 assert.deepEqual(failingSummary.projects.map(project=>project.id),['f1','f2']);
 assert.equal(failingSummary.activeProjectId,'f2');assert.equal(failingSummary.showAllProjects,true);
 assert.equal(rollbackRmdirs.length,0,'a failed settings save must never delete project folders');
 const sharedSummary={projects:[{id:'s1',name:'甲',storageKey:'shared'},{id:'s2',name:'乙',storageKey:'shared'}],activeProjectId:'s1',showAllProjects:true,projectsBasePath:'long-range-planner'};
 const sharedRmdirs=[];
 const sharedPlugin={settings:sharedSummary,app:{vault:{adapter:{exists:async()=>true,rmdir:async path=>sharedRmdirs.push(path)}}},saveSettings:async()=>{}};
 await api.deleteLrpProjects(sharedPlugin,['s2']);
 assert.equal(sharedRmdirs.length,0,'a folder still used by a kept project is preserved');
 const brokenPlugin={settings:{projects:[{id:'b1',name:'甲',storageKey:'甲'},{id:'b2',name:'乙',storageKey:'乙'}],activeProjectId:'b1',showAllProjects:true,projectsBasePath:'long-range-planner'},app:{vault:{adapter:{exists:async()=>true,rmdir:async()=>{throw new Error('locked');}}}},saveSettings:async()=>{}};
 const broken=await api.deleteLrpProjects(brokenPlugin,['b2']);
 assert.equal(broken.failures.length,1);assert.match(broken.failures[0].error.message,/locked/);
 assert.deepEqual(brokenPlugin.settings.projects.map(project=>project.id),['b1']);
 const unsafePlugin={settings:{projects:[{id:'u1',name:'甲',storageKey:'甲'},{id:'u2',name:'乙',storageKey:'../escape'}],activeProjectId:'u1',showAllProjects:true,projectsBasePath:'long-range-planner'},app:{vault:{adapter:{exists:async()=>true,rmdir:async()=>{throw new Error('must not run');}}}},saveSettings:async()=>{}};
 const unsafe=await api.deleteLrpProjects(unsafePlugin,['u2']);
 assert.equal(unsafe.failures.length,1);assert.match(unsafe.failures[0].error.message,/目录名无效/);
 console.log('PASS: batch delete removes settings and project folders, skips shared/unsafe folders, reports locked folders, falls back from a deleted active project, keeps one project and never deletes folders on save rollback');

 const modalSummary={projects:[{id:'c1',name:'甲'},{id:'c2',name:'乙'}],activeProjectId:'c1',showAllProjects:false};
 const modalPlugin={settings:modalSummary,app:{vault:{adapter:{exists:async()=>false,rmdir:async()=>{}}}},saveSettings:async()=>{}};
 let confirmed=0,closed=0;
 const modal=new api.LrpDeleteProjectsModal(modalPlugin,[{id:'c1',name:'甲'},{id:'c2',name:'乙'}],async()=>{confirmed++;await api.deleteLrpProjects(modalPlugin,['c2']);});
 modal.contentEl=new GraphNode('div');modal.close=()=>{closed++;};modal.onOpen();
 const modalNodes=descendants(modal.contentEl);
 assert.ok(modalNodes.some(node=>node.text==='删除 2 个项目？'));
 assert.ok(modalNodes.some(node=>node.cls==='lrp-delete-project-hint' && node.text.includes('无法恢复')));
 assert.deepEqual(modalNodes.filter(node=>node.tag==='li').map(node=>node.text),['甲','乙']);
 await modalNodes.filter(node=>node.tag==='button')[1].onclick();
 assert.equal(confirmed,1);assert.equal(closed,1);
 assert.deepEqual(modalSummary.projects.map(project=>project.id),['c1']);assert.equal(modalSummary.activeProjectId,'c1');
 const failingModal=new api.LrpDeleteProjectsModal(modalPlugin,[{id:'c1',name:'甲'}],async()=>{throw new Error('写入失败');});
 failingModal.contentEl=new GraphNode('div');failingModal.close=()=>{closed++;};failingModal.onOpen();
 const failingNodes=descendants(failingModal.contentEl);
 await failingNodes.filter(node=>node.tag==='button')[1].onclick();
 assert.ok(failingNodes.some(node=>node.cls==='lrp-delete-project-error' && node.textContent==='写入失败'));
 assert.equal(closed,1,'a failed confirm keeps the dialog open for retry');
 console.log('PASS: delete confirmation lists names, confirms once, and surfaces save errors without closing');
})();

// New subtasks inherit the owner task's dates once and stay independently editable.
const ownerTask={id:'owner',startDate:'2026-11-16',dueDate:'2026-11-22'};
const subtaskDraft=api.createLrpSubtaskDraft(ownerTask,'sub-1','新子任务');
assert.equal(JSON.stringify(subtaskDraft),JSON.stringify({id:'sub-1',title:'新子任务',completed:false,startDate:'2026-11-16',dueDate:'2026-11-22'}));
const bareDraft=api.createLrpSubtaskDraft({id:'bare'},'sub-2','子任务');
assert.equal(JSON.stringify(bareDraft),JSON.stringify({id:'sub-2',title:'子任务',completed:false}));
const onlyDue=api.createLrpSubtaskDraft({dueDate:'2026-12-01'},'sub-3','子任务');
assert.equal(JSON.stringify(onlyDue),JSON.stringify({id:'sub-3',title:'子任务',completed:false,dueDate:'2026-12-01'}));
ownerTask.startDate='2027-01-01';assert.equal(subtaskDraft.startDate,'2026-11-16','inherited dates are a one-time copy, not a live link');
assert.ok(source.includes('createLrpSubtaskDraft(this.task, this.createSubtaskId()'));
console.log('PASS: new subtasks inherit the owner start/due dates as a one-time copy, keep missing dates empty and use the canonical add path');

const projectTagPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await projectTagPrevious;
 const settings={availableTags:[{id:'old',name:'旧标签',color:'#aaaaaa'},{id:'new',name:'新标签',color:'#bbbbbb'}],projects:[{id:'pt',tags:['old']}]};
 const project=settings.projects[0];
 let saves=0,refreshed=0,closed=0;
 const plugin={settings,app:{},saveSettings:async()=>{saves++;}};
 const modal=new api.LrpProjectTagModal(plugin,project,null,()=>{refreshed++;});
 modal.contentEl=new GraphNode('div');modal.close=()=>{closed++;};modal.onOpen();
 const badgeNames=()=>descendants(modal.contentEl).filter(n=>n.cls==='planner-tag-badge').map(n=>n.text);
 assert.equal(JSON.stringify(badgeNames()),JSON.stringify(['旧标签']),'assigned project tags render as task-style badges');
 const select=descendants(modal.contentEl).find(n=>n.tag==='select');
 assert.ok(select);
 assert.equal(JSON.stringify(descendants(select).filter(n=>n.tag==='option').map(n=>n.text)),JSON.stringify(['选择已有标签…','新标签']));
 select.value='new';await select.onchange();
 assert.equal(JSON.stringify(project.tags),JSON.stringify(['old','new']));
 assert.equal(saves,1);assert.equal(refreshed,1);
 assert.equal(JSON.stringify(badgeNames()),JSON.stringify(['旧标签','新标签']));
 const firstBadge=descendants(modal.contentEl).filter(n=>n.cls==='planner-tag-badge')[0];
 await descendants(firstBadge).find(n=>n.cls==='planner-tag-remove').onclick();
 assert.equal(JSON.stringify(project.tags),JSON.stringify(['new']),'removing a badge only unassigns the project');
 assert.equal(saves,2);
 const form=descendants(modal.contentEl).find(n=>n.cls==='lrp-inline-tag-create');
 const formInputs=descendants(form).filter(n=>n.tag==='input');
 formInputs[0].value='学习';formInputs[1].value='#123456';
 await descendants(form).find(n=>n.tag==='button'&&n.text==='创建并添加').onclick();
 const created=settings.availableTags.find(t=>t.name==='学习');
 assert.ok(created);assert.equal(created.color,'#123456');
 assert.ok(project.tags.includes(created.id),'created tags are added to the project immediately');
 assert.equal(saves,3);
 await (async()=>{})();
 descendants(modal.contentEl).find(n=>n.tag==='button'&&n.text==='完成').onclick();
 assert.equal(closed,1);
 const failSettings={availableTags:[],projects:[{id:'pf',tags:[]}]};
 const failPlugin={settings:failSettings,app:{},saveSettings:async()=>{throw new Error('nope');}};
 const failModal=new api.LrpProjectTagModal(failPlugin,failSettings.projects[0],null,()=>{});
 failModal.contentEl=new GraphNode('div');failModal.close=()=>{};failModal.onOpen();
 const failForm=descendants(failModal.contentEl).find(n=>n.cls==='lrp-inline-tag-create');
 const failInputs=descendants(failForm).filter(n=>n.tag==='input');
 failInputs[0].value='回滚';
 await descendants(failForm).find(n=>n.tag==='button').onclick();
 assert.equal(failSettings.availableTags.length,0,'failed saves drop the new tag');
 assert.equal(failSettings.projects[0].tags.length,0);
 console.log('PASS: project tag card uses task-tag UX: badge removal, existing-tag select, inline create, immediate persistence and failure rollback');
})();

const detailTagPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await detailTagPrevious;
 const task={id:'task-1',title:'任务',tags:['own']};
 const project={id:'proj-1',name:'项目',tags:['proj-tag'],calendarColor:'#8a5fa8'};
 const plugin={settings:{activeProjectId:'proj-1',projects:[project],availableTags:[
  {id:'proj-tag',name:'终端',color:'#d9c4e8'},
  {id:'own',name:'创意',color:'#c6cdec'},
  {id:'free',name:'Shell',color:'#c8ddd5'}
 ]},taskStore:{getAllForProject:id=>id==='proj-1'?[task]:[]},saveSettings:async()=>{}};
 const updates=[];
 const detail={plugin,task,update:async fields=>{updates.push(fields);}};
 const root=new GraphNode('div');
 api.TaskDetailView.prototype.renderTagSelector.call(detail,root,task);
 const nodes=descendants(root);
 const badges=nodes.filter(n=>n.cls==='planner-tag-badge');
 assert.equal(JSON.stringify(badges.map(n=>n.text)),JSON.stringify(['终端','创意']));
 const inherited=badges.find(n=>n.text==='终端');
 assert.equal(inherited.title,'来自项目标签');
 assert.equal(descendants(inherited).filter(n=>n.cls==='planner-tag-remove').length,0,'inherited tags have no remove control');
 const own=badges.find(n=>n.text==='创意');
 await descendants(own).find(n=>n.cls==='planner-tag-remove').onclick();
 assert.equal(JSON.stringify(updates.at(-1).tags),JSON.stringify([]));
 const select=nodes.find(n=>n.tag==='select');
 assert.ok(select,'the existing-tag dropdown is back');
 assert.equal(JSON.stringify(descendants(select).filter(n=>n.tag==='option').map(n=>n.text)),JSON.stringify(['选择已有标签…','Shell']));
 select.value='free';await select.onchange();
 assert.equal(JSON.stringify(updates.at(-1).tags),JSON.stringify(['own','free']));
 const form=nodes.find(n=>n.cls==='lrp-inline-tag-create');
 const formInputs=descendants(form).filter(n=>n.tag==='input');
 formInputs[0].value='新标签';formInputs[1].value='#123456';
 await descendants(form).find(n=>n.tag==='button'&&n.text==='创建并添加').onclick();
 const createdTag=plugin.settings.availableTags.find(t=>t.name==='新标签');
 assert.ok(createdTag);assert.equal(createdTag.color,'#123456');
 assert.equal(JSON.stringify(updates.at(-1).tags),JSON.stringify(['own',createdTag.id]));
 console.log('PASS: task tag section restored to badges, existing-tag select and inline create while keeping inherited project tags locked');
})();

const groupPrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await groupPrevious;
 const projects=[{id:'old',name:'旧未完成',groupId:'learn',createdDate:'2026-01-01'},{id:'done',name:'已完成',groupId:'learn',createdDate:'2026-11-17'},{id:'new',name:'新未完成',groupId:'learn',createdDate:'2026-11-15'},{id:'free',name:'待归类',groupId:'deleted'}];
 const tasks={done:[{id:'done-task',completed:true}]};
 const plugin={settings:{projectGroups:[{id:'learn',name:'学习'},{id:'life',name:'生活'}],projects},taskStore:{getAllForProject:id=>tasks[id] || []},saveSettings:async()=>{}};
 assert.equal(api.getLrpProjectGroupId(plugin.settings,projects[3]),'__ungrouped__');
 assert.equal(api.sortLrpGroupedProjects(plugin,projects.slice(0,3)).map(project=>project.id).join(','),'new,old,done');
 const menu=new GraphNode('div'),selected=[];api.renderLrpGroupedProjectPicker(menu,plugin,(...args)=>selected.push(args));
 const nav=descendants(menu).find(node=>node.cls==='lrp-project-group-navigation');
 assert.equal(nav.children.map(node=>node.text).join(','),'全部项目,学习,生活,未分组');
 nav.children[1].onclick();const flyout=descendants(menu).find(node=>node.cls==='lrp-project-group-flyout');
 assert.equal(flyout.children.filter(node=>node.tag==='button').map(node=>node.text).join(','),'新未完成,旧未完成,已完成');
 assert.equal(nav.children.length,4,'group navigation remains in place');
 assert.equal(flyout.children.at(-1).cls,'is-ended');flyout.children[1].onclick();assert.equal(selected[0][1],'new');
 nav.children[0].onclick();assert.equal(selected[1][1],null);
 const root=new GraphNode('div');const records=projects.map(project=>({project,section:{hidden:false}}));
 const finder=api.buildLrpGroupedProjectFinder(root,{plugin},records,'groups');
 assert.equal(descendants(root).filter(node=>node.tag==='details').every(node=>node.open),true);
 await api.saveLrpProjectGroup(plugin,settings=>{settings.projects.find(project=>project.id==='free').groupId='learn';});
 assert.equal(plugin.settings.projects.find(project=>project.id==='free').groupId,'learn');
 const before=JSON.stringify(plugin.settings);plugin.saveSettings=async()=>{throw new Error('disk full');};
 await assert.rejects(api.saveLrpProjectGroup(plugin,settings=>{settings.projectGroups=[];settings.projects[0].groupId=null;}),/disk full/);
 assert.equal(JSON.stringify(plugin.settings),before);
 assert.ok(source.includes("buildLrpGroupedProjectFinder(finder,this,records,'lrpDashboard')"));
 plugin.saveSettings=async()=>{};
 let manager=new api.LrpManageProjectsModal(plugin,()=>{});manager.contentEl=new GraphNode('div');manager.onOpen();
 const groupForm=descendants(manager.contentEl).find(node=>node.tag==='form');
 groupForm.children.find(node=>node.tag==='input').value='工作';groupForm.onsubmit({preventDefault(){}});
 while(manager.busy)await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(plugin.settings.projectGroups.some(group=>group.name==='工作'));
 let createForm=descendants(manager.contentEl).filter(node=>node.tag==='form')[1];
 createForm.children.find(node=>node.tag==='input').value='分组中新项目';createForm.children.find(node=>node.tag==='select').value='learn';
 plugin.settings.activeProjectId='old';plugin.settings.showAllProjects=true;
 createForm.onsubmit({preventDefault(){}});while(manager.busy)await new Promise(resolve=>setTimeout(resolve,0));
 const created=plugin.settings.projects.find(project=>project.name==='分组中新项目');assert.equal(created.groupId,'learn');
 assert.equal(plugin.settings.activeProjectId,'old');assert.equal(plugin.settings.showAllProjects,true);
 let rows=descendants(manager.contentEl).filter(node=>node.cls==='lrp-management-project-row');
 const createdRow=rows.find(row=>descendants(row).some(node=>node.text==='分组中新项目'));
 const move=createdRow.children.find(node=>node.tag==='select');move.value='life';move.onchange();
 while(manager.busy)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(plugin.settings.projects.find(project=>project.id===created.id).groupId,'life');
 const sections=descendants(manager.contentEl).filter(node=>node.cls==='lrp-management-project-group');
 const lifeSection=sections.find(section=>descendants(section).some(node=>node.attrs?.['aria-label']==='改名分组 生活'));
 const rename=descendants(lifeSection).find(node=>node.text==='改名');
 const edit=descendants(lifeSection).find(node=>node.cls==='lrp-management-form lrp-management-group-rename');
 assert.equal(edit.hidden,true);let stopped=0;
 rename.onclick({preventDefault(){stopped++;},stopPropagation(){stopped++;}});assert.equal(stopped,2);assert.equal(edit.hidden,false);assert.equal(lifeSection.open,true);
 descendants(edit).find(node=>node.tag==='input').value='生活与兴趣';
 edit.onsubmit({preventDefault(){}});while(manager.busy)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(plugin.settings.projectGroups.find(group=>group.id==='life').name,'生活与兴趣');
 const removeGroup=descendants(manager.contentEl).find(node=>node.attrs?.['aria-label']==='移除分组 生活与兴趣');
 removeGroup.onclick({preventDefault(){},stopPropagation(){}});while(manager.busy)await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(plugin.settings.projectGroups.some(group=>group.id==='life'),false);
 assert.equal(api.getLrpProjectGroupId(plugin.settings,plugin.settings.projects.find(project=>project.id===created.id)),'__ungrouped__');
 assert.ok(plugin.settings.projects.some(project=>project.id===created.id),'removing a group keeps its projects');

 console.log('PASS: grouping persistence, orphan fallback, newest/unfinished sorting, gray completed projects, persistent group flyout, all-project action, default-expanded finder and transactional failure rollback');
})();

const experiencePrevious=this.lrpAsyncChecks;
this.lrpAsyncChecks=(async()=>{
 await experiencePrevious;
 const makeElement=(id,top,left=0)=>({scrollTop:top,scrollLeft:left,getAttribute:key=>key==='data-bucket-id'?id:null,closest:()=>({getAttribute:()=> 'project-a'})});
 const first=makeElement('week-a',145,22),second=makeElement('week-b',81);
 const detail={open:false,getAttribute:key=>key==='data-lrp-group-id'?'learn':null,closest:()=>null};
 let columns=[first,second];
 const container={scrollTop:17,scrollLeft:0,querySelectorAll:selector=>selector==='.planner-board-column-content'?columns:selector.startsWith('details.')?[detail]:[]};
 const state=api.captureLrpViewState(container);
 columns=[makeElement('week-b',0),makeElement('week-a',0)];detail.open=true;container.scrollTop=0;
 api.restoreLrpViewState(container,state);
 assert.equal(columns[1].scrollTop,145);assert.equal(columns[1].scrollLeft,22);assert.equal(columns[0].scrollTop,81);assert.equal(detail.open,false);assert.equal(container.scrollTop,17);
 class StableView {render(){this.containerEl.scrollTop=0;}onClose(){this.closed=true;}}
 api.installLrpViewState(StableView,'render','test');
 const plugin={settings:{activeProjectId:'a'}};const view=new StableView();view.plugin=plugin;view.containerEl=container;
 view.render();container.scrollTop=230;view.render();assert.equal(container.scrollTop,230);
 plugin.settings.activeProjectId='b';view.render();assert.equal(container.scrollTop,0);container.scrollTop=70;
 plugin.settings.activeProjectId='a';view.render();assert.equal(container.scrollTop,230,'project scopes retain independent positions');
 container.scrollTop=310;view.onClose();assert.equal(view.closed,true);
 const reopened=new StableView();reopened.plugin=plugin;reopened.containerEl={...container,scrollTop:0};reopened.render();assert.equal(reopened.containerEl.scrollTop,310,'leaving and reopening a view restores the last position');
 let resolve;class AsyncView {render(){return new Promise(done=>{resolve=done;});}}
 api.installLrpViewState(AsyncView,'render','async-test');const av=new AsyncView();av.plugin=plugin;av.containerEl={...container,scrollTop:40};
 const pending=av.render();av.onClose();av.containerEl.scrollTop=9;resolve();await pending;assert.equal(av.containerEl.scrollTop,9,'late renders cannot restore a closed view');
 const classes=[];api.applyLrpModalExperience({modalEl:{classList:{add:(...names)=>classes.push(...names)}},contentEl:{classList:{add:(...names)=>classes.push(...names)}}},'small');
 assert.ok(classes.includes('lrp-ui-modal-small'));assert.ok(classes.includes('lrp-ui-modal-content'));
 console.log('PASS: stable bucket identities across reorder, nested/root scroll restoration, collapse restoration, independent project scopes, reopening a view, late-async close guard and scoped modal conventions');
})();

{
 const a={id:'a',title:'同名子任务',completed:true},b={id:'b',title:'同名子任务',completed:false};
 const parent={id:'owner',title:'所属大任务',subtasks:[a,b]};
 const target={tasks:[parent],owner:parent,task:b,embedded:true};
 const before=JSON.stringify(target),context=api.getLrpPreviewTaskContext(target);
 assert.equal(context.large,parent);assert.equal(context.progress,50);assert.equal(context.children.length,2);
 assert.equal(context.children.filter(row=>row.current).length,1);assert.equal(context.children[1].current,true);
 const host=new GraphNode('div');api.renderLrpPreviewTaskContext(host,{},target);
 const nodes=descendants(host);assert.equal(nodes.filter(node=>node.attrs['aria-current']==='true').length,1);
 assert.ok(nodes.some(node=>node.text==='✓'));assert.ok(nodes.some(node=>node.text==='□'));
 assert.equal(nodes.filter(node=>node.tag==='input'||node.tag==='button').length,0,'completion indicators must be read-only');
 assert.equal(nodes.some(node=>typeof node.onclick==='function'),false);assert.equal(JSON.stringify(target),before);
 const child={id:'child',title:'独立子任务',parentId:'root',completed:false},sibling={id:'sibling',parentId:'root',completed:true},root={id:'root',title:'大任务'};
 const linked=api.getLrpPreviewTaskContext({tasks:[root,child,sibling],owner:child,task:child,embedded:false});
 assert.equal(linked.large,root);assert.equal(linked.progress,50);assert.equal(linked.children[0].current,true);
 const rootView=api.getLrpPreviewTaskContext({tasks:[parent],owner:parent,task:parent,embedded:false});assert.equal(rootView.large,parent);assert.equal(rootView.children.length,2);
 console.log('PASS: calendar preview readonly complete/incomplete siblings, exact-ID current highlight, owner progress, standalone children and root previews, no task mutation');
}

{
 const label=new GraphNode('span'),calls=[],owner={id:'parent'},sub={id:'child',title:'同名子任务',completed:false};
 api.bindLrpBoardSubtaskPreview(label,{openTaskDetail:(...args)=>calls.push(args)},owner,sub);
 assert.equal(label.attrs.role,'button');assert.equal(label.attrs.tabindex,'0');
 let stopped=0;const event={preventDefault(){stopped++;},stopPropagation(){stopped++;}};
 label.onclick(event);assert.equal(stopped,2);assert.equal(calls[0][0]._lrpOwnerId,'parent');assert.equal(calls[0][0]._lrpSubId,'child');assert.equal(calls[0][1].anchor,label);assert.equal(calls[0][1].edit,undefined);
 label.onkeydown({...event,key:'Enter'});label.onkeydown({...event,key:' '});label.onkeydown({...event,key:'a'});assert.equal(calls.length,3);
 assert.equal(sub.completed,false);assert.equal(sub.id,'child');
 console.log('PASS: board subtask name opens exact embedded preview, stops parent-card navigation, supports keyboard and never toggles completion');
}

for(const [viewportWidth,viewportHeight] of [[1200,800],[700,500],[320,240]]){
 for(const height of [180,550,1800]){
  const position=api.getLrpPreviewPosition({left:viewportWidth-120,right:viewportWidth-40,top:viewportHeight-70,bottom:viewportHeight-40},380,height,viewportWidth,viewportHeight);
  assert.ok(position.top>=12);assert.ok(position.left>=12);
  assert.ok(position.top+Math.min(height,position.maxHeight)<=viewportHeight-48+0.01,'preview keeps two-line bottom clearance');
  assert.ok(position.left+position.width<=viewportWidth-12+0.01);
 }
}
console.log('PASS: preview remains within narrow/wide viewports with reserved bottom clearance, including tall content and bottom anchors');

{
 const project={id:'current-picker',name:'当前项目',groupId:'study'},other={id:'other-picker',name:'其他项目',groupId:'life'};
 const plugin={settings:{activeProjectId:project.id,showAllProjects:false,projectGroups:[{id:'study',name:'自学'},{id:'life',name:'生活'}],projects:[project,other]},taskStore:{getAllForProject:()=>[]}};
 const root=new GraphNode('div');const picker=api.renderLrpGroupedProjectPicker(root,plugin,()=>{});
 const nodes=descendants(root),nav=nodes.find(node=>node.cls==='lrp-project-group-navigation'),flyout=nodes.find(node=>node.cls==='lrp-project-group-flyout');
 assert.equal(flyout.hidden,false);assert.equal(flyout.children[0].text,'自学');
 nav.children.find(node=>node.text==='生活').onclick();assert.equal(flyout.children[0].text,'生活');
 picker.showCurrentGroup();assert.equal(flyout.children[0].text,'自学','reopening returns to the current project category');
 plugin.settings.activeProjectId=other.id;picker.showCurrentGroup();assert.equal(flyout.children[0].text,'生活');
 console.log('PASS: project picker initially opens the active category and reselects it on reopening or scope changes');
}

{
 const family=[{id:'main',title:'不应出现在日历的大任务',dueDate:'2026-11-22',subtasks:[{id:'no-date',title:'未排日期'},{id:'dated',title:'只显示我',dueDate:'2026-11-19'}]},{id:'empty-main',dueDate:'2026-11-22'},{id:'flat-main',dueDate:'2026-11-22'},{id:'flat-child',parentId:'flat-main',title:'独立子任务',startDate:'2026-11-18'}];
 const before=JSON.stringify(family),items=api.getLrpCalendarTasks(family);
 assert.equal(items.length,3);assert.equal(items.filter(item=>!item._lrpSubId&&!item.parentId).map(item=>item.id).join(','),'empty-main');
 assert.equal(items.find(item=>item._lrpSubId==='dated').dueDate,'2026-11-19');
 assert.equal(items.find(item=>item.id==='flat-child').dueDate,'2026-11-18');
 assert.equal(api.getLrpCalendarTasks([{id:'p',dueDate:'2026-11-22',subtasks:[{id:'s'}]}]).length,0,'an undated child must not cause its parent to appear');
 const plugin={settings:{activeProjectId:'p',showAllProjects:false,projects:[{id:'p',name:'项目'}]},taskStore:{getAllForProject:()=>family}};
 const calendar=new api.MyDayView({},plugin);calendar.weekAnchor=new Date('2026-11-16T12:00:00');calendar.monthAnchor=new Date('2026-11-16T12:00:00');
 for(const map of [calendar.getWeekTaskMap(),calendar.getMonthTaskMap()]){
  assert.equal(map.get('2026-11-22').length,1);assert.equal(map.get('2026-11-22')[0].task.id,'empty-main');assert.equal(map.get('2026-11-19')[0].task.title,'只显示我');
 }
 assert.equal(JSON.stringify(family),before);
 console.log('PASS: week/month maps show dated leaves including childless roots, never parents with undated children, retain dates and source data');
}

{
 const plugin={settings:{}},task={id:'range',startDate:'2026-11-12',dueDate:'2026-11-14',status:'Not Started',completed:false};
 const before=JSON.stringify(task);
 for(const day of [12,13,14]){
  const now=new Date(2026,10,day,day===14?23:0,day===14?59:0,day===14?59:0);
  assert.equal(api.getLrpTaskState(plugin,task,[task],now).status,'In Progress');
  assert.equal(api.getLrpTaskState(plugin,task,[task],now).progress,0);
  assert.equal(api.matchesLrpTaskStatus(plugin,task,[task],'In Progress',now),true);
  assert.equal(api.getLrpProjectState(plugin,[task],now).inProgress,true);
 }
 assert.equal(api.getLrpTaskState(plugin,task,[task],new Date(2026,10,11,23,59)).inScheduledRange,false);
 assert.equal(api.getLrpTaskState(plugin,task,[task],new Date(2026,10,15)).inScheduledRange,false);
 for(const partial of [{completed:true},{planningDisposition:'abandoned'}]){
  assert.equal(api.getLrpTaskState(plugin,{...task,...partial},[],new Date(2026,10,13)).status,partial.completed?'Completed':'Abandoned');
 }
 assert.equal(api.getLrpTaskState(plugin,{...task,startDate:null},[],new Date(2026,10,13)).inScheduledRange,false);
 assert.equal(api.getLrpTaskState(plugin,{...task,startDate:'2026-11-20'},[],new Date(2026,10,13)).inScheduledRange,false);
 const year={id:'year',startDate:'2026-12-31',dueDate:'2027-01-02'};assert.equal(api.getLrpTaskState(plugin,year,[],new Date(2027,0,1)).status,'In Progress');
 const subOwner={id:'owner',subtasks:[{id:'sub',title:'子任务',startDate:task.startDate,dueDate:task.dueDate}]};
 const calendarSub=api.getLrpCalendarTasks([subOwner])[0];assert.equal(api.getLrpTaskState(plugin,calendarSub,[subOwner],new Date(2026,10,13)).status,'In Progress');
 assert.equal(JSON.stringify(task),before,'date status is derived without changing progress or stored status');
 let refreshed=0;const clock={taskStore:{refresh:()=>refreshed++}};
 api.refreshLrpDateStatus(clock,new Date(2026,10,12,10));api.refreshLrpDateStatus(clock,new Date(2026,10,12,23));assert.equal(refreshed,0);
 api.refreshLrpDateStatus(clock,new Date(2026,10,13,0));assert.equal(refreshed,1);api.refreshLrpDateStatus(clock,new Date(2026,10,13,10));assert.equal(refreshed,1);
 console.log('PASS: inclusive scheduled-range in-progress, final-day 23:59, terminal-state precedence, missing/reversed dates, year boundary, calendar subtasks, filters/project summaries, no data mutation and once-per-day refresh');
}

{
 const chain=Array.from({length:23},(_,i)=>({id:'fold-'+i,title:i===7?'这是必须完整显示的非常长的项目任务名称而且不能省略任何文字':'任务'+i,dependencies:i?[{predecessorId:'fold-'+(i-1),type:'FS'}]:[]}));
 const before=JSON.stringify(chain),layout=api.getLrpDependencyLayout(chain,{columns:4});
 assert.equal(layout.nodes.length,23);assert.equal(layout.edges.length,22);assert.ok(layout.width<=1280);assert.ok(layout.height>500);
 assert.ok(layout.nodes[4].y>layout.nodes[3].y);assert.ok(layout.nodes[5].x<layout.nodes[4].x,'second band reverses direction');
 for(const a of layout.nodes)for(const b of layout.nodes)if(a!==b)assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y);
 const turn=api.getLrpDependencyConnection(layout.nodes[3],layout.nodes[4]);assert.equal(turn.dy,1);assert.ok(turn.path.includes(' L '));
 const reverse=api.getLrpDependencyConnection(layout.nodes[4],layout.nodes[5]);assert.equal(reverse.dx,-1);assert.ok(Number.isFinite(reverse.labelX));
 assert.ok(layout.nodes[7].height>80);assert.equal(layout.nodes[7].task.title,chain[7].title);assert.equal(JSON.stringify(chain),before);
 const narrow=api.getLrpDependencyLayout(chain,{columns:2});assert.ok(narrow.width<=640);assert.ok(narrow.height>layout.height);
 console.log('PASS: bounded-width 23-task serpentine graph, reverse/downward arrow ports, full-title sizing, no card overlaps, narrow layout and unchanged dependencies');
}
