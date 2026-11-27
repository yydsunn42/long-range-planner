const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
process.env.TZ='Asia/Shanghai';
const source=fs.readFileSync(__dirname+'/../main.js','utf8');
const Base=class {constructor(leaf){this.containerEl=leaf?.containerEl;}};
const frames=[];
class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-22T12:00:00+08:00']));}}
const sandbox={require:()=>new Proxy({normalizePath:path=>path,setIcon(){},ItemView:Base},{get:(t,k)=>t[k] || Base}),module:{exports:{}},console,Date:Clock,
  crypto:require('node:crypto').webcrypto,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},setTimeout,clearTimeout};
vm.runInNewContext(source+'\nthis.api={getLrpTimelineWeekScroll,focusLrpTimelineCurrentWeek,renderLrpTimelineV2,installLrpViewState};\nrenderPlannerHeader=()=>{};',sandbox);
const api=sandbox.api;
class Node {
  constructor(cls='',doc){this.cls=cls;this.children=[];this.style={setProperty(){}};this.dataset={};this.scrollLeft=0;this.scrollTop=0;this.clientWidth=1800;this.classList={toggle(){}};this.ownerDocument=doc || {activeElement:null};this.isConnected=true;}
  createEl(_tag,opts={}){const node=new Node(opts.cls || '',this.ownerDocument);node.textContent=opts.text;this.children.push(node);return node;}
  createDiv(opts={}){return this.createEl('div',typeof opts==='string'?{cls:opts}:opts);}
  createSpan(opts={}){return this.createEl('span',opts);}
  empty(){this.children=[];}
  addEventListener(){}
  getBoundingClientRect(){return {left:0,right:100,width:100};}
  querySelectorAll(selector){return this.children.flatMap(node=>[...(node.cls.split(' ').some(c=>'.'+c===selector)?[node]:[]),...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0] || null;}
}
function flush(){while(frames.length)frames.shift()();}
function fixture(){
  const project={id:'p',name:'项目',calendarColor:'#d9c4e8',buckets:[{id:'w',name:'第1周'}]};
  const task={id:'task',title:'任务',startDate:'2026-11-23',dueDate:'2026-11-29',bucketId:'w',completed:false};
  const plugin={settings:{activeProjectId:'p',showAllProjects:true,projects:[project]},taskStore:{getAllForProject:()=>[task]}};
  class View{constructor(){this.plugin=plugin;this.containerEl=new Node();this.lrpTimelineReady=true;}render(){return api.renderLrpTimelineV2(this);}}
  api.installLrpViewState(View,'render','timeline');
  return new View();
}
(async()=>{
  for(const [first,today,expected] of [['2026-10-19','2026-11-22',28],['2026-10-19','2026-11-16',28],['2026-12-21','2027-01-03',7],['2028-02-14','2028-02-29',14]]) {
    assert.equal(api.getLrpTimelineWeekScroll(Date.parse(first),Date.parse(today),18),expected*18);
  }
  console.log('PASS: current-week Monday alignment for Sunday, Monday, ISO year boundary and leap day');
  const view=fixture();await view.render();flush();
  let scroll=view.containerEl.querySelector('.lrp-time-scroll');
  const today=Date.parse('2026-11-22');
  const target=api.getLrpTimelineWeekScroll(view.lrpTimelineState.first,today,18);
  assert.equal(scroll.scrollLeft,target);assert.ok(target>0);
  assert.ok(view.lrpTimelineState.days*18-target>=1560,'wide panes have enough future canvas to align current week');
  console.log('PASS: first open defaults to this week and provides enough scroll range on wide panes');
  scroll.scrollLeft=target+126;scroll.onscroll();flush();await view.render();flush();
  scroll=view.containerEl.querySelector('.lrp-time-scroll');assert.equal(scroll.scrollLeft,target+126);
  await api.focusLrpTimelineCurrentWeek(view);flush();
  scroll=view.containerEl.querySelector('.lrp-time-scroll');assert.equal(scroll.scrollLeft,target);
  console.log('PASS: ordinary refresh preserves manual scrolling, re-entry overrides old horizontal restoration');
  view.lrpTimelineState.first=Date.parse('2027-02-01');view.lrpTimelineState.days=35;
  await api.focusLrpTimelineCurrentWeek(view);flush();
  assert.ok(view.lrpTimelineState.first<=Date.parse('2026-11-16'));
  assert.equal(view.containerEl.querySelector('.lrp-time-scroll').scrollLeft,api.getLrpTimelineWeekScroll(view.lrpTimelineState.first,today,18));
  console.log('PASS: reopening from a saved future range expands back to the current week');
  view.plugin.settings.showAllProjects=false;await view.render();flush();
  assert.equal(view.containerEl.querySelector('.lrp-time-scroll').scrollLeft,api.getLrpTimelineWeekScroll(view.lrpTimelineState.first,today,18));
  assert.ok(source.includes("this.app.workspace.on('active-leaf-change'"));
  assert.ok(source.includes('if(viewType===VIEW_TYPE_GANTT)await focusLrpTimelineCurrentWeek(leaf.view)'));
  for(const file of ['timeline-v2.js','experience.js'])assert.ok(source.includes(fs.readFileSync(__dirname+'/../'+file,'utf8')));
  console.log('PASS: single-project entry, tab/opener hooks and embedded source consistency');
})().catch(error=>{console.error(error);process.exitCode=1;});
