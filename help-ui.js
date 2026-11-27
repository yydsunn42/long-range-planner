// Included in main.js before export. No task or project text is translated here.
const LRP_FUNCTION_HELP = {
  "任务名称": "填写这一阶段想达到的结果。直接编辑下方名称即可保存，不必拆成每天的任务。",
  "说明": "补充目标、完成标准、资料或调整记录。支持 Markdown 格式。",
  "所属项目": "选择这张卡片属于哪个项目。切换后，卡片会移动到所选项目。",
  "状态": "未开始：尚未推进；进行中：正在做；受阻：需要先解决问题；已完成：这一阶段已结束。",
  "优先级": "普通任务保持“普通”即可。高和最高优先级会在周月日历中显示 ‼️；日历颜色仍表示所属项目。",
  "标签": "给任务添加“学习”“写作”等分类。可在下方直接新建标签并选颜色，同名标签会复用。点击标签上的 × 可移除当前关联。",
  "子任务": "把阶段拆成可执行的子任务；可设置开始、截止时间和优先级，有日期的子任务显示在日历中，勾选结果计入自动进度。",
  "卡片正面内容": "选择看板卡片上展示子任务、任务说明，或只显示基本信息。只改变展示，不删除内容。",
  "周分组": "决定卡片放在哪一周。换周分组不会自动修改开始和截止日期。",
  "开始日期": "预计从哪天开始这一阶段。时间轴用它确定任务条左边的位置。",
  "截止日期": "预计在哪天完成这一阶段。周月日历按此日期显示任务，逾期和本周到期统计也使用它。",
  "持续时间": "由开始、截止日期自动计算。若日期先后颠倒，请先修正日期。",
  "完成百分比": "自动模式按子任务平均完成情况或子任务勾选比例计算。手动模式可以选择剩余 100% 到 10%，每 10% 一档；点击标记为已完成表示剩余 0%。总览按各阶段实际进度汇总。",
  "工时": "已完成填写已投入的小时数，预计剩余填写还需要多少小时，合计自动相加。修改已完成通常保持原总量并扣减剩余；修改剩余会调整总量。主任务可从子任务汇总。",
  "费用": "不记录花费时选“不使用”。固定金额直接填金额；按工时计费使用工时乘以费率。它记录金钱预算，不是学习进度。",
  "前置依赖": "用于表示阶段先后顺序。例如 B 要等 A 完成：在 B 中选择 A，再选“完成后开始”，点击添加。其他关系：开始后开始、完成后完成、开始后完成。开启依赖自动排期后，前置任务日期变化会带动后续日期。",
  "资料链接与附件": "填写显示名称和网址，或用 [[笔记名称]] 链接库内笔记。点击添加后即可从这张卡片打开资料。",
  "费用设置": "此处配置整个项目的预算、默认费率和货币符号。无需记录金钱成本的项目可以保持默认值。"
};
function addLrpHelpDisclosure(owner,root,settings=false) {
  root?.querySelectorAll?.('.setting-item-description').forEach(node=>node.remove());
  root?.querySelectorAll?.('.planner-percent-hint,.planner-rolled-up-hint,.planner-cost-rate-hint,.lrp-progress-description,.planner-no-tags,.planner-cost-type-label,.planner-cost-label,.planner-detail-content .setting-item-description').forEach(node=>node.remove());
}
function getLrpDetailGroup(label) {
  const groups = {
    "基本信息": ["任务名称", "说明", "所属项目", "状态", "优先级", "标签"],
    "清单与展示": ["子任务", "卡片正面内容"],
    "时间安排": ["周分组", "开始日期", "截止日期", "持续时间"],
    "完成进度": ["完成百分比", "工时"],
    "费用预算": ["费用"],
    "依赖与资料": ["前置依赖", "资料链接与附件"]
  };
  return Object.keys(groups).find(group => groups[group].includes(label)) || null;
}
function groupLrpTaskDetails(root) {
  if (!root?.ownerDocument || root.querySelector('.lrp-detail-cards')) return;
  const doc = root.ownerDocument;
  const children = [...root.children];
  const cards = doc.createElement('div');
  cards.className = 'lrp-detail-cards';
  const groups = new Map();
  let field = null;
  for (const child of children) {
    const heading = /^H[23]$/i.test(child.tagName) ? child : child.querySelector('h3');
    const label = heading?.textContent.replace(/（.*?）/g, '').trim();
    const group = getLrpDetailGroup(label);
    if (group) {
      let fields = groups.get(group);
      if (!fields) {
        const card = doc.createElement('section');
        card.className = 'lrp-detail-card';
        const title = doc.createElement('h4');
        title.className = 'lrp-detail-card-title';
        title.textContent = group;
        card.appendChild(title);
        fields = doc.createElement('div');
        fields.className = 'lrp-detail-card-fields';
        card.appendChild(fields);
        cards.appendChild(card);
        groups.set(group, fields);
      }
      field = doc.createElement('div');
      field.className = 'lrp-detail-field';
      field.dataset.key = label;
      fields.appendChild(field);
    }
    if (field) field.appendChild(child);
  }
  for(const name of ['基本信息','时间安排','清单与展示','完成进度','费用预算','依赖与资料']){
    const fields=groups.get(name);if(fields)cards.appendChild(fields.parentNode);
  }
  if (groups.size) root.appendChild(cards);
}
function installLrpHelpRenderer(prototype, method, settings) {
  const render = prototype[method];
  prototype[method] = function (...args) {
    const result = render.apply(this, args);
    if (result?.then) return result.then(value => {if(!settings)groupLrpTaskDetails(this.containerEl);addLrpHelpDisclosure(this, this.containerEl, settings);return value;});
    if (!settings) groupLrpTaskDetails(this.containerEl);
    addLrpHelpDisclosure(this, this.containerEl, settings);
    return result;
  };
}
installLrpHelpRenderer(ProjectPlannerSettingTab.prototype, 'display', true);
installLrpHelpRenderer(TaskDetailView.prototype, 'render', false);
