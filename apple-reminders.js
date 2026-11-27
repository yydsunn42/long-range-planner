// Embedded verbatim in main.js. Plugin-originated, dated actionable calendar entries are linked.
function getLrpAppleReminderRows(plugin, state) {
  const rows=[];
  for(const project of plugin.settings.projects || []) {
    const tasks=plugin.taskStore.getAllForProject(project.id) || [];
    for(const entry of getLrpCalendarTasks(tasks)) {
      const owner=tasks.find(task=>task.id===(entry._lrpOwnerId || entry.id));
      const actual=entry._lrpSubId ? owner?.subtasks?.find(sub=>sub.id===entry._lrpSubId) : owner;
      if(!actual || !owner || actual.planningDisposition==='abandoned' || owner.planningDisposition==='abandoned')continue;
      const date=entry.dueDate;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || toDateStr(new Date(`${date}T12:00:00`))!==date)continue;
      const key=JSON.stringify([project.id,owner.id,entry._lrpSubId || null]);
      const link=state.links[key];
      const completed=entry._lrpSubId ? Boolean(actual.completed) : isLrpTaskComplete(actual,tasks);
      // Do not flood Reminders with historical completed demo/project entries on first connection.
      if(completed && !link)continue;
      rows.push({key,projectId:project.id,ownerId:owner.id,subId:entry._lrpSubId || null,
        title:String(actual.title || '未命名子任务'),date,completed,
        notes:`项目：${project.name}\n所属任务：${owner.title || ''}${actual.description ? `\n\n${actual.description}` : ''}`,
        reminderId:link?.reminderId || null,lastCompleted:typeof link?.completed==='boolean'?link.completed:null});
    }
  }
  return rows;
}
// A local change since the last acknowledged sync wins; otherwise pull Apple's checkbox.
function resolveLrpAppleCompletion(local, previous, remote) {
  return typeof previous!=='boolean' || local!==previous ? local : remote;
}
function getLrpAppleRowFingerprint(row) {
  return row ? JSON.stringify([row.key,row.title,row.date,row.notes,row.completed]) : null;
}
class LrpAppleRemindersSync {
  constructor(plugin) {this.plugin=plugin;this.stopped=false;this.status='尚未连接';}
  get status() {return this._status;}
  set status(value) {this._status=value;if(this.statusElement?.isConnected)this.statusElement.textContent=value;}
  get directory() {return this.plugin.manifest.dir;}
  async initialize() {
    if(process.platform!=='darwin' || !this.plugin.app.vault.adapter.getBasePath)return;
    this.fs=require('fs/promises');this.path=require('path');
    this.base=this.path.join(this.plugin.app.vault.adapter.getBasePath(),this.directory);
    this.statePath=this.path.join(this.base,'apple-reminders-state.json');
    try {this.state=JSON.parse(await this.fs.readFile(this.statePath,'utf8'));}
    catch(error) {if(error.code!=='ENOENT')throw new Error('苹果同步记录无法读取，已停止以避免重复创建。');}
    if(!this.state)this.state={version:1,namespace:crypto.randomUUID(),enabled:false,links:{}};
    if(this.state.version!==1 || typeof this.state.namespace!=='string' || !this.state.links || typeof this.state.links!=='object')throw new Error('苹果同步记录格式无效。');
    this.plugin.addCommand({id:'apple-reminders-connect',name:'连接苹果提醒事项与日历',callback:()=>void this.connect()});
    this.plugin.addCommand({id:'apple-reminders-sync',name:'立即同步苹果提醒事项',callback:()=>void this.run(true)});
    this.plugin.registerInterval(window.setInterval(()=>this.schedule(),30000));
    this.plugin.registerDomEvent(window,'focus',()=>this.schedule());
    this.plugin.register(()=>this.stop());
    if(this.state.enabled)this.schedule();
    else this.status='未连接 · 点击连接后授权提醒事项';
  }
  async saveState() {
    const temporary=this.statePath+'.pending';
    await this.fs.writeFile(temporary,JSON.stringify(this.state,null,2)+'\n',{mode:0o600});
    await this.fs.rename(temporary,this.statePath);
  }
  notify(message) {new obsidian.Notice(message);}
  async connect() {
    if(this.running || this.connecting || this.stopped)return;
    this.connecting=true;
    try {
      await this.saveState(); // Persist namespace BEFORE any remote creation.
      this.status='正在请求苹果提醒事项权限…';
      await this.invoke({action:'authorize'});
      this.state.enabled=true;await this.saveState();
      this.connecting=false;await this.run(true);
    } catch(error) {this.status=error.message;this.notify(`苹果同步：${error.message}`);}
    finally {this.connecting=false;}
  }
  async pause() {
    this.state.enabled=false;
    if(this.running)await this.running;
    await this.saveState();this.status='已暂停 · 两端已有内容保留';
  }
  schedule() {
    if(this.stopped || !this.state?.enabled)return;
    if(this.running){this.again=true;return;}
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>void this.run(false),1200);
  }
  async invoke(request) {
    const app=this.path.join(this.base,'LrpRemindersBridge.app');
    await this.fs.access(this.path.join(app,'Contents/MacOS/LrpRemindersBridge'));
    const work=await this.fs.mkdtemp(this.path.join(require('os').tmpdir(),'lrp-reminders-'));
    const input=this.path.join(work,'request.json'),output=this.path.join(work,'response.json');
    let child;
    try {
      await this.fs.writeFile(input,JSON.stringify(request),{mode:0o600});
      // Launch as its own app so macOS can show permission for this named helper.
      child=require('child_process').spawn('/usr/bin/open',['-W','-n',app,'--args',input,output],{stdio:'ignore'});
      let launchError=null,exited=false;
      child.on('error',error=>{launchError=error;});child.on('exit',()=>{exited=true;});
      const started=Date.now();
      while(Date.now()-started<120000) {
        if(this.stopped)throw new Error('插件已关闭，同步已停止。');
        if(launchError)throw launchError;
        try {
          const response=JSON.parse(await this.fs.readFile(output,'utf8'));
          if(!response.ok)throw new Error(response.error || '本地连接程序执行失败。');
          return response;
        } catch(error) {if(error.code!=='ENOENT')throw error;}
        if(exited)throw new Error('本地连接程序未返回结果，请重新连接。');
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      throw new Error('等待苹果授权或同步超时，请重试。');
    } finally {
      // open -W owns only its launcher; it is safe to release it after reading the response.
      child?.kill();await this.fs.rm(work,{recursive:true,force:true});
    }
  }
  async run(manual=false) {
    if(!this.state?.enabled){if(manual)this.notify('请先在插件设置中连接苹果提醒事项。');return;}
    if(this.stopped || this.connecting)return;
    if(this.running){this.again=true;return this.running;}
    this.running=this.synchronize();
    try {await this.running;if(manual)this.notify(this.status);}
    catch(error) {this.status=`同步未完成：${error.message}`;if(manual)this.notify(this.status);console.error('long-range-planner Apple sync:',error.message);}
    finally {this.running=null;if(this.again){this.again=false;this.schedule();}}
  }
  async synchronize() {
    this.status='正在同步…';
    const rows=getLrpAppleReminderRows(this.plugin,this.state);
    const response=await this.invoke({action:'sync',namespace:this.state.namespace,
      listName:`long-range-planner · ${this.plugin.app.vault.getName()} · ${this.state.namespace.slice(0,6)}`,
      calendarId:this.state.calendarId || null,rows});
    if(this.stopped)return;
    this.state.calendarId=response.calendarId || this.state.calendarId;
    const sent=new Map(rows.map(row=>[row.key,row]));
    let imported=0,issues=[];
    for(const result of response.rows || []) {
      const row=sent.get(result.key);if(!row)continue;
      if(result.error){issues.push(result.error);continue;}
      if(typeof result.completed!=='boolean' || !result.reminderId){issues.push('苹果返回的关联记录不完整');continue;}
      const latest=getLrpAppleReminderRows(this.plugin,this.state).find(item=>item.key===row.key);
      if(getLrpAppleRowFingerprint(latest)!==getLrpAppleRowFingerprint(row)) {
        // Preserve the remote baseline, but never apply a stale response over an in-flight local edit.
        this.state.links[row.key]={reminderId:result.reminderId,completed:result.completed};
        this.again=true;continue;
      }
      if(row.completed!==result.completed) {
        try {await this.applyCompletion(row,result.completed);imported++;}
        catch(error) {issues.push(error.message);continue;} // Keep old baseline so inbound change retries.
      }
      this.state.links[row.key]={reminderId:result.reminderId,completed:result.completed};
    }
    await this.saveState();
    this.status=issues.length ? `已同步，${issues.length} 项需处理：${issues[0]}` : `已同步 ${rows.length} 个子任务${imported ? ` · 回传 ${imported} 项完成状态` : ''}`;
    this.lastSync=new Date().toLocaleTimeString();
  }
  async applyCompletion(row,completed) {
    const root=this.plugin,store=root.taskStore;
    const tasks=store.getAllForProject(row.projectId);
    const owner=tasks.find(task=>task.id===row.ownerId);
    if(!owner)throw new Error('任务已变化，等待下次同步');
    // Detect edits from another window/device before any inbound file write.
    const disk=await store.readProjectFile(row.projectId);
    if(!disk)throw new Error('任务文件无法读取，已保留原数据');
    applyLrpProgress(disk);
    if(store.getAllForProject(row.projectId)!==tasks || JSON.stringify(disk)!==JSON.stringify(tasks))throw new Error('任务文件有并发修改，请重新打开插件后同步');
    const current=getLrpAppleReminderRows(root,this.state).find(item=>item.key===row.key);
    if(getLrpAppleRowFingerprint(current)!==getLrpAppleRowFingerprint(row))throw new Error('任务正在编辑，等待下次同步');
    const scope=createLrpProjectScope(root,row.projectId);
    // Stage canonical progress/scoring changes privately. A failed disk write must not
    // leave the live checkbox changed and accidentally acknowledge a failed import.
    const original=JSON.stringify(tasks),staged=JSON.parse(original);
    scope.settings={...root.settings,activeProjectId:row.projectId,showAllProjects:false,projects:scope.settings.projects.map(project=>({...project}))};
    scope.taskStore.tasksByProject={...store.tasksByProject,[row.projectId]:staged};
    scope.taskStore.tasks=staged;scope.taskStore.rebuildIndex();
    scope.taskStore.saveQuietly=async()=>{applyLrpProgress(staged);};
    scope.taskStore.writeProjectFile=async()=>{};
    if(row.subId) {
      if(!owner.subtasks?.some(sub=>sub.id===row.subId))throw new Error('子任务已变化');
      await scope.taskStore.updateTask(owner.id,{subtasks:owner.subtasks.map(sub=>sub.id===row.subId ? {...sub,completed} : sub)},{deferReviewDialog:true});
    } else {
      const partial={completed,status:completed?'Completed':owner.status==='Completed'?'Not Started':owner.status || 'Not Started'};
      if(!completed)partial.percentComplete=0;
      await scope.taskStore.updateTask(owner.id,partial,{deferReviewDialog:true});
    }
    const latestDisk=await store.readProjectFile(row.projectId);
    if(!latestDisk)throw new Error('任务文件无法读取，已保留原数据');
    applyLrpProgress(latestDisk);
    if(store.getAllForProject(row.projectId)!==tasks || JSON.stringify(tasks)!==original || JSON.stringify(latestDisk)!==original)throw new Error('任务有并发修改，等待下次同步');
    await store.writeProjectFile(row.projectId,staged);
    store.tasksByProject[row.projectId]=staged;
    store.tasks=store.tasksByProject[store.activeProjectId] || [];store.rebuildIndex();
    store.refresh();
  }
  stop() {this.stopped=true;clearTimeout(this.timer);}
}
function renderLrpAppleRemindersSettings(container,plugin) {
  if(typeof process==='undefined' || process.platform!=='darwin')return;
  const sync=plugin.lrpAppleSync;
  const setting=new obsidian.Setting(container).setName('苹果提醒事项与日历')
    .addButton(button=>button.setButtonText(sync?.state?.enabled?'立即同步':'连接并同步').onClick(async()=>{
      if(!sync?.state){new obsidian.Notice('请重新加载插件后再连接。');return;}
      if(sync.state.enabled)await sync.run(true);else await sync.connect();
      plugin.settingTab?.display();
    }))
    .addButton(button=>button.setButtonText('暂停同步').onClick(async()=>{
      if(sync?.state)await sync.pause();plugin.settingTab?.display();
    }));
  // Generic help descriptions are intentionally stripped elsewhere in this plugin.
  // Connection state is actionable feedback and must remain visible.
  const status=setting.infoEl.createDiv({cls:'lrp-apple-sync-status',text:sync?.status || '连接程序尚未就绪',attr:{role:'status'}});
  status.style.color='var(--text-muted)';status.style.fontSize='var(--font-ui-smaller)';
  if(sync)sync.statusElement=status;
}
