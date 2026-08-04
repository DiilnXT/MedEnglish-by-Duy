/* ==========================================================================
   MedTerm AI Pro - Medical English Web Application
   Developed & Coded by Nhật Duy
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentTab: 'tab-home',
    terms: MEDICAL_DATA.terms || [],
    modules: MEDICAL_DATA.modules || [],
    apiKey: localStorage.getItem('medterm_api_key') || '',
    apiModel: localStorage.getItem('medterm_api_model') || 'gemini-2.5-flash',
    progress: JSON.parse(localStorage.getItem('medterm_progress') || '{}'),
    srsData: JSON.parse(localStorage.getItem('medterm_srs') || '{}'),
    streak: parseInt(localStorage.getItem('medterm_streak') || '1'),
    srsQueue: [],
    currentSrsIndex: 0,
    currentQuiz: null
  };

  // DOM Elements
  const elements = {
    navBtns: document.querySelectorAll('.nav-btn, .mobile-nav-btn'),
    tabPages: document.querySelectorAll('.tab-page'),
    modulesGrid: document.getElementById('modules-grid'),
    termSearchInput: document.getElementById('term-search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterModuleSelect: document.getElementById('filter-module-select'),
    termsGrid: document.getElementById('terms-grid'),
    searchCount: document.getElementById('search-count'),
    // SRS
    srsCardContainer: document.getElementById('srs-card-container'),
    srsModuleFilter: document.getElementById('srs-module-filter'),
    // Quiz
    quizContainer: document.getElementById('quiz-container'),
    quizModeBtns: document.querySelectorAll('.quiz-mode-btn'),
    // AI Dict
    aiSearchInput: document.getElementById('ai-search-input'),
    btnAiSearch: document.getElementById('btn-ai-search'),
    aiDictResponse: document.getElementById('ai-dict-response'),
    // Stats
    statTotalTerms: document.getElementById('stat-total-terms'),
    statMastered: document.getElementById('stat-mastered'),
    statStreak: document.getElementById('stat-streak'),
    // Progress
    pTotal: document.getElementById('p-total'),
    pMastered: document.getElementById('p-mastered'),
    pLearning: document.getElementById('p-learning'),
    pStreak: document.getElementById('p-streak'),
    moduleProgressList: document.getElementById('module-progress-list'),
    btnResetData: document.getElementById('btn-reset-data'),
    // Modals & API
    btnApiConfig: document.getElementById('btn-api-config'),
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
    // Term Detail Modal
    modalTermDetail: document.getElementById('modal-term-detail'),
    btnCloseTermModal: document.getElementById('btn-close-term-modal'),
    mTermTitle: document.getElementById('m-term-title'),
    mTermBody: document.getElementById('m-term-body')
  };

  // --- 1. INITIALIZATION ---
  function init() {
    updateApiStatus();
    populateSelectOptions();
    renderModules();
    renderTerms();
    renderStats();
    initSrs();
    initQuiz('en_vi');
    setupEventListeners();
  }

  // --- 2. NAVIGATION ---
  function setupEventListeners() {
    // Tab switching
    elements.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
      });
    });

    // Theme toggle
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
    });

    // Search events
    elements.termSearchInput.addEventListener('input', (e) => {
      if (e.target.value.trim()) {
        elements.btnClearSearch.style.display = 'block';
      } else {
        elements.btnClearSearch.style.display = 'none';
      }
      renderTerms();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.termSearchInput.value = '';
      elements.btnClearSearch.style.display = 'none';
      renderTerms();
    });

    elements.filterModuleSelect.addEventListener('change', renderTerms);

    // SRS Filter
    elements.srsModuleFilter.addEventListener('change', () => {
      initSrs();
    });

    // Quiz Modes
    elements.quizModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.quizModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initQuiz(btn.dataset.mode);
      });
    });

    // AI Search
    elements.btnAiSearch.addEventListener('click', performAiSearch);
    elements.aiSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performAiSearch();
    });

    // API Modal Events
    elements.btnApiConfig.addEventListener('click', () => {
      elements.inputApiKey.value = state.apiKey;
      elements.inputModelName.value = state.apiModel || 'gemini-2.5-flash';
      elements.modalApiConfig.classList.add('active');
    });

    elements.btnCloseApiModal.addEventListener('click', () => {
      elements.modalApiConfig.classList.remove('active');
    });

    elements.btnToggleKeyVis.addEventListener('click', () => {
      const type = elements.inputApiKey.type === 'password' ? 'text' : 'password';
      elements.inputApiKey.type = type;
      elements.btnToggleKeyVis.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });

    elements.btnPasteApiKey.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            elements.inputApiKey.value = text.trim();
            showApiMsg('Đã dán API Key từ Clipboard!', 'success');
          }
        } else {
          const manual = prompt('Hãy dán Gemini API Key của bạn vào đây:');
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
      showApiMsg(`Lưu thành công! API Key & Model (${model}) đã được lưu.`, 'success');
      setTimeout(() => {
        elements.modalApiConfig.classList.remove('active');
      }, 1200);
    });

    elements.btnClearApiKey.addEventListener('click', () => {
      state.apiKey = '';
      localStorage.removeItem('medterm_api_key');
      elements.inputApiKey.value = '';
      updateApiStatus();
      showApiMsg('Đã xóa API Key.', 'error');
    });

    // Term Modal Close
    elements.btnCloseTermModal.addEventListener('click', () => {
      elements.modalTermDetail.classList.remove('active');
    });

    // Reset Progress
    elements.btnResetData.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn đặt lại toàn bộ tiến độ học tập?')) {
        localStorage.removeItem('medterm_progress');
        localStorage.removeItem('medterm_srs');
        state.progress = {};
        state.srsData = {};
        renderStats();
        renderModuleProgress();
        alert('Đã đặt lại tiến độ.');
      }
    });
  }

  function switchTab(tabId) {
    state.currentTab = tabId;
    elements.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    elements.tabPages.forEach(page => {
      page.classList.toggle('active', page.id === tabId);
    });

    if (tabId === 'tab-progress') {
      renderModuleProgress();
    }
  }

  function updateApiStatus() {
    if (state.apiKey) {
      elements.apiStatusDot.classList.add('active');
    } else {
      elements.apiStatusDot.classList.remove('active');
    }
  }

  function showApiMsg(msg, type) {
    elements.apiKeyMsg.textContent = msg;
    elements.apiKeyMsg.className = `api-msg-box ${type}`;
  }

  // --- 3. RENDERING MODULES & TERMS ---
  function populateSelectOptions() {
    elements.filterModuleSelect.innerHTML = '<option value="all">-- Tất cả hệ cơ quan & chuyên đề --</option>';
    elements.srsModuleFilter.innerHTML = '<option value="all">Tất cả bài học</option>';

    state.modules.forEach(([id, name]) => {
      const opt = `<option value="${id}">${name}</option>`;
      elements.filterModuleSelect.insertAdjacentHTML('beforeend', opt);
      elements.srsModuleFilter.insertAdjacentHTML('beforeend', opt);
    });
  }

  function renderModules() {
    elements.modulesGrid.innerHTML = '';
    const moduleIcons = {
      cau_tao: 'fa-cubes',
      goc_tu: 'fa-tree',
      nguon_goc: 'fa-monument',
      dang_ket_hop: 'fa-link',
      hau_to: 'fa-tag',
      tien_to: 'fa-tags',
      phien_am: 'fa-volume-high',
      tong_quan: 'fa-child',
      tim_mach: 'fa-heart-pulse',
      ho_hap: 'fa-lungs',
      tieu_hoa: 'fa-apple-whole',
      than_kinh: 'fa-brain',
      sinh_san_nu: 'fa-venus'
    };

    state.modules.forEach(([id, name]) => {
      const count = state.terms.filter(t => t.module === id).length;
      const icon = moduleIcons[id] || 'fa-notes-medical';

      const card = document.createElement('div');
      card.className = 'module-card';
      card.innerHTML = `
        <div class="module-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="module-info">
          <h4>${name}</h4>
          <span class="module-count">${count} Thuật ngữ & Kiến thức</span>
        </div>
      `;
      card.addEventListener('click', () => {
        elements.filterModuleSelect.value = id;
        switchTab('tab-search');
        renderTerms();
      });
      elements.modulesGrid.appendChild(card);
    });
  }

  function renderTerms() {
    const query = elements.termSearchInput.value.toLowerCase().trim();
    const mod = elements.filterModuleSelect.value;

    let filtered = state.terms.filter(item => {
      const matchMod = mod === 'all' || item.module === mod;
      const matchQuery = !query || 
        item.term.toLowerCase().includes(query) ||
        item.vietnamese.toLowerCase().includes(query) ||
        item.note.toLowerCase().includes(query) ||
        item.phonetic.toLowerCase().includes(query);
      return matchMod && matchQuery;
    });

    elements.searchCount.textContent = filtered.length;
    elements.termsGrid.innerHTML = '';

    if (filtered.length === 0) {
      elements.termsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">Không tìm thấy thuật ngữ phù hợp với từ khóa.</p>`;
      return;
    }

    filtered.slice(0, 100).forEach(item => {
      const card = document.createElement('div');
      card.className = 'term-card';
      card.innerHTML = `
        <div>
          <div class="term-header">
            <div class="term-word">${escapeHtml(item.term)}</div>
            <button class="btn-speak" onclick="event.stopPropagation(); speakText('${escapeJs(item.term)}')">
              <i class="fa-solid fa-volume-high"></i>
            </button>
          </div>
          ${item.phonetic ? `<div class="term-phonetic">${escapeHtml(item.phonetic)}</div>` : ''}
          <div class="term-meaning">${escapeHtml(item.vietnamese || 'Đang cập nhật')}</div>
          ${item.note ? `<div class="term-note">${escapeHtml(item.note)}</div>` : ''}
        </div>
        <div class="term-footer">
          <span class="term-tag">${escapeHtml(item.module_name)}</span>
          <button class="btn-sub" style="font-size:11px; padding: 4px 8px;" onclick="event.stopPropagation(); openAiForTerm('${escapeJs(item.term)}')">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI Tra cứu
          </button>
        </div>
      `;
      card.addEventListener('click', () => openTermDetail(item));
      elements.termsGrid.appendChild(card);
    });
  }

  // --- 4. ANKI / SRS LOGIC ---
  function initSrs() {
    const selectedMod = elements.srsModuleFilter.value;
    state.srsQueue = state.terms.filter(t => selectedMod === 'all' || t.module === selectedMod);
    state.currentSrsIndex = 0;
    renderSrsCard();
  }

  function renderSrsCard() {
    if (!state.srsQueue || state.srsQueue.length === 0) {
      elements.srsCardContainer.innerHTML = `
        <div class="flashcard-box">
          <h3><i class="fa-solid fa-circle-check" style="color:var(--accent-emerald);"></i> Đã hoàn thành bộ thẻ!</h3>
          <p style="color:var(--text-secondary); margin-top:10px;">Bạn đã xem qua tất cả thuật ngữ trong danh mục này.</p>
        </div>
      `;
      return;
    }

    const item = state.srsQueue[state.currentSrsIndex];
    elements.srsCardContainer.innerHTML = `
      <div class="flashcard-box" id="flashcard-el">
        <div class="card-front">
          <span class="hero-tag" style="margin-bottom:16px;">${escapeHtml(item.module_name)}</span>
          <h2 style="font-size: 28px; font-weight:800; margin-bottom:12px;">${escapeHtml(item.term)}</h2>
          <button class="btn-icon" style="margin: 0 auto 16px auto;" onclick="event.stopPropagation(); speakText('${escapeJs(item.term)}')">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <p class="card-hint"><i class="fa-solid fa-hand-pointer"></i> Chạm để lật xem đáp án</p>
        </div>
        <div class="card-back" style="display:none;">
          <h2 style="font-size: 24px; color:var(--accent-cyan); margin-bottom:8px;">${escapeHtml(item.term)}</h2>
          ${item.phonetic ? `<p style="font-family:var(--font-mono); color:var(--accent-cyan); margin-bottom:12px;">${escapeHtml(item.phonetic)}</p>` : ''}
          <h3 style="font-size: 20px; color:var(--accent-emerald); margin-bottom:12px;">${escapeHtml(item.vietnamese)}</h3>
          ${item.note ? `<p style="font-size:14px; color:var(--text-secondary); max-width:450px; margin-bottom:16px;">${escapeHtml(item.note)}</p>` : ''}
          
          <div class="srs-buttons-row" onclick="event.stopPropagation();">
            <button class="btn-srs btn-again" onclick="rateSrs('${item.id}', 1)">
              <span>Lặp lại</span><span class="sub">+1m</span>
            </button>
            <button class="btn-srs btn-hard" onclick="rateSrs('${item.id}', 2)">
              <span>Khó</span><span class="sub">+1d</span>
            </button>
            <button class="btn-srs btn-good" onclick="rateSrs('${item.id}', 3)">
              <span>Tốt</span><span class="sub">+3d</span>
            </button>
            <button class="btn-srs btn-easy" onclick="rateSrs('${item.id}', 4)">
              <span>Rất dễ</span><span class="sub">+6d</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const el = document.getElementById('flashcard-el');
    el.addEventListener('click', () => {
      const front = el.querySelector('.card-front');
      const back = el.querySelector('.card-back');
      if (front.style.display !== 'none') {
        front.style.display = 'none';
        back.style.display = 'block';
        el.classList.add('flipped');
      } else {
        front.style.display = 'block';
        back.style.display = 'none';
        el.classList.remove('flipped');
      }
    });
  }

  window.rateSrs = function(id, rating) {
    const srs = state.srsData[id] || { level: 0, reps: 0 };
    if (rating >= 3) {
      srs.level = (srs.level || 0) + 1;
      srs.reps = (srs.reps || 0) + 1;
    } else {
      srs.level = Math.max(0, (srs.level || 0) - 1);
    }
    state.srsData[id] = srs;
    localStorage.setItem('medterm_srs', JSON.stringify(state.srsData));

    state.currentSrsIndex = (state.currentSrsIndex + 1) % state.srsQueue.length;
    renderStats();
    renderSrsCard();
  };

  // --- 5. QUIZ ENGINE ---
  function initQuiz(mode) {
    if (state.terms.length < 4) return;

    // Pick a random target
    const target = state.terms[Math.floor(Math.random() * state.terms.length)];
    
    // Pick 3 distractor options
    const dists = [];
    while (dists.length < 3) {
      const rand = state.terms[Math.floor(Math.random() * state.terms.length)];
      if (rand.id !== target.id && !dists.includes(rand)) {
        dists.push(rand);
      }
    }

    const options = [target, ...dists].sort(() => Math.random() - 0.5);

    if (mode === 'en_vi') {
      elements.quizContainer.innerHTML = `
        <div class="quiz-question-title">" ${escapeHtml(target.term)} " mang nghĩa tiếng Việt là gì?</div>
        <div class="quiz-options">
          ${options.map(opt => `
            <button class="quiz-opt-btn" onclick="checkQuizAnswer(this, ${opt.id === target.id})">
              ${escapeHtml(opt.vietnamese || 'Thuật ngữ Y khoa')}
            </button>
          `).join('')}
        </div>
      `;
    } else if (mode === 'vi_en') {
      elements.quizContainer.innerHTML = `
        <div class="quiz-question-title">Thuật ngữ Tiếng Anh của " ${escapeHtml(target.vietnamese || target.term)} " là gì?</div>
        <div class="quiz-options">
          ${options.map(opt => `
            <button class="quiz-opt-btn" onclick="checkQuizAnswer(this, ${opt.id === target.id})">
              <strong>${escapeHtml(opt.term)}</strong> ${opt.phonetic ? `<small>(${escapeHtml(opt.phonetic)})</small>` : ''}
            </button>
          `).join('')}
        </div>
      `;
    } else {
      // Root Matching
      const rootTerms = state.terms.filter(t => t.term.includes('-') || t.note.includes('gốc'));
      const sampleRoot = rootTerms.length > 0 ? rootTerms[Math.floor(Math.random() * rootTerms.length)] : target;
      elements.quizContainer.innerHTML = `
        <div class="quiz-question-title">Gốc từ / Căn tố " ${escapeHtml(sampleRoot.term)} " biểu thị ý nghĩa nào?</div>
        <div class="quiz-options">
          ${options.map(opt => `
            <button class="quiz-opt-btn" onclick="checkQuizAnswer(this, ${opt.id === sampleRoot.id})">
              ${escapeHtml(opt.vietnamese || opt.note || 'Ý nghĩa y khoa')}
            </button>
          `).join('')}
        </div>
      `;
    }
  }

  window.checkQuizAnswer = function(btn, isCorrect) {
    const opts = elements.quizContainer.querySelectorAll('.quiz-opt-btn');
    opts.forEach(b => b.disabled = true);

    if (isCorrect) {
      btn.classList.add('correct');
      setTimeout(() => {
        const activeBtn = document.querySelector('.quiz-mode-btn.active');
        initQuiz(activeBtn ? activeBtn.dataset.mode : 'en_vi');
      }, 1000);
    } else {
      btn.classList.add('wrong');
      setTimeout(() => {
        const activeBtn = document.querySelector('.quiz-mode-btn.active');
        initQuiz(activeBtn ? activeBtn.dataset.mode : 'en_vi');
      }, 1400);
    }
  };

  // --- 6. AI DICTIONARY & GEMINI API INTEGRATION ---
  window.openAiForTerm = function(term) {
    elements.aiSearchInput.value = term;
    switchTab('tab-ai-dict');
    performAiSearch();
  };

  window.quickAiSearch = function(term) {
    elements.aiSearchInput.value = term;
    performAiSearch();
  };

  async function performAiSearch() {
    const query = elements.aiSearchInput.value.trim();
    if (!query) return;

    elements.aiDictResponse.innerHTML = `
      <div style="text-align:center; padding: 40px 0;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:var(--accent-cyan); margin-bottom:12px;"></i>
        <p style="color:var(--text-secondary);">Đang gửi truy vấn tới AI Gemini (${escapeHtml(state.apiModel)})...</p>
      </div>
    `;

    // Local DB lookup for instant context
    const localMatch = state.terms.find(t => t.term.toLowerCase() === query.toLowerCase() || t.term.toLowerCase().includes(query.toLowerCase()));

    if (!state.apiKey) {
      // Fallback local dictionary response if API key is not provided
      setTimeout(() => {
        elements.aiDictResponse.innerHTML = renderLocalAiFallback(query, localMatch);
      }, 400);
      return;
    }

    try {
      const model = state.apiModel || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

      const prompt = `
Role: Professional Medical English Expert & Academic Professor.
Task: Explain the medical term "${query}" for a medical student.

STRICT FORMAT REQUIREMENT:
You MUST format your exact response as structured markdown as follows:

Hello! Here is the explanation of the medical term "${query}" prepared for your studies.

${query}
Phonetic: /phonetic_spelling/

1. Meaning in Vietnamese (Nghĩa tiếng Việt)
[Vietnamese translation name]
[Detailed Vietnamese explanation and main functions/Chức năng chính]

2. Meaning in English
[Detailed English medical definition]

3. Clinical Example (Ví dụ lâm sàng)
English: "[Clinical example sentence in English]"
Vietnamese: "[Vietnamese translation of clinical example]"

4. Word Analysis & Related Medical Roots (Phân tích từ vựng & Căn tố y khoa)
While "${query}" uses standard English terms, medical terminology frequently uses Greek and Latin roots to describe specific parts of this system:
- [Root/Prefix/Suffix] (Greek/Latin root for ...): Example: [Example Term]: [Vietnamese translation]
- [Root/Prefix/Suffix] (Greek/Latin root for ...): Example: [Example Term]: [Vietnamese translation]

Good luck with your medical studies! Feel free to ask if you need further clarification on any related anatomical terms.
`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (aiText) {
        elements.aiDictResponse.innerHTML = formatAiResponseToCard(aiText, query, localMatch);
      } else {
        throw new Error('Không nhận được phản hồi từ AI.');
      }
    } catch (err) {
      console.error(err);
      elements.aiDictResponse.innerHTML = `
        <div class="api-msg-box error" style="display:block;">
          <p><strong><i class="fa-solid fa-triangle-exclamation"></i> Lỗi kết nối Gemini API:</strong> ${escapeHtml(err.message)}</p>
          <p style="margin-top:6px; font-size:12px;">Vui lòng kiểm tra lại API Key và Tên Model trong phần Cài đặt API (biểu tượng chìa khóa ở góc trên).</p>
        </div>
        ${renderLocalAiFallback(query, localMatch)}
      `;
    }
  }

  function formatAiResponseToCard(text, query, localMatch) {
    // Parse markdown sections cleanly
    let html = `<div class="ai-result-content">`;
    
    // Process markdown to HTML
    let formatted = text
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

    html += formatted + `</div></div>`;
    return html;
  }

  function renderLocalAiFallback(query, localMatch) {
    if (!localMatch) {
      return `
        <div class="ai-welcome-box">
          <i class="fa-solid fa-circle-info" style="font-size:32px; color:var(--accent-amber); margin-bottom:12px;"></i>
          <h3>Chưa cấu hình Gemini API Key</h3>
          <p style="color:var(--text-secondary); margin-top:8px;">Hãy bấm biểu tượng chìa khóa <i class="fa-solid fa-key"></i> ở góc trên màn hình để dán Gemini API Key và tận hưởng tính năng AI Tra Cứu Y Khoa chuyên sâu!</p>
        </div>
      `;
    }

    return `
      <div class="ai-result-content">
        <div class="ai-greeting">Hello! Here is the explanation of the medical term "${escapeHtml(localMatch.term)}" prepared for your studies.</div>
        
        <div style="margin-bottom:16px;">
          <h2 class="ai-term-title">${escapeHtml(localMatch.term)}</h2>
          ${localMatch.phonetic ? `<div class="ai-phonetic">Phonetic: ${escapeHtml(localMatch.phonetic)}</div>` : ''}
        </div>

        <div class="ai-section">
          <div class="ai-section-title"><i class="fa-solid fa-language"></i> 1. Meaning in Vietnamese (Nghĩa tiếng Việt)</div>
          <div class="ai-section-content">
            <p><strong>${escapeHtml(localMatch.vietnamese)}</strong></p>
            <p>${escapeHtml(localMatch.note || 'Thuộc chuyên đề ' + localMatch.module_name)}</p>
          </div>
        </div>

        <div class="ai-section">
          <div class="ai-section-title"><i class="fa-solid fa-dna"></i> 2. Chuyên đề & Cấu trúc</div>
          <div class="ai-section-content">
            <p>Chuyên khoa: <strong>${escapeHtml(localMatch.module_name)}</strong></p>
          </div>
        </div>

        <div class="ai-footer-note">
          <p><i class="fa-solid fa-circle-info"></i> Bạn muốn tra cứu chi tiết ví dụ lâm sàng & căn tố La-tinh/Hy Lạp của AI? Hãy bấm biểu tượng <i class="fa-solid fa-key"></i> để dán Gemini API Key & chọn Model!</p>
        </div>
      </div>
    `;
  }

  function openTermDetail(item) {
    elements.mTermTitle.textContent = item.term;
    elements.mTermBody.innerHTML = `
      <div style="margin-bottom:12px;">
        ${item.phonetic ? `<p style="font-family:var(--font-mono); color:var(--accent-cyan); font-size:15px;">Phên âm: ${escapeHtml(item.phonetic)}</p>` : ''}
        <h4 style="font-size:18px; color:var(--accent-emerald); margin-top:6px;">Nghĩa: ${escapeHtml(item.vietnamese)}</h4>
      </div>
      ${item.note ? `<p style="color:var(--text-secondary); margin-bottom:16px; font-size:14px; line-height:1.5;">${escapeHtml(item.note)}</p>` : ''}
      <div style="background:var(--bg-dark); padding:12px; border-radius:var(--radius-md); margin-bottom:16px;">
        <span style="font-size:12px; color:var(--text-muted); font-weight:600;">CHUYÊN ĐỀ Y KHOA:</span>
        <p style="font-weight:700; color:var(--accent-blue);">${escapeHtml(item.module_name)}</p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn-primary" onclick="speakText('${escapeJs(item.term)}')"><i class="fa-solid fa-volume-high"></i> Phát âm</button>
        <button class="btn-secondary" onclick="elements.modalTermDetail.classList.remove('active'); openAiForTerm('${escapeJs(item.term)}');"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Tra cứu sâu</button>
      </div>
    `;
    elements.modalTermDetail.classList.add('active');
  }

  // --- 7. STATS & PROGRESS ---
  function renderStats() {
    elements.statTotalTerms.textContent = state.terms.length.toLocaleString();
    elements.pTotal.textContent = state.terms.length.toLocaleString();

    let masteredCount = 0;
    let learningCount = 0;

    Object.values(state.srsData).forEach(item => {
      if (item.level >= 4) masteredCount++;
      else if (item.level > 0) learningCount++;
    });

    elements.statMastered.textContent = masteredCount;
    elements.pMastered.textContent = masteredCount;
    elements.pLearning.textContent = learningCount;

    elements.statStreak.textContent = `${state.streak} ngày`;
    elements.pStreak.textContent = state.streak;
  }

  function renderModuleProgress() {
    elements.moduleProgressList.innerHTML = '';

    state.modules.forEach(([id, name]) => {
      const moduleTerms = state.terms.filter(t => t.module === id);
      const total = moduleTerms.length;
      let mastered = 0;

      moduleTerms.forEach(t => {
        const srs = state.srsData[t.id];
        if (srs && srs.level >= 4) mastered++;
      });

      const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'm-prog-item';
      item.innerHTML = `
        <div class="m-prog-header">
          <span>${name}</span>
          <span>${mastered} / ${total} (${pct}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
      `;
      elements.moduleProgressList.appendChild(item);
    });
  }

  // --- 8. AUDIO SPEECH SYNTHESIS ---
  window.speakText = function(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Helper escape utilities
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJs(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  // Initialize
  init();
});
