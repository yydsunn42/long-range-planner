class LrpBucketColorModal extends obsidian.Modal {
  constructor(app, color, onSave) {
    super(app);
    this.selectedColor = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#d9c4e8';
    this.onSaveColor = onSave;
  }
  onOpen() {
    const container = this.contentEl;
    container.empty();
    container.createEl('h2', {text:'修改周分组标题颜色'});
    container.createEl('p', {text:'手动选择的颜色会固定保留，不受自动配色影响。'});
    const preview = container.createDiv('lrp-bucket-color-preview');
    preview.textContent = '标题颜色预览';
    const input = container.createEl('input', {attr:{type:'color','aria-label':'自定义标题颜色'}});
    input.value = this.selectedColor;
    const refresh = () => {
      preview.style.backgroundColor = this.selectedColor;
      preview.style.color = BoardView.prototype.getContrastColor(this.selectedColor);
    };
    input.oninput = () => {this.selectedColor=input.value;refresh();};
    const palette = container.createDiv('lrp-bucket-color-palette');
    for (const [name,color] of [
      ['柔紫','#d9c4e8'],['柔蓝','#c5d9e7'],['柔绿','#c8ddd5'],['柔粉','#e6cbd9'],['米色','#e4d7c5'],
      ['紫色','#5c2d91'],['蓝色','#0078d4'],['绿色','#107c10'],['橙色','#d83b01'],['红色','#e81123']
    ]) {
      const button = palette.createEl('button', {text:name,attr:{type:'button'}});
      button.style.backgroundColor=color;
      button.style.color=BoardView.prototype.getContrastColor(color);
      button.onclick=()=>{this.selectedColor=color;input.value=color;refresh();};
    }
    const actions=container.createDiv('lrp-bucket-color-actions');
    const save=actions.createEl('button',{text:'保存颜色',cls:'mod-cta'});
    const reset=actions.createEl('button',{text:'使用默认颜色'});
    const cancel=actions.createEl('button',{text:'取消'});
    const commit=async color=>{
      save.disabled=true;reset.disabled=true;
      try {await this.onSaveColor(color);this.close();}
      catch(error) {new obsidian.Notice('颜色保存失败，请重试。');console.error(error);}
      finally {save.disabled=false;reset.disabled=false;}
    };
    save.onclick=()=>commit(this.selectedColor);
    reset.onclick=()=>commit(undefined);
    cancel.onclick=()=>this.close();
    refresh();
  }
  onClose() {this.contentEl.empty();}
}
