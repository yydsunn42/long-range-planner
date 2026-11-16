function getLrpHiddenProjectFolderCss(settings) {
  const base=String(settings.projectsBasePath || 'long-range-planner').replace(/^\/+|\/+$/g,'');
  return (settings.projects || []).map(project=>{
    const path=JSON.stringify(`${base}/${project.storageKey ?? project.name}`);
    return `.workspace-leaf-content[data-type="file-explorer"] .nav-folder:has(> .nav-folder-title[data-path=${path}]), .workspace-leaf-content[data-type="file-explorer"] .nav-folder[data-path=${path}] { display: none !important; }`;
  }).join('\n');
}
function refreshLrpHiddenProjectFolders(plugin) {
  if(typeof document==='undefined')return;
  if(!plugin.lrpHiddenFoldersStyle){
    const doc=plugin.app.workspace.containerEl?.ownerDocument || document;
    const style=doc.createElement('style');style.dataset.lrpProjectFolders='hidden';doc.head.appendChild(style);
    plugin.lrpHiddenFoldersStyle=style;
    plugin.register(()=>{style.remove();plugin.lrpHiddenFoldersStyle=null;});
  }
  plugin.lrpHiddenFoldersStyle.textContent=getLrpHiddenProjectFolderCss(plugin.settings);
}
