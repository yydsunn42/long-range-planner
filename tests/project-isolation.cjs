const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2] || __dirname+'/../main.js','utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
class Element {
  constructor(tag='div',opts={},doc){this.tag=tag;this.children=[];this.cls=opts.cls || '';this.textContent=opts.text || '';this.dataset={};this.attrs=opts.attr || {};this.style={setProperty(){}};this.scrollTop=0;this.scrollLeft=0;this.ownerDocument=doc || {createElement:tag=>new Element(tag,{},this.ownerDocument)};this.classList={add(){},contains:()=>false};}
  createEl(tag,opts={}){const child=new Element(tag,opts,this.ownerDocument);this.children.push(child);return child;}
  createDiv(opts={}){return this.createEl('div',typeof opts==='string'?{cls:opts}:opts);}
  createSpan(opts={}){return this.createEl('span',opts);}
  setAttribute(name,value){this.attrs[name]=value;}
  querySelectorAll(selector){return this.children.flatMap(node=>[...node.cls.split(' ').some(c=>selector==='.'+c)?[node]:[],...node.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0] || null;}
  replaceChildren(...children){this.children=children;}
  empty(){this.children=[];}
}
const Base=class {constructor(leaf){this.containerEl=leaf?.containerEl;}};
const obsidian=new Proxy({normalizePath:path=>path,ItemView:Base,setIcon(){}},{get:(target,key)=>target[key] || Base});
const sandbox={require:()=>obsidian,module:{exports:{}},console,crypto:require('node:crypto').webcrypto,
  queueMicrotask,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),ResizeObserver:class{observe(){}disconnect(){}}};
