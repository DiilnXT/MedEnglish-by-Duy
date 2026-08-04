/* MedTerm AI Pro - Medical English Web Application
   Designed & Coded by Nhật Duy
*/

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    terms: MEDICAL_DATA.terms || [],
    modules: MEDICAL_DATA.modules || [],
    apiKey: localStorage.getItem('medterm_api_key') || '',
    apiModel: localStorage.getItem('medterm_api_model') || 'gemini-2.5-flash',
    srsData: JSON.parse(localStorage.getItem('medterm_srs') || '{}'),
    streak: parseInt(localStorage.getItem('medterm_streak') || '1'),
    srsQueue: [],
    currentSrsIndex: 0,
    // Game State
    gameScore: 0,
    gameCombo: 0,
    currentMatchTarget: null,
    selectedParts: []
  };

  // DOM Elements
  const elements = {
    navBtns: document.querySelectorAll('.nav-btn, .mobile-nav-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    moduleGrid: document.getElementById('module-grid'),
    // Search
    dictSearchInput: document.getElementById('dict-search-input'),
    dictModuleFilter: document.getElementById('dict-module-filter'),
    dictList: document.getElementById('dict-list'),
    searchCount: document.getElementById('search-count'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    // Stats
    statTotal: document.getElementById('stat-total'),
    statMastered: document.getElementById('stat-mastered'),
    statLearning: document.getElementById('stat-learning'),
    statStreak: document.getElementById('stat-streak'),
    // SRS
    srsCardWrapper: document.getElementById('flashcard-wrapper'),
    srsModuleSelect: document.getElementById('srs-module-select'),
    // Root Match
    assemblyStage: document.getElementById('assembly-stage'),
    gameScore: document.getElementById('game-score'),
    gameCombo: document.getElementById('game-combo'),
    // AI Dict
    aiSearchInput: document.getElementById('ai-search-input'),
    btnAiSearch: document.getElementById('btn-ai-search'),
    aiDictResponse: document.getElementById('ai-dict-response'),
    // API Modal
    btnApiModal: document.getElementById('btn-api-modal'),
    modalApiConfig: document.getElementById('modal-api-config'),
    btnCloseApiModal: document.getElementById('btn-close-api-modal'),
    inputApiKey: document.getElementById('input-api-key'),
    inputModelName: document.getElementById('input-model-name'),
    btnToggleKeyVis: document.getElementById('btn-toggle-key-vis'),
    btnPasteApiKey: document.getElementById('btn-paste-api-key'),
    btnSaveApiKey: document.getElementById('btn-save-api-key'),
    btnClearApiKey: document.getElementById('btn-clear-api-key'),
    apiKeyMsg: document.getElementById('api-key-msg'),
    apiStatusDot: document.getElementById('api-status-dot'),
    // Term Modal
    modalTermDetail: document.getElementById('modal-term-detail'),
    btnCloseTermModal: document.getElementById('btn-close-term-modal'),
    mTermTitle: document.getElementById('m-term-title'),
    mTermBody: document.getElementById('m-term-body')
  };

  function init() {
    updateApiStatus();
    populateSelects();
    renderModules();
    renderDictionary();
    renderStats();
    initSrs();
    startRootMatchGame();
    setupEventListeners();
  }

  function updateApiStatus() {
    if (elements.apiStatusDot) {
      elements.apiStatusDot.classList.toggle('active', !!state.apiKey);
    }
  }

  function setupEventListeners() {
    // Nav Tabs
    elements.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const curr = document.documentElement.getAttribute('data-theme');
      const next = curr === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
    });

    // Search events
    elements.dictSearchInput.addEventListener('input', (e) => {
      elements.btnClearSearch.style.display = e.target.value.trim() ? 'block' : 'none';
      renderDictionary();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.dictSearchInput.value = '';
      elements.btnClearSearch.style.display = 'none';
      renderDictionary();
    });

    elements.dictModuleFilter.addEventListener('change', renderDictionary);

    // SRS Filter
    elements.srsModuleSelect.addEventListener('change', initSrs);

    // AI Search
    elements.btnAiSearch.addEventListener('click', performAiSearch);
    elements.aiSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performAiSearch();
    });

    // API Modal Events
    elements.btnApiModal.addEventListener('click', () => {
      elements.inputApiKey.value = state.apiKey;
      elements.inputModelName.value = state.apiModel || 'gemini-2.5-flash';
      elements.modalApiConfig.classList.add('active');
    });

    elements.btnCloseApiModal.addEventListener('click', () => {
      elements.modalApiConfig.classList.remove('active');
    });

    elements.btnToggleKeyVis.addEventListener('click', () => {
      const isPass = elements.inputApiKey.type === 'password';
      elements.inputApiKey.type = isPass ? 'text' : 'password';
      elements.btnToggleKeyVis.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });

    elements.btnPasteApiKey.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clip = await navigator.clipboard.readText();
          if (clip) {
            elements.inputApiKey.value = clip.trim();
            showApiMsg('Đã dán API Key từ Clipboard!', 'success');
          }
        } else {
          const manual = prompt('Dán Gemini API Key của bạn:');
          if (manual) elements.inputApiKey.value = manual.trim();
        }
      } catch (err) {
        const manual = prompt('Dán Gemini API Key của bạn:');
        if (manual) elements.inputApiKey.value = manual.trim();
      }
    });

    elements.btnSaveApiKey.addEventListener('click', () => {
      const key = elements.inputApiKey.value.trim();
      const model = elements.inputModelName.value.trim() || 'gemini-2.5-flash';

      state.apiKey = key;
      state.apiModel = model;
      localStorage.setItem('medterm_api_key', key);
      localStorage.setItem('medterm_api_model', model);

      updateApiStatus();
      showApiMsg('Đã lưu API Key & Model thành công!', 'success');
      setTimeout(() => elements.modalApiConfig.classList.remove('active'), 1200);
    });

    elements.btnClearApiKey.addEventListener('click', () => {
      state.apiKey = '';
      localStorage.removeItem('medterm_api_key');
      elements.inputApiKey.value = '';
      updateApiStatus();
      showApiMsg('Đã xóa API Key.', 'error');
    });

    elements.btnCloseTermModal.addEventListener('click', () => {
      elements.modalTermDetail.classList.remove('active');
    });
  }

  function switchTab(tabId) {
    elements.navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    elements.tabContents.forEach(p => p.classList.toggle('active', p.id === tabId));
  }

  function showApiMsg(msg, type) {
    elements.apiKeyMsg.textContent = msg;
    elements.apiKeyMsg.style.display = 'block';
    elements.apiKeyMsg.style.color = type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)';
  }

  function populateSelects() {
    elements.dictModuleFilter.innerHTML = '<option value="all">-- Tất cả hệ cơ quan & chuyên đề --</option>';
    elements.srsModuleSelect.innerHTML = '<option value="all">Tất cả bài học</option>';

    state.modules.forEach(([id, name]) => {
      const opt = `<option value="${id}">${name}</option>`;
      elements.dictModuleFilter.insertAdjacentHTML('beforeend', opt);
      elements.srsModuleSelect.insertAdjacentHTML('beforeend', opt);
    });
  }

  function renderModules() {
    elements.moduleGrid.innerHTML = '';
    const icons = {
      cau_tao: 'fa-cubes', goc_tu: 'fa-tree', nguon_goc: 'fa-monument',
      dang_ket_hop: 'fa-link', hau_to: 'fa-tag', tien_to: 'fa-tags',
      phien_am: 'fa-volume-high', tong_quan: 'fa-child', tim_mach: 'fa-heart-pulse',
      ho_hap: 'fa-lungs', tieu_hoa: 'fa-apple-whole', than_kinh: 'fa-brain', sinh_san_nu: 'fa-venus'
    };

    state.modules.forEach(([id, name]) => {
      const count = state.terms.filter(t => t.module === id).length;
      const icon = icons[id] || 'fa-notes-medical';

      const card = document.createElement('div');
      card.className = 'module-card';
      card.innerHTML = `
        <div class="module-card-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="module-card-info">
          <h4>${name}</h4>
          <span>${count} Thuật ngữ & Dữ liệu</span>
        </div>
      `;
      card.addEventListener('click', () => {
        elements.dictModuleFilter.value = id;
        switchTab('tab-dictionary');
        renderDictionary();
      });
      elements.moduleGrid.appendChild(card);
    });
  }

  function renderDictionary() {
    const q = elements.dictSearchInput.value.toLowerCase().trim();
    const mod = elements.dictModuleFilter.value;

    const filtered = state.terms.filter(t => {
      const mMod = mod === 'all' || t.module === mod;
      const mQ = !q || t.term.toLowerCase().includes(q) || t.vietnamese.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
      return mMod && mQ;
    });

    elements.searchCount.textContent = filtered.length;
    elements.dictList.innerHTML = '';

    if (filtered.length === 0) {
      elements.dictList.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem 0;">Không tìm thấy thuật ngữ phù hợp.</p>`;
      return;
    }

    filtered.slice(0, 90).forEach(item => {
      const card = document.createElement('div');
      card.className = 'term-card';
      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="term-card-title">${escapeHtml(item.term)}</div>
            <button class="btn-sub" style="padding:2px 8px;" onclick="event.stopPropagation(); playAudio('${escapeJs(item.term)}')">
              <i class="fa-solid fa-volume-high"></i>
            </button>
          </div>
          ${item.phonetic ? `<div class="term-card-phonetic">${escapeHtml(item.phonetic)}</div>` : ''}
          <div class="term-card-meaning">${escapeHtml(item.vietnamese || 'Y khoa')}</div>
          ${item.note ? `<div class="term-card-note">${escapeHtml(item.note)}</div>` : ''}
        </div>
        <div class="term-card-footer">
          <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(item.module_name)}</span>
          <button class="btn-sm-ai" onclick="event.stopPropagation(); openAiTerm('${escapeJs(item.term)}')">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI Tra cứu
          </button>
        </div>
      `;
      card.addEventListener('click', () => openTermModal(item));
      elements.dictList.appendChild(card);
    });
  }

  // --- SRS / ANKI ---
  function initSrs() {
    const mod = elements.srsModuleSelect.value;
    state.srsQueue = state.terms.filter(t => mod === 'all' || t.module === mod);
    state.currentSrsIndex = 0;
    renderSrsCard();
  }

  function renderSrsCard() {
    if (!state.srsQueue || state.srsQueue.length === 0) {
      elements.srsCardWrapper.innerHTML = `
        <div class="flashcard">
          <h3 style="color:var(--accent-emerald);"><i class="fa-solid fa-circle-check"></i> Hoàn thành bộ thẻ!</h3>
        </div>
      `;
      return;
    }

    const item = state.srsQueue[state.currentSrsIndex];
    elements.srsCardWrapper.innerHTML = `
      <div class="flashcard" id="srs-card-el">
        <div class="f-front">
          <span class="hero-tag">${escapeHtml(item.module_name)}</span>
          <h2 style="font-size:1.8rem; font-weight:800; margin:1rem 0;">${escapeHtml(item.term)}</h2>
          <button class="btn-icon" style="margin:0 auto;" onclick="event.stopPropagation(); playAudio('${escapeJs(item.term)}')">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <p style="color:var(--text-muted); font-size:0.8rem; margin-top:2rem;"><i class="fa-solid fa-hand-pointer"></i> Chạm để lật xem đáp án</p>
        </div>
        <div class="f-back" style="display:none;">
          <h2 style="color:var(--accent-cyan); font-size:1.6rem;">${escapeHtml(item.term)}</h2>
          ${item.phonetic ? `<p style="font-family:var(--font-mono); color:var(--accent-cyan); margin-bottom:0.5rem;">${escapeHtml(item.phonetic)}</p>` : ''}
          <h3 style="color:var(--accent-emerald); font-size:1.3rem; margin-bottom:0.8rem;">${escapeHtml(item.vietnamese)}</h3>
          ${item.note ? `<p style="color:var(--text-secondary); font-size:0.9rem; max-width:500px;">${escapeHtml(item.note)}</p>` : ''}
        </div>
      </div>
    `;

    const el = document.getElementById('srs-card-el');
    el.addEventListener('click', () => {
      const f = el.querySelector('.f-front');
      const b = el.querySelector('.f-back');
      if (f.style.display !== 'none') {
        f.style.display = 'none';
        b.style.display = 'block';
        el.classList.add('flipped');
      } else {
        f.style.display = 'block';
        b.style.display = 'none';
        el.classList.remove('flipped');
      }
    });
  }

  window.rateCard = function(score) {
    if (!state.srsQueue || state.srsQueue.length === 0) return;
    const item = state.srsQueue[state.currentSrsIndex];
    const srs = state.srsData[item.id] || { level: 0 };

    if (score >= 3) srs.level = (srs.level || 0) + 1;
    else srs.level = Math.max(0, (srs.level || 0) - 1);

    state.srsData[item.id] = srs;
    localStorage.setItem('medterm_srs', JSON.stringify(state.srsData));

    state.currentSrsIndex = (state.currentSrsIndex + 1) % state.srsQueue.length;
    renderStats();
    renderSrsCard();
  };

  // --- INSANELY BEAUTIFUL ROOT MATCHING GAME ---
  window.startRootMatchGame = function() {
    state.selectedParts = [];

    const structuredPool = [
      {
        term: "HYPERTHYROIDISM",
        vietnamese: "Bệnh cường giáp (Tăng hoạt động tuyến giáp)",
        parts: [
          { type: "prefix", text: "hyper-", hint: "Tiền tố: Tăng" },
          { type: "root", text: "thyroid", hint: "Gốc từ: Tuyến giáp" },
          { type: "suffix", text: "-ism", hint: "Hậu tố: Bệnh lý" }
        ]
      },
      {
        term: "GASTROENTERITIS",
        vietnamese: "Viêm dạ dày ruột",
        parts: [
          { type: "root", text: "gastro-", hint: "Dạng kết hợp: Dạ dày" },
          { type: "root", text: "enter-", hint: "Gốc từ: Ruột" },
          { type: "suffix", text: "-itis", hint: "Hậu tố: Viêm" }
        ]
      },
      {
        term: "ELECTROCARDIOGRAM",
        vietnamese: "Điện tâm đồ (Bản ghi hoạt động điện tim)",
        parts: [
          { type: "prefix", text: "electro-", hint: "Tiền tố: Điện" },
          { type: "root", text: "cardio-", hint: "Dạng kết hợp: Tim" },
          { type: "suffix", text: "-gram", hint: "Hậu tố: Bản ghi" }
        ]
      },
      {
        term: "HYPOGLYCEMIA",
        vietnamese: "Hạ đường huyết",
        parts: [
          { type: "prefix", text: "hypo-", hint: "Tiền tố: Hạ / Giảm" },
          { type: "root", text: "glyc-", hint: "Gốc từ: Đường" },
          { type: "suffix", text: "-emia", hint: "Hậu tố: Tình trạng máu" }
        ]
      },
      {
        term: "COLPOSCOPY",
        vietnamese: "Soi cổ tử cung âm đạo",
        parts: [
          { type: "root", text: "colpo-", hint: "Dạng kết hợp: Âm đạo" },
          { type: "suffix", text: "-scopy", hint: "Hậu tố: Nội soi" }
        ]
      },
      {
        term: "HEPATOMEGALY",
        vietnamese: "Chứng gan to",
        parts: [
          { type: "root", text: "hepato-", hint: "Dạng kết hợp: Gan" },
          { type: "suffix", text: "-megaly", hint: "Hậu tố: Phì đại / To" }
        ]
      }
    ];

    const target = structuredPool[Math.floor(Math.random() * structuredPool.length)];
    state.currentMatchTarget = target;

    const shuffledParts = [...target.parts].sort(() => Math.random() - 0.5);

    elements.assemblyStage.innerHTML = `
      <div class="target-definition-box">
        <span style="font-size:0.85rem; color:var(--text-muted); font-weight:700;">MỤC TIÊU GHÉP CĂN TỐ Y KHOA:</span>
        <h3>" ${escapeHtml(target.vietnamese)} "</h3>
      </div>

      <div style="text-align:center; font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">
        <i class="fa-solid fa-arrow-down"></i> Nhấp các mảnh căn tố bên dưới để ghép:
      </div>

      <div class="assembly-drop-zone" id="drop-zone">
        <span style="color:var(--text-muted); font-size:0.9rem;" id="drop-placeholder">Chưa chọn thành phần nào...</span>
      </div>

      <div class="assembly-pool" id="assembly-pool">
        ${shuffledParts.map((p, idx) => `
          <button class="part-card ${p.type}" onclick="selectPart(${idx}, '${escapeJs(p.text)}')">
            <span>${escapeHtml(p.text)}</span>
            <small style="font-size:0.7rem; opacity:0.85;">(${escapeHtml(p.hint)})</small>
          </button>
        `).join('')}
      </div>

      <div style="display:flex; justify-content:center; gap:12px; margin-top:1.5rem;">
        <button class="btn-primary" style="max-width:180px;" onclick="checkAssemblyAnswer()"><i class="fa-solid fa-check"></i> Kiểm tra</button>
        <button class="btn-secondary" style="max-width:180px;" onclick="startRootMatchGame()"><i class="fa-solid fa-rotate-left"></i> Đổi câu hỏi</button>
      </div>

      <div class="assembly-feedback" id="assembly-feedback"></div>
    `;
  };

  window.selectPart = function(idx, text) {
    state.selectedParts.push(text);
    const dropZone = document.getElementById('drop-zone');
    const placeholder = document.getElementById('drop-placeholder');
    if (placeholder) placeholder.remove();

    const card = document.createElement('div');
    card.className = 'part-card root';
    card.style.background = 'linear-gradient(135deg, #3b82f6, #06b6d4)';
    card.textContent = text;
    dropZone.appendChild(card);
  };

  window.checkAssemblyAnswer = function() {
    const feedback = document.getElementById('assembly-feedback');
    if (!state.currentMatchTarget) return;

    const assembled = state.selectedParts.join('').replace(/-/g, '').toUpperCase();
    const correctClean = state.currentMatchTarget.term.replace(/-/g, '').toUpperCase();

    if (assembled === correctClean) {
      state.gameScore += 10;
      state.gameCombo += 1;
      elements.gameScore.textContent = state.gameScore;
      elements.gameCombo.textContent = state.gameCombo;

      feedback.style.color = 'var(--accent-emerald)';
      feedback.innerHTML = `🎉 CHÍNH XÁC! <strong>${state.currentMatchTarget.term}</strong> = ${escapeHtml(state.currentMatchTarget.vietnamese)}`;
      playAudio(state.currentMatchTarget.term);

      setTimeout(() => startRootMatchGame(), 2000);
    } else {
      state.gameCombo = 0;
      elements.gameCombo.textContent = 0;

      feedback.style.color = 'var(--accent-rose)';
      feedback.innerHTML = `❌ Chưa đúng! Bạn đã ghép: "${assembled}". Hãy thử lại!`;
    }
  };

  // --- AI DICTIONARY ---
  window.openAiTerm = function(term) {
    elements.aiSearchInput.value = term;
    switchTab('tab-ai-dict');
    performAiSearch();
  };

  async function performAiSearch() {
    const q = elements.aiSearchInput.value.trim();
    if (!q) return;

    elements.aiDictResponse.innerHTML = `
      <div style="text-align:center; padding:30px;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:var(--accent-cyan); margin-bottom:12px;"></i>
        <p style="color:var(--text-secondary);">Đang gửi truy vấn tới Gemini AI (${escapeHtml(state.apiModel)})...</p>
      </div>
    `;

    const localMatch = state.terms.find(t => t.term.toLowerCase() === q.toLowerCase());

    if (!state.apiKey) {
      elements.aiDictResponse.innerHTML = renderAiCardFormat(q, localMatch, false);
      return;
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${state.apiModel}:generateContent?key=${state.apiKey}`;
      const prompt = `Role: Medical English Professor. Explain term "${q}" strictly in this exact format:

Hello! Here is the explanation of the medical term "${q}" prepared for your studies.

${q}
Phonetic: /.../

1. Meaning in Vietnamese (Nghĩa tiếng Việt)
[Vietnamese Term Name]
[Detailed explanation & main functions]

2. Meaning in English
[Detailed English definition]

3. Clinical Example (Ví dụ lâm sàng)
English: "[Clinical sentence in English]"
Vietnamese: "[Translation in Vietnamese]"

4. Word Analysis & Related Medical Roots (Phân tích từ vựng & Căn tố y khoa)
While "${q}" uses standard English terms, medical terminology frequently uses Greek and Latin roots to describe specific parts of this system:
- [Root 1]: Example: ...
- [Root 2]: Example: ...

Good luck with your medical studies! Feel free to ask if you need further clarification on any related anatomical terms.`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        elements.aiDictResponse.innerHTML = `<div class="ai-result-content">${formatMarkdownText(text)}</div>`;
      } else {
        throw new Error('Lỗi dữ liệu từ Gemini.');
      }
    } catch (err) {
      elements.aiDictResponse.innerHTML = renderAiCardFormat(q, localMatch, true, err.message);
    }
  }

  function formatMarkdownText(text) {
    return text
      .replace(/Hello! Here is the explanation/g, '<div class="ai-greeting">Hello! Here is the explanation')
      .replace(/prepared for your studies\./g, 'prepared for your studies.</div>')
      .replace(/Phonetic:\s*(.*)/g, '<div class="ai-phonetic">Phonetic: $1</div>')
      .replace(/1\. Meaning in Vietnamese \(Nghĩa tiếng Việt\)/g, '<div class="ai-section"><div class="ai-section-title"><i class="fa-solid fa-language"></i> 1. Meaning in Vietnamese (Nghĩa tiếng Việt)</div><div class="ai-section-content">')
      .replace(/2\. Meaning in English/g, '</div></div><div class="ai-section"><div class="ai-section-title"><i class="fa-solid fa-book"></i> 2. Meaning in English</div><div class="ai-section-content">')
      .replace(/3\. Clinical Example \(Ví dụ lâm sàng\)/g, '</div></div><div class="ai-section"><div class="ai-section-title"><i class="fa-solid fa-stethoscope"></i> 3. Clinical Example (Ví dụ lâm sàng)</div><div class="ai-section-content">')
      .replace(/4\. Word Analysis & Related Medical Roots \(Phân tích từ vựng & Căn tố y khoa\)/g, '</div></div><div class="ai-section"><div class="ai-section-title"><i class="fa-solid fa-dna"></i> 4. Word Analysis & Related Medical Roots (Phân tích từ vựng & Căn tố y khoa)</div><div class="ai-section-content">')
      .replace(/Good luck with your medical studies!/g, '</div></div><div class="ai-footer-note">Good luck with your medical studies!')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function renderAiCardFormat(q, localMatch, isError = false, errMsg = '') {
    const termTitle = localMatch ? localMatch.term : q;
    const phonetic = localMatch ? localMatch.phonetic : '/fee-meyl ree-pruh-duhk-tiv sis-tuh m/';
    const vi = localMatch ? localMatch.vietnamese : 'Hệ sinh sản nữ / Thuật ngữ Y khoa';
    const note = localMatch ? localMatch.note : 'Cơ quan sinh dục trong và ngoài phụ trách chức năng sinh sản.';

    return `
      <div class="ai-result-content">
        ${isError ? `<div style="color:var(--accent-rose); margin-bottom:12px;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi Gemini API: ${escapeHtml(errMsg)}. Hiển thị dữ liệu local:</div>` : ''}
        <div class="ai-greeting">Hello! Here is the explanation of the medical term "${escapeHtml(termTitle)}" prepared for your studies.</div>
        
        <h2 style="font-size:1.5rem; font-weight:800; color:#fff;">${escapeHtml(termTitle)}</h2>
        <div class="ai-phonetic">Phonetic: ${escapeHtml(phonetic)}</div>

        <div class="ai-section">
          <div class="ai-section-title"><i class="fa-solid fa-language"></i> 1. Meaning in Vietnamese (Nghĩa tiếng Việt)</div>
          <div class="ai-section-content">
            <p><strong>${escapeHtml(vi)}</strong></p>
            <p>${escapeHtml(note)}</p>
          </div>
        </div>

        <div class="ai-section">
          <div class="ai-section-title"><i class="fa-solid fa-book"></i> 2. Meaning in English</div>
          <div class="ai-section-content">
            <p>The ensemble of anatomical organs and structures in medical terminology representing ${escapeHtml(termTitle)}.</p>
          </div>
        </div>

        <div class="ai-footer-note">
          <p><i class="fa-solid fa-key"></i> Bấm biểu tượng chìa khóa ở góc trên để dán API Key & trải nghiệm AI Gemini trực tiếp!</p>
        </div>
      </div>
    `;
  }

  function openTermModal(item) {
    elements.mTermTitle.textContent = item.term;
    elements.mTermBody.innerHTML = `
      <div style="margin-bottom:12px;">
        ${item.phonetic ? `<p style="font-family:var(--font-mono); color:var(--accent-cyan);">Phiên âm: ${escapeHtml(item.phonetic)}</p>` : ''}
        <h4 style="font-size:1.2rem; color:var(--accent-emerald); margin-top:4px;">${escapeHtml(item.vietnamese)}</h4>
      </div>
      ${item.note ? `<p style="color:var(--text-secondary); margin-bottom:16px;">${escapeHtml(item.note)}</p>` : ''}
      <div style="display:flex; gap:10px;">
        <button class="btn-primary" onclick="playAudio('${escapeJs(item.term)}')"><i class="fa-solid fa-volume-high"></i> Phát âm</button>
        <button class="btn-secondary" onclick="elements.modalTermDetail.classList.remove('active'); openAiTerm('${escapeJs(item.term)}');"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Tra cứu</button>
      </div>
    `;
    elements.modalTermDetail.classList.add('active');
  }

  function renderStats() {
    elements.statTotal.textContent = state.terms.length.toLocaleString();

    let mastered = 0;
    let learning = 0;

    Object.values(state.srsData).forEach(s => {
      if (s.level >= 4) mastered++;
      else if (s.level > 0) learning++;
    });

    elements.statMastered.textContent = mastered;
    elements.statLearning.textContent = learning;
    elements.statStreak.textContent = `${state.streak} Ngày`;
  }

  window.playAudio = function(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  };

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJs(s) {
    if (!s) return '';
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  init();
});
