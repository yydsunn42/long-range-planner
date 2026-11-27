const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../main.js','utf8');
const fragment=fs.readFileSync(__dirname+'/../apple-reminders.js','utf8');
assert.ok(source.includes(fragment),'helper fragment must be embedded verbatim');
const Base=class {};
const sandbox={require:()=>new Proxy({normalizePath:path=>path},{get:(target,key)=>target[key] || Base}),module:{exports:{}},console,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout};
vm.runInNewContext(source+'\nthis.api={getLrpAppleReminderRows,resolveLrpAppleCompletion,getLrpAppleRowFingerprint,LrpAppleRemindersSync,TaskStore,applyLrpProgress};',sandbox);
const api=sandbox.api;
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture() {
  const files=new Map(),writes=[];
  const plugin={settings:{projects:[{id:'p1',name:'当前项目',storageKey:'one'},{id:'p2',name:'另一个项目',storageKey:'two'}],activeProjectId:'p1'},
    app:{vault:{adapter:{},getName:()=>"test-vault"}},saveSettings:async()=>{}};
  const store=plugin.taskStore=new api.TaskStore(plugin);
  store.tasksByProject={p1:[{id:'big',title:'大任务',dueDate:'2026-11-23',status:'Not Started',subtasks:[
    {id:'s1',title:'写文章',dueDate:'2026-11-23',completed:false},
    {id:'s2',title:'无日期',completed:false},
    {id:'done',title:'历史已完成',dueDate:'2026-11-24',completed:true},
    {id:'invalid',title:'无效日期',dueDate:'2026-02-30',completed:false},
  ]}],p2:[{id:'parent',title:'父任务',status:'Not Started'},
    {id:'leaf',parentId:'parent',title:'独立子任务',startDate:'2026-11-25',status:'Not Started',completed:false},
    {id:'abandoned',parentId:'parent',planningDisposition:'abandoned',title:'放弃子任务',dueDate:'2026-11-26'}]};
  for(const tasks of Object.values(store.tasksByProject))api.applyLrpProgress(tasks);
  store.tasks=store.tasksByProject.p1;store.loaded=true;store.rebuildIndex();
  for(const [id,tasks] of Object.entries(store.tasksByProject))files.set(id,clone(tasks));
  store.readProjectFile=async id=>clone(files.get(id));
  const adapter=plugin.app.vault.adapter;
  adapter.exists=async()=>true;
  adapter.write=async(path,raw)=>{const value=JSON.parse(raw);files.set(value.projectId,value.tasks);writes.push(value.projectId);};
  const sync=new api.LrpAppleRemindersSync(plugin);
  sync.state={version:1,namespace:'test',enabled:true,links:{}};
  sync.saveState=async()=>{};
  return {plugin,store,sync,files,writes};
}
async function test() {
  let f=fixture();
  let rows=api.getLrpAppleReminderRows(f.plugin,f.sync.state);
  assert.deepEqual(clone(rows.map(row=>row.title)),['写文章','独立子任务']);
  assert.equal(rows[1].date,'2026-11-25');
  assert.equal(rows[0].notes,'项目：当前项目\n所属任务：大任务');
  console.log('PASS: dated child entries, valid floating dates, no parent/undated/abandoned/history, start-date fallback');
  for(const local of [false,true])for(const previous of [false,true,null])for(const remote of [false,true]) {
    assert.equal(api.resolveLrpAppleCompletion(local,previous,remote),previous===null||local!==previous?local:remote);
  }
  // Fake only the EventKit boundary; exercise production reconciliation and TaskStore persistence.
  function boundary(sync,remote) {
    sync.invoke=async request=>({calendarId:'apple-list',rows:request.rows.map(row=>({key:row.key,reminderId:'apple-'+row.key,
      completed:api.resolveLrpAppleCompletion(row.completed,row.lastCompleted,remote.get(row.key)??false)}))});
  }
  const remote=new Map();boundary(f.sync,remote);
  await f.sync.synchronize();assert.equal(f.writes.length,0);
  const first=rows[0],second=rows[1];
  remote.set(first.key,true);remote.set(second.key,true);
  await f.sync.synchronize();
  assert.equal(f.store.tasksByProject.p1[0].subtasks[0].completed,true);
  assert.equal(f.store.tasksByProject.p2.find(t=>t.id==='leaf').completed,true);
  assert.equal(f.plugin.settings.activeProjectId,'p1');
  assert.deepEqual(f.writes,['p1','p2'],'inbound must not write an unrelated active project');
  remote.set(first.key,false);remote.set(second.key,false);
  await f.sync.synchronize();
  assert.equal(f.store.tasksByProject.p1[0].subtasks[0].completed,false);
  const leaf=f.store.tasksByProject.p2.find(t=>t.id==='leaf');
  assert.equal(leaf.completed,false);assert.notEqual(leaf.status,'Completed');assert.equal(leaf.percentComplete,0);
  console.log('PASS: Apple completion/uncompletion returns through real TaskStore across projects, no project switch or unrelated writes');
  f.store.tasksByProject.p1[0].subtasks[0].completed=true;api.applyLrpProgress(f.store.tasksByProject.p1);
  await f.sync.synchronize();
  assert.equal(f.sync.state.links[first.key].completed,true);
  console.log('PASS: local checkbox wins when changed since acknowledged baseline');
  // In-flight local edits must survive an old Apple response.
  f=fixture();rows=api.getLrpAppleReminderRows(f.plugin,f.sync.state);
  for(const row of rows)f.sync.state.links[row.key]={reminderId:'existing',completed:false};
  f.sync.invoke=async request=>{
    f.store.tasksByProject.p1[0].subtasks[0].title='同步中改名';
    return {calendarId:'apple-list',rows:request.rows.map(row=>({key:row.key,reminderId:'existing',completed:true}))};
  };
  await f.sync.synchronize();
  assert.equal(f.store.tasksByProject.p1[0].subtasks[0].completed,false);
  assert.equal(f.store.tasksByProject.p1[0].subtasks[0].title,'同步中改名');assert.equal(f.sync.again,true);
  assert.equal(f.sync.state.links[rows[0].key].completed,true);
  console.log('PASS: late Apple responses cannot overwrite current edits and schedule reconciliation');
  f=fixture();rows=api.getLrpAppleReminderRows(f.plugin,f.sync.state);
  const key=rows[0].key;f.sync.state.links[key]={reminderId:'existing',completed:false};
  f.files.get('p1')[0].title='外部正在编辑';
  f.sync.invoke=async()=>({calendarId:'apple-list',rows:[{key,reminderId:'existing',completed:true},{key:'unrelated-apple-task',reminderId:'unrelated',completed:true}]});
  await f.sync.synchronize();
  assert.equal(f.writes.length,0);assert.equal(f.store.tasksByProject.p1[0].subtasks[0].completed,false);
  assert.equal(f.sync.state.links[key].completed,false,'failed inbound must retry with old baseline');
  assert.equal(f.sync.state.links['unrelated-apple-task'],undefined);
  assert.match(f.sync.status,/并发修改/);
  console.log('PASS: external file edits preserved, failed inbound retried, foreign Apple tasks ignored');
  f=fixture();rows=api.getLrpAppleReminderRows(f.plugin,f.sync.state);
  f.sync.state.links[rows[0].key]={reminderId:'existing',completed:false};
  f.sync.invoke=async()=>({calendarId:'apple-list',rows:[{key:rows[0].key,reminderId:'existing',completed:true}]});
  const saved=clone(f.store.tasksByProject);
  f.plugin.app.vault.adapter.write=async()=>{throw new Error('disk locked');};
  await f.sync.synchronize();
  assert.deepEqual(clone(f.store.tasksByProject),saved,'failed persistence must leave live state unchanged');
  assert.equal(f.sync.state.links[rows[0].key].completed,false);
  assert.match(f.sync.status,/disk locked/);
  console.log('PASS: failed task persistence leaves live checkbox, progress and sync baseline unchanged');
  f=fixture();rows=api.getLrpAppleReminderRows(f.plugin,f.sync.state);
  f.sync.state.links[rows[0].key]={reminderId:'deleted-in-apple',completed:false};
  f.sync.invoke=async()=>({calendarId:'apple-list',rows:[{key:rows[0].key,error:'关联待办已移除'}]});
  await f.sync.synchronize();assert.equal(f.writes.length,0);assert.equal(f.sync.state.links[rows[0].key].reminderId,'deleted-in-apple');
  const before=clone(f.sync.state);
  f.sync.invoke=async()=>{throw new Error('权限已撤销');};
  await assert.rejects(()=>f.sync.synchronize(),/权限已撤销/);
  assert.deepEqual(clone(f.sync.state),before);assert.equal(f.writes.length,0);
  console.log('PASS: Apple deletion/permission failure never delete or complete plugin tasks, links retained');
  f=fixture();let calls=0,release;
  f.sync.synchronize=()=>{calls++;return new Promise(resolve=>release=resolve);};
  const running=f.sync.run();const overlap=f.sync.run();assert.equal(calls,1);release();await running;await overlap;
  f.sync.stop();assert.equal(f.sync.stopped,true);
  console.log('PASS: overlapping triggers coalesce, unload stops future sync');
  f=fixture();
  const standalone={id:'standalone',title:'独立大任务',dueDate:'2026-11-27',completed:false,status:'Not Started',percentComplete:0};
  f.store.tasksByProject.p2.push(standalone,{id:'no-date',title:'无日期'},
    {id:'undated-parent',title:'有未排期子任务',dueDate:'2026-11-27',subtasks:[{id:'no-sub-date',completed:false}]});
  api.applyLrpProgress(f.store.tasksByProject.p2);f.files.set('p2',clone(f.store.tasksByProject.p2));
  const standaloneRow=api.getLrpAppleReminderRows(f.plugin,f.sync.state).find(row=>row.ownerId==='standalone');
  assert.ok(standaloneRow);assert.equal(standaloneRow.subId,null);assert.equal(standaloneRow.date,'2026-11-27');
  assert.ok(!api.getLrpAppleReminderRows(f.plugin,f.sync.state).some(row=>row.ownerId==='undated-parent'));
  const standaloneRemote=new Map();boundary(f.sync,standaloneRemote);await f.sync.synchronize();
  assert.equal(f.sync.state.links[standaloneRow.key].completed,false);
  standaloneRemote.set(standaloneRow.key,true);await f.sync.synchronize();
  assert.equal(f.store.tasksByProject.p2.find(t=>t.id==='standalone').completed,true);
  standaloneRemote.set(standaloneRow.key,false);await f.sync.synchronize();
  assert.equal(f.store.tasksByProject.p2.find(t=>t.id==='standalone').completed,false);
  assert.equal(f.store.tasksByProject.p2.find(t=>t.id==='standalone').percentComplete,0);
  assert.ok(f.writes.every(projectId=>projectId==='p2'));assert.equal(f.plugin.settings.activeProjectId,'p1');
  f.store.tasksByProject.p2.find(t=>t.id==='standalone').subtasks=[{id:'new-child',title:'新增子任务',dueDate:'2026-11-27',completed:false}];
  rows=api.getLrpAppleReminderRows(f.plugin,f.sync.state);
  assert.ok(!rows.some(row=>row.ownerId==='standalone' && row.subId===null));
  assert.ok(rows.some(row=>row.ownerId==='standalone' && row.subId==='new-child'));
  console.log('PASS: dated standalone root export and bidirectional completion; parents with children excluded; original project selection preserved');
  assert.ok(source.includes('renderLrpAppleRemindersSettings(containerEl,this.plugin)'));
  assert.ok(source.includes('(this.plugin.lrpRootPlugin || this.plugin).lrpAppleSync?.schedule()'));
  console.log('PASS: settings and all task-file writers use the shared sync service; embedded source matches');
}
test().catch(error=>{console.error(error);process.exitCode=1;});