vm.runInNewContext(source+'\nthis.api={TaskStore,BoardView,createLrpProjectScope,openLrpProjectFromHeading,applyLrpProgress,getLrpPinnedFingerprint};\nrenderPlannerHeader=(parent,plugin)=>parent.createDiv({text:plugin.settings.activeProjectId});',sandbox);
const api=sandbox.api;
function fixture() {
  const a=[{id:'a-task',title:'A任务',bucketId:'a-week',status:'Not Started',percentComplete:0}];
  const b=[{id:'b-task',title:'B任务',bucketId:'b-week',status:'Not Started',percentComplete:0}];
  const settings={activeProjectId:'a',showAllProjects:false,projects:[{id:'a',name:'A',storageKey:'a',buckets:[{id:'a-week',name:'第1周'}]},{id:'b',name:'B',storageKey:'b',buckets:[{id:'b-week',name:'第1周'}]}]};
  const files=new Map([['a',JSON.stringify({version:1,projectId:'a',tasks:a})],['b',JSON.stringify({version:1,projectId:'b',tasks:b})]]),writes=[];
  const idFor=path=>path.split('/').at(-2);
  const adapter={exists:async path=>path.endsWith('.json')?files.has(idFor(path)):true,
    read:async path=>files.get(idFor(path)),write:async(path,value)=>{writes.push(idFor(path));files.set(idFor(path),value);},mkdir:async()=>{}};
  const plugin={settings,app:{vault:{adapter}},loadData:async()=>({settings}),saveData:async()=>{},saveSettings:async()=>{}};
  const store=plugin.taskStore=new api.TaskStore(plugin);
  store.tasksByProject={a:clone(a),b:clone(b)};store.tasks=store.tasksByProject.a;store.rebuildIndex();store.loaded=true;
  return {plugin,store,files,writes,adapter,a,b};
}
function boardFixture(f) {
  const container=new Element();const board=new api.BoardView({containerEl:container},f.plugin);
  board.updateBoardPage=()=>{};
  board.renderBoard=async page=>page.createDiv('rendered-board');
  return {board,container};
}
const cases=[];
function test(name,run){cases.push({name,run});}
test('project selection resolves the correct array and ID lookup before async reload',async()=>{
  const f=fixture();f.plugin.settings.activeProjectId='b';
  assert.equal(f.store.getAll()[0].id,'b-task');assert.equal(f.store.getTaskById('a-task'),undefined);
  assert.equal(f.store.getTaskById('b-task').title,'B任务');
});
test('existing embedded scopes follow new arrays and settings after root reload',async()=>{
  const f=fixture(),scope=api.createLrpProjectScope(f.plugin,'b');
  f.files.set('b',JSON.stringify({projectId:'b',tasks:[{id:'new-b',title:'B新内容'}]}));
  f.plugin.settings.projects=[...f.plugin.settings.projects,{id:'c',name:'C'}];
  await f.store.load();
  assert.equal(scope.taskStore.getAll()[0].id,'new-b');assert.equal(scope.settings.projects.length,3);
  await scope.taskStore.updateTask('new-b',{title:'只改B'});
  assert.deepEqual(f.writes,['b']);assert.equal(f.store.tasksByProject.b[0].title,'只改B');assert.equal(f.store.tasksByProject.a[0].title,'A任务');
});
test('concurrent loads publish one complete snapshot and never an empty/partial map',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred(),read=f.adapter.read;
  const old=f.store.tasksByProject.a;
  let reads=0,emits=0;f.store.subscribe(()=>emits++);
  f.adapter.read=async path=>{reads++;if(path.includes('/b/')){entered.resolve();await gate.promise;}return read(path);};
  const first=f.store.load();await entered.promise;const second=f.store.load();
  let error;try{assert.equal(f.store.tasksByProject.a,old);assert.equal(f.store.getAllForProject('b')[0].id,'b-task');}catch(e){error=e;}
  f.plugin.settings.activeProjectId='b';gate.resolve();await Promise.all([first,second]);if(error)throw error;
  assert.equal(reads,2);assert.equal(emits,1);assert.equal(f.store.getAll()[0].id,'b-task');assert.equal(f.writes.length,0);
});
test('read failures and mismatched file ownership preserve cache and block overwrite',async()=>{
  for(const invalid of ['{broken',JSON.stringify({projectId:'a',tasks:[{id:'wrong-project'}]})]) {
    const f=fixture(),before=JSON.stringify(f.store.tasksByProject);f.files.set('b',invalid);
    await assert.rejects(()=>f.store.load(),/读取|归属/);assert.equal(JSON.stringify(f.store.tasksByProject),before);
    await assert.rejects(()=>f.store.writeProjectFile('b',[]),/阻止覆盖/);assert.equal(f.files.get('b'),invalid);
  }
});
test('switching during save and parent rollup cannot write A tasks into B',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred();f.plugin.settings.enableParentRollUp=true;
  const tasks=[{id:'a-parent',title:'A父任务',status:'Not Started'},
    {id:'a-child',parentId:'a-parent',title:'A子任务',status:'Not Started',completed:false},
    {id:'a-child-2',parentId:'a-parent',title:'A子任务2',status:'Not Started',completed:false}];
  f.store.tasksByProject.a=tasks;f.store.tasks=tasks;
  const beforeB=f.files.get('b'),write=f.adapter.write;let first=true;
  f.adapter.write=async(path,data)=>{if(first){first=false;entered.resolve();await gate.promise;}return write(path,data);};
  const pending=f.store.updateTask('a-child',{status:'Completed'});await entered.promise;
  f.plugin.settings.activeProjectId='b';gate.resolve();await pending;
  assert.ok(f.writes.every(id=>id==='a'),f.writes.join(','));assert.equal(f.files.get('b'),beforeB);
  assert.equal(f.store.getAll()[0].id,'b-task');assert.equal(f.store.tasksByProject.a.find(t=>t.id==='a-parent').percentComplete,50);
});
test('an old board add action with an A bucket stays in A after selecting B',async()=>{
  const f=fixture();f.plugin.settings.activeProjectId='b';const beforeB=f.files.get('b');
  await f.store.addTask('A新任务',{bucketId:'a-week'});
  assert.deepEqual(f.writes,['a']);assert.equal(f.files.get('b'),beforeB);
  assert.equal(f.store.tasksByProject.a.length,2);assert.equal(f.store.tasksByProject.b.length,1);
});
test('a save interleaved with project loading is newer than the read snapshot',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred(),read=f.adapter.read;
  f.adapter.read=async path=>{const snapshot=await read(path);if(path.includes('/b/')){entered.resolve();await gate.promise;}return snapshot;};
  const loading=f.store.load();await entered.promise;
  await f.store.updateTask('a-task',{title:'A刚保存'});gate.resolve();await loading;
  assert.equal(f.store.tasksByProject.a[0].title,'A刚保存');assert.equal(JSON.parse(f.files.get('a')).tasks[0].title,'A刚保存');
});
test('loading while a prior write is pending preserves the live edit',async()=>{
  const f=fixture(),gate=deferred(),entered=deferred(),write=f.adapter.write;
  f.adapter.write=async(path,data)=>{entered.resolve();await gate.promise;return write(path,data);};
  const saving=f.store.updateTask('a-task',{title:'A正在保存'});await entered.promise;
  await f.store.load();const title=f.store.getAllForProject('a')[0].title;
  gate.resolve();await saving;assert.equal(title,'A正在保存');
  assert.equal(f.store.getAllForProject('a')[0].title,'A正在保存');
});
test('legacy migration still loads newly migrated tasks without replacing existing files',async()=>{
  const f=fixture();f.files.delete('a');f.store.tasksByProject={};
  f.plugin.loadData=async()=>({settings:f.plugin.settings,tasksByProject:{a:[{id:'legacy-a',title:'旧任务'}]}});
  await f.store.load();assert.equal(f.store.getAllForProject('a')[0].id,'legacy-a');
  assert.equal(f.store.getAllForProject('b')[0].id,'b-task');assert.deepEqual(f.writes,['a']);
});
test('all-project heading entry refreshes the single board buckets before painting',async()=>{
  const f=fixture(),{board}=boardFixture(f);await board.initializeBuckets();
  assert.equal(board.buckets[0].id,'a-week');f.plugin.settings.showAllProjects=true;
  let rendered;
  board.renderBoard=async()=>{rendered={project:f.plugin.settings.activeProjectId,buckets:board.buckets.map(b=>b.id),tasks:board.taskStore.getAll().map(t=>t.id)};};
  board.render=()=>board.renderImpl();
  await api.openLrpProjectFromHeading(board,'b');
  assert.equal(rendered.project,'b');assert.deepEqual(clone(rendered.buckets),['b-week']);assert.deepEqual(clone(rendered.tasks),['b-task']);
});
test('late single-project rendering cannot replace a newer project or all-project page',async()=>{
  for(const close of [false,true]) {
    const f=fixture(),{board,container}=boardFixture(f),gate=deferred(),entered=deferred();
    await board.initializeBuckets();board.renderBoard=async()=>{entered.resolve();await gate.promise;};
    const rendering=board.renderImpl();await entered.promise;
    if(close)await board.onClose();else {f.plugin.settings.activeProjectId='b';board.lrpAllGeneration=(board.lrpAllGeneration || 0)+1;}
    const current=container.createDiv({text:'新的项目内容'});container.replaceChildren(current);
    gate.resolve();await rendering;assert.equal(container.children[0],current);
  }
});
test('orphaned buckets remain visible in inbox and invalidate the pinned cache',async()=>{
  const f=fixture(),{board}=boardFixture(f);await board.initializeBuckets();
  const orphan={id:'orphan',title:'旧周任务',bucketId:'deleted-week',completed:false};
  const normal={id:'unassigned',title:'未分组',completed:false};
  const before=JSON.stringify([orphan,normal]);const rendered=[];
  board.createEditableUnassignedBucketName=()=>{};board.setupDropZone=()=>{};
  board.renderCard=async(_node,task)=>rendered.push(task.id);board.renderCompletedSection=async()=>{};
  await board.renderUnassignedBucket(new Element(),[...f.store.tasksByProject.a,orphan,normal]);
  assert.deepEqual(rendered,['orphan','unassigned']);assert.equal(JSON.stringify([orphan,normal]),before);
  f.store.tasksByProject.a.push(orphan);const fingerprint=api.getLrpPinnedFingerprint(board);orphan.title='修改旧周任务';assert.notEqual(api.getLrpPinnedFingerprint(board),fingerprint);
});
(async()=>{let failed=0;for(const item of cases){try{await item.run();console.log('PASS:',item.name);}catch(error){failed++;console.error('FAIL:',item.name,error.message);}}if(failed)process.exitCode=1;else console.log(`PASS: ${cases.length} project isolation scenarios`);})().catch(error=>{console.error(error);process.exitCode=1;});
