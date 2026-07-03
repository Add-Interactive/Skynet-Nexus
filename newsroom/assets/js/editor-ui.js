// newsroom/assets/js/editor-ui.js
// Full submission editor with rich text, image management, metadata

class EditorUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.story = null;
    this.changes = {};
  }
  
  // Load story into editor
  load(story) {
    this.story = story;
    this.changes = {};
    this.render();
  }
  
  // Render the editor
  render() {
    if (!this.story) {
      this.container.innerHTML = '<div style="padding: 20px; opacity: 0.5;">Select a story to edit</div>';
      return;
    }
    
    const payload = this.story.payload || {};
    
    this.container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px;">
        <!-- LEFT: STORY CONTENT -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Headline</label>
            <input type="text" id="editor-headline" value="${payload.title || ''}" placeholder="Story headline" style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-family: 'JetBrains Mono', monospace; font-size: 12px;">
          </div>
          
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Story Body</label>
            <textarea id="editor-body" placeholder="Story content (HTML tags allowed: <p>, <h2>, <blockquote>, <ul>, <li>)" style="width: 100%; height: 200px; padding: 8px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-family: 'JetBrains Mono', monospace; font-size: 11px; resize: vertical;">${this.stripHtmlTags(payload.body || '')}</textarea>
            <div style="font-size: 10px; opacity: 0.7; margin-top: 4px;">Word count: <span id="word-count">0</span></div>
          </div>
          
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Kid-Safe Summary (Age 8+)</label>
            <textarea id="editor-kid-take" placeholder="2-3 sentences explaining the story in simple language" style="width: 100%; height: 80px; padding: 8px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-family: 'JetBrains Mono', monospace; font-size: 11px; resize: vertical;">${payload.kidTake || ''}</textarea>
          </div>
        </div>
        
        <!-- RIGHT: METADATA + IMAGES -->
        <div style="display: flex; flex-direction: column; gap: 16px; max-height: 600px; overflow-y: auto;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Age Band</label>
            <select id="editor-age-band" style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-family: 'Orbitron', monospace; font-size: 11px;">
              <option value="5+" ${payload.ageBand === '5+' ? 'selected' : ''}>5+ (Preschool+)</option>
              <option value="8+" ${payload.ageBand === '8+' ? 'selected' : ''}>8+ (Elementary+)</option>
              <option value="12+" ${payload.ageBand === '12+' ? 'selected' : ''}>12+ (Older kids+)</option>
            </select>
          </div>
          
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Sources</label>
            <div id="sources-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${(payload.sources || []).map((src, i) => `
                <div style="display: flex; gap: 8px;">
                  <input type="text" class="source-label" value="${src.label}" placeholder="Label" style="flex: 0.3; padding: 6px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px;">
                  <input type="url" class="source-url" value="${src.url}" placeholder="https://..." style="flex: 0.7; padding: 6px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px;">
                  <button class="btn-remove-source" data-index="${i}" style="width: 28px; height: 28px; background: transparent; border: 1px solid #ff0066; color: #ff0066; cursor: pointer;">×</button>
                </div>
              `).join('')}
            </div>
            <button id="btn-add-source" style="width: 100%; padding: 8px; margin-top: 8px; background: transparent; border: 1px dashed #00ff41; color: #00ff41; font-size: 10px; cursor: pointer;">+ Add Source</button>
          </div>
          
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Images</label>
            <div id="images-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${(payload.images || []).map((img, i) => `
                <div style="padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid #00ccff; border-radius: 4px;">
                  <div style="font-size: 10px; font-weight: 700; margin-bottom: 4px;">Image ${i + 1}</div>
                  <input type="url" class="image-src" value="${img.src}" placeholder="https://..." style="width: 100%; padding: 4px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px; margin-bottom: 4px;">
                  <input type="text" class="image-alt" value="${img.alt}" placeholder="Alt text" style="width: 100%; padding: 4px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px; margin-bottom: 4px;">
                  <input type="text" class="image-credit" value="${img.credit || ''}" placeholder="Credit line" style="width: 100%; padding: 4px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px; margin-bottom: 4px;">
                  <button class="btn-remove-image" data-index="${i}" style="width: 100%; padding: 4px; background: transparent; border: 1px solid #ff0066; color: #ff0066; font-size: 10px; cursor: pointer;">Remove Image</button>
                </div>
              `).join('')}
            </div>
            <button id="btn-add-image" style="width: 100%; padding: 8px; margin-top: 8px; background: transparent; border: 1px dashed #00ff41; color: #00ff41; font-size: 10px; cursor: pointer;">+ Add Image</button>
          </div>
          
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00ccff; margin-bottom: 8px;">Discussion Questions</label>
            <div id="questions-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${(payload.familyDiscussion || []).map((q, i) => `
                <div style="display: flex; gap: 8px;">
                  <input type="text" class="question-text" value="${q}" placeholder="Question for families..." style="flex: 1; padding: 6px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px;">
                  <button class="btn-remove-question" data-index="${i}" style="width: 28px; height: 28px; background: transparent; border: 1px solid #ff0066; color: #ff0066; cursor: pointer;">×</button>
                </div>
              `).join('')}
            </div>
            <button id="btn-add-question" style="width: 100%; padding: 8px; margin-top: 8px; background: transparent; border: 1px dashed #00ff41; color: #00ff41; font-size: 10px; cursor: pointer;">+ Add Question</button>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 8px; padding: 20px; border-top: 2px solid #00ff41; background: rgba(0, 0, 0, 0.3);">
        <button id="btn-save" style="flex: 1; padding: 12px; background: transparent; border: 1px solid #00ff41; color: #00ff41; font-family: 'Orbitron', monospace; font-weight: 700; text-transform: uppercase; cursor: pointer;">💾 Save Changes</button>
        <button id="btn-revision-request" style="flex: 1; padding: 12px; background: transparent; border: 1px solid #00ccff; color: #00ccff; font-family: 'Orbitron', monospace; font-weight: 700; text-transform: uppercase; cursor: pointer;">🔄 Request Revision</button>
        <button id="btn-cancel" style="flex: 1; padding: 12px; background: transparent; border: 1px solid #ff0066; color: #ff0066; font-family: 'Orbitron', monospace; font-weight: 700; text-transform: uppercase; cursor: pointer;">× Close</button>
      </div>
    `;
    
    this.attachEventListeners();
  }
  
  attachEventListeners() {
    // Word count
    const bodyEl = document.getElementById('editor-body');
    bodyEl?.addEventListener('input', () => {
      const words = bodyEl.value.trim().split(/\s+/).length;
      document.getElementById('word-count').textContent = words;
    });
    
    // Add source
    document.getElementById('btn-add-source')?.addEventListener('click', () => {
      const list = document.getElementById('sources-list');
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '8px';
      div.innerHTML = `
        <input type="text" class="source-label" placeholder="Label" style="flex: 0.3; padding: 6px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px;">
        <input type="url" class="source-url" placeholder="https://..." style="flex: 0.7; padding: 6px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px;">
        <button class="btn-remove-source-new" style="width: 28px; height: 28px; background: transparent; border: 1px solid #ff0066; color: #ff0066; cursor: pointer;">×</button>
      `;
      list.appendChild(div);
      div.querySelector('.btn-remove-source-new').onclick = () => div.remove();
    });
    
    // Add image
    document.getElementById('btn-add-image')?.addEventListener('click', () => {
      const list = document.getElementById('images-list');
      const div = document.createElement('div');
      div.style.padding = '8px';
      div.style.background = 'rgba(0, 0, 0, 0.3)';
      div.style.border = '1px solid #00ccff';
      div.style.borderRadius = '4px';
      div.innerHTML = `
        <div style="font-size: 10px; font-weight: 700; margin-bottom: 4px;">New Image</div>
        <input type="url" class="image-src" placeholder="https://..." style="width: 100%; padding: 4px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px; margin-bottom: 4px;">
        <input type="text" class="image-alt" placeholder="Alt text" style="width: 100%; padding: 4px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px; margin-bottom: 4px;">
        <input type="text" class="image-credit" placeholder="Credit line" style="width: 100%; padding: 4px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px; margin-bottom: 4px;">
        <button class="btn-remove-image-new" style="width: 100%; padding: 4px; background: transparent; border: 1px solid #ff0066; color: #ff0066; font-size: 10px; cursor: pointer;">Remove</button>
      `;
      list.appendChild(div);
      div.querySelector('.btn-remove-image-new').onclick = () => div.remove();
    });
    
    // Add question
    document.getElementById('btn-add-question')?.addEventListener('click', () => {
      const list = document.getElementById('questions-list');
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '8px';
      div.innerHTML = `
        <input type="text" class="question-text" placeholder="Question for families..." style="flex: 1; padding: 6px; background: rgba(0, 0, 0, 0.5); border: 1px solid #00ff41; color: #00ff41; font-size: 10px;">
        <button class="btn-remove-question-new" style="width: 28px; height: 28px; background: transparent; border: 1px solid #ff0066; color: #ff0066; cursor: pointer;">×</button>
      `;
      list.appendChild(div);
      div.querySelector('.btn-remove-question-new').onclick = () => div.remove();
    });
    
    // Save
    document.getElementById('btn-save')?.addEventListener('click', () => {
      this.collectChanges();
      this.saveChanges();
    });
  }
  
  collectChanges() {
    this.changes = {
      title: document.getElementById('editor-headline')?.value || '',
      body: document.getElementById('editor-body')?.value || '',
      kidTake: document.getElementById('editor-kid-take')?.value || '',
      ageBand: document.getElementById('editor-age-band')?.value || '8+',
      sources: Array.from(document.querySelectorAll('.source-label')).map((label, i) => ({
        label: label.value,
        url: document.querySelectorAll('.source-url')[i]?.value || ''
      })),
      images: Array.from(document.querySelectorAll('.image-src')).map((src, i) => ({
        src: src.value,
        alt: document.querySelectorAll('.image-alt')[i]?.value || '',
        credit: document.querySelectorAll('.image-credit')[i]?.value || ''
      })),
      familyDiscussion: Array.from(document.querySelectorAll('.question-text')).map(q => q.value)
    };
  }
  
  async saveChanges() {
    if (!this.story) return;
    
    try {
      const response = await fetch(`/api/admin/stories/queue/${this.story.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: this.changes })
      });
      
      if (!response.ok) throw new Error('Save failed');
      
      console.log('[EditorUI] Changes saved');
      alert('✅ Changes saved');
    } catch (e) {
      console.error('[EditorUI]', e);
      alert('❌ Save failed: ' + e.message);
    }
  }
  
  stripHtmlTags(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EditorUI;
}
