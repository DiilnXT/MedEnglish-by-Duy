/* MedTerm AI Pro - Medical English Web Application
   Designed & Coded by Nhật Duy
*/

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    terms: MEDICAL_DATA.terms || MEDICAL_DATA || [],
    modules: MEDICAL_DATA.modules || [],
    apiKey: localStorage.getItem('gemini_api_key') || '',
    apiModel: localStorage.getItem('gemini_api_model') || 'gemini-2.5-flash',
    srsData: JSON.parse(localStorage.getItem('medterm_srs') || '{}'),
    streak: parseInt(localStorage.getItem('medterm_streak') || '1'),
    currentModule: 'all',
    srsQueue: [],
    currentSrsIndex: 0,
    quizScore: 0,
    quizTotalAsked: 0,
    currentQuizTarget: null,
    // Builder State
    builderTarget: null,
    builderSelected: { prefix: '', root: '', suffix: '' }
  };

  const elements = {
    navItems: document.querySelectorAll('.nav-item, .mobile-nav-item'),
    appViews: document.querySelectorAll('.app-view'),
    globalModuleSelect: document.getElementById('global-module-select'),
    // Stats
    statTotalTerms: document.getElementById('stat-total-terms'),
    statDueToday: document.getElementById('stat-due-today'),
    statMastered: document.getElementById('stat-mastered'),
    statAccuracy: document.getElementById('stat-accuracy'),
    streakCounter: document.getElementById('streak-counter'),
    bannerDueCount: document.getElementById('banner-due-count'),
    modulesProgressContainer: document.getElementById('modules-progress-container'),
    // SRS
    mainFlashcard: document.getElementById('main-flashcard'),
    srsActions: document.getElementById('srs-actions'),
    flipPromptBtn: document.getElementById('flip-prompt-btn'),
    cardFlipTrigger: document.getElementById('card-flip-trigger'),
    ankiRemainingCount: document.getElementById('anki-remaining-count'),
    cardModuleTitle: document.getElementById('card-module-title'),
    cardTermText: document.getElementById('card-term-text'),
    cardPhoneticText: document.getElementById('card-phonetic-text'),
    cardSpeakBtn: document.getElementById('card-speak-btn'),
    cardBackModuleTitle: document.getElementById('card-back-module-title'),
    cardMeaningText: document.getElementById('card-meaning-text'),
    cardBreakdownText: document.getElementById('card-breakdown-text'),
    cardNoteText: document.getElementById('card-note-text'),
    // Quiz
    quizCardBox: document.getElementById('quiz-card-box'),
    quizQuestionText: document.getElementById('quiz-question-text'),
    quizSubtext: document.getElementById('quiz-subtext'),
    quizOptionsContainer: document.getElementById('quiz-options-container'),
    quizExplanationBox: document.getElementById('quiz-explanation-box'),
    quizExplanationText: document.getElementById('quiz-explanation-text'),
    quizNextBtn: document.getElementById('quiz-next-btn'),
    quizScore: document.getElementById('quiz-score'),
    quizTotalAsked: document.getElementById('quiz-total-asked'),
    // Builder
    builderMeaningTarget: document.getElementById('builder-meaning-target'),
    slotPrefix: document.getElementById('slot-prefix'),
    slotRoot: document.getElementById('slot-root'),
    slotSuffix: document.getElementById('slot-suffix'),
    assembledTerm: document.getElementById('assembled-term'),
    paletteChips: document.getElementById('palette-chips'),
    builderResetBtn: document.getElementById('builder-reset-btn'),
    builderCheckBtn: document.getElementById('builder-check-btn'),
    // Dict
    dictSearchInput: document.getElementById('dict-search-input'),
    dictClearBtn: document.getElementById('dict-clear-btn'),
    dictResultsCount: document.getElementById('dict-results-count'),
    dictListContainer: document.getElementById('dict-list-container'),
    // AI Search
    aiSearchInput: document.getElementById('ai-search-input'),
    aiSearchBtn: document.getElementById('ai-search-btn'),
    aiDictResponse: document.getElementById('ai-dict-response'),
    // Modal
    settingsModal: document.getElementById('settings-modal'),
    openSettingsModal: document.getElementById('open-settings-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    saveApiKeyBtn: document.getElementById('save-api-key-btn'),
    clearKeyBtn: document.getElementById('clear-key-btn'),
    pasteKeyBtn: document.getElementById('paste-key-btn'),
    geminiApiKeyInput: document.getElementById('gemini-api-key-input'),
    geminiModelInput: document.getElementById('gemini-model-input'),
    apiKeyStatusText: document.getElementById('api-key-status-text')
  };

  function init() {
    updateApiKeyStatus();
    populateGlobalSelect();
    renderDashboard();
    renderDictionary();
    initSrs();
    initQuiz();
    initBuilder();
    setupEventListeners();
    // Default search run for AI Dict
    performAiSearch();
  }

  function updateApiKeyStatus() {
    if (elements.apiKeyStatusText) {
      if (state.apiKey) {
        const trunc = state.apiKey.substring(0, 6) + '...' + state.apiKey.slice(-4);
        elements.apiKeyStatusText.textContent = `Đã lưu Key (${trunc})`;
        elements.apiKeyStatusText.style.color = 'var(--accent-green)';
        elements.geminiApiKeyInput.value = state.apiKey;
      } else {
        elements.apiKeyStatusText.textContent = 'Chưa lưu API Key';
        elements.apiKeyStatusText.style.color = 'var(--accent-orange)';
        elements.geminiApiKeyInput.value = '';
      }
    }
    if (elements.geminiModelInput) {
      elements.geminiModelInput.value = state.apiModel || 'gemini-2.5-flash';
    }
  }

  function setupEventListeners() {
    // Navigation items
    elements.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        switchView(view);
      });
    });

    // Mobile Menu Toggle
    document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('active');
    });

    // Theme Toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      const curr = document.documentElement.getAttribute('data-theme');
      const next = curr === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
    });

    // Module dropdown
    elements.globalModuleSelect.addEventListener('change', (e) => {
      state.currentModule = e.target.value;
      renderDashboard();
      renderDictionary();
      initSrs();
    });

    // Dashboard Banner Actions
    document.getElementById('start-anki-btn')?.addEventListener('click', () => switchView('srs-study'));
    document.getElementById('go-quiz-btn')?.addEventListener('click', () => switchView('quiz'));

    // SRS Flip & Speaks
    elements.cardFlipTrigger?.addEventListener('click', flipFlashcard);
    elements.mainFlashcard?.addEventListener('click', flipFlashcard);
    elements.cardSpeakBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(elements.cardTermText.textContent);
    });

    document.querySelectorAll('.srs-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        rateSrsCard(btn.dataset.rating);
      });
    });

    // Quiz
    elements.quizNextBtn?.addEventListener('click', initQuiz);

    // Builder
    elements.builderResetBtn?.addEventListener('click', resetBuilderSlots);
    elements.builderCheckBtn?.addEventListener('click', checkBuilderAnswer);

    // Dict search
    elements.dictSearchInput?.addEventListener('input', (e) => {
      elements.dictClearBtn.style.display = e.target.value.trim() ? 'block' : 'none';
      renderDictionary();
    });

    elements.dictClearBtn?.addEventListener('click', () => {
      elements.dictSearchInput.value = '';
      elements.dictClearBtn.style.display = 'none';
      renderDictionary();
    });

    // AI Search
    elements.aiSearchBtn?.addEventListener('click', performAiSearch);
    elements.aiSearchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performAiSearch();
    });

    // Modal
    document.getElementById('ai-status-btn')?.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
    elements.openSettingsModal?.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
    elements.closeModalBtn?.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));
    elements.cancelSettingsBtn?.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));

    // Paste Key
    elements.pasteKeyBtn?.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clip = await navigator.clipboard.readText();
          if (clip) {
            elements.geminiApiKeyInput.value = clip.trim();
            alert('📋 Đã dán API Key từ Clipboard!');
          }
        } else {
          const manual = prompt('Dán Gemini API Key của bạn:');
          if (manual) elements.geminiApiKeyInput.value = manual.trim();
        }
      } catch (err) {
        const manual = prompt('Dán Gemini API Key của bạn:');
        if (manual) elements.geminiApiKeyInput.value = manual.trim();
      }
    });

    // Save Key
    elements.saveApiKeyBtn?.addEventListener('click', () => {
      const keyVal = elements.geminiApiKeyInput.value.trim();
      const modelVal = elements.geminiModelInput.value.trim() || 'gemini-2.5-flash';

      state.apiKey = keyVal;
      state.apiModel = modelVal;

      localStorage.setItem('gemini_api_key', keyVal);
      localStorage.setItem('gemini_api_model', modelVal);

      updateApiKeyStatus();
      alert('✅ Đã lưu cấu hình Gemini API Key & Model thành công!');
      elements.settingsModal.classList.add('hidden');
    });

    elements.clearKeyBtn?.addEventListener('click', () => {
      state.apiKey = '';
      localStorage.removeItem('gemini_api_key');
      updateApiKeyStatus();
      alert('🗑️ Đã xóa API Key.');
    });
  }

  function switchView(viewId) {
    elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });
    elements.appViews.forEach(v => {
      v.classList.toggle('active', v.id === `view-${viewId}`);
    });
    document.getElementById('sidebar')?.classList.remove('active');
  }

  function populateGlobalSelect() {
    elements.globalModuleSelect.innerHTML = `<option value="all">📚 Tất cả 13 Chương Data (1,342 Từ)</option>`;
    state.modules.forEach(([id, name]) => {
      const count = state.terms.filter(t => t.module === id).length;
      elements.globalModuleSelect.insertAdjacentHTML('beforeend', `<option value="${id}">${name} (${count} từ)</option>`);
    });
  }

  // --- DASHBOARD ---
  function renderDashboard() {
    const total = state.terms.length;
    let mastered = 0;
    let learning = 0;

    Object.values(state.srsData).forEach(s => {
      if (s.level >= 4) mastered++;
      else if (s.level > 0) learning++;
    });

    elements.statTotalTerms.textContent = total.toLocaleString();
    elements.statDueToday.textContent = Math.min(25, total - mastered);
    elements.bannerDueCount.textContent = Math.min(25, total - mastered);
    elements.statMastered.textContent = mastered.toLocaleString();
    elements.statLearning.textContent = learning.toLocaleString();
    elements.streakCounter.textContent = state.streak;

    const acc = state.quizTotalAsked > 0 ? Math.round((state.quizScore / state.quizTotalAsked) * 100) : 100;
    elements.statAccuracy.textContent = `${acc}%`;

    elements.modulesProgressContainer.innerHTML = '';
    state.modules.forEach(([id, name]) => {
      const modTerms = state.terms.filter(t => t.module === id);
      const mTotal = modTerms.length;
      let mMastered = 0;
      modTerms.forEach(t => {
        if (state.srsData[t.id] && state.srsData[t.id].level >= 4) mMastered++;
      });
      const pct = mTotal > 0 ? Math.round((mMastered / mTotal) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'module-progress-card';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.9rem; margin-bottom:6px;">
          <span>${escapeHtml(name)}</span>
          <span>${mMastered}/${mTotal} (${pct}%)</span>
        </div>
        <div class="progress-bar-bg" style="height:8px; background:var(--bg-primary); border-radius:4px; overflow:hidden;">
          <div class="progress-bar-fill" style="width:${pct}%; height:100%; background:var(--gradient-glow); border-radius:4px; transition:width 0.4s ease;"></div>
        </div>
      `;
      elements.modulesProgressContainer.appendChild(item);
    });
  }

  // --- SRS / ANKI ---
  function initSrs() {
    const pool = state.currentModule === 'all' ? state.terms : state.terms.filter(t => t.module === state.currentModule);
    state.srsQueue = pool.length > 0 ? pool : state.terms;
    state.currentSrsIndex = 0;
    renderSrsCard();
  }

  function renderSrsCard() {
    if (!state.srsQueue || state.srsQueue.length === 0) return;
    const item = state.srsQueue[state.currentSrsIndex];

    elements.ankiRemainingCount.textContent = `${state.currentSrsIndex + 1} / ${state.srsQueue.length}`;
    elements.cardModuleTitle.textContent = item.module_name;
    elements.cardTermText.textContent = item.term;
    elements.cardPhoneticText.textContent = item.phonetic || '';

    elements.cardBackModuleTitle.textContent = item.module_name;
    elements.cardMeaningText.textContent = item.vietnamese || 'Thuật ngữ Y khoa';
    elements.cardBreakdownText.innerHTML = `<strong>Chuyên đề:</strong> ${escapeHtml(item.module_name)}`;
    elements.cardNoteText.textContent = item.note || 'Ghi chú học tập';

    const front = elements.mainFlashcard.querySelector('.card-front');
    const back = elements.mainFlashcard.querySelector('.card-back');
    front.style.display = 'flex';
    back.style.display = 'none';
    elements.mainFlashcard.classList.remove('flipped');
    elements.srsActions.classList.add('hidden');
    elements.flipPromptBtn.classList.remove('hidden');
  }

  function flipFlashcard() {
    const front = elements.mainFlashcard.querySelector('.card-front');
    const back = elements.mainFlashcard.querySelector('.card-back');
    if (front.style.display !== 'none') {
      front.style.display = 'none';
      back.style.display = 'flex';
      elements.mainFlashcard.classList.add('flipped');
      elements.srsActions.classList.remove('hidden');
      elements.flipPromptBtn.classList.add('hidden');
    }
  }

  function rateSrsCard(rating) {
    if (!state.srsQueue || state.srsQueue.length === 0) return;
    const item = state.srsQueue[state.currentSrsIndex];
    const srs = state.srsData[item.id] || { level: 0 };

    if (rating === 'good' || rating === 'easy') {
      srs.level = (srs.level || 0) + (rating === 'easy' ? 2 : 1);
    } else {
      srs.level = Math.max(0, (srs.level || 0) - 1);
    }

    state.srsData[item.id] = srs;
    localStorage.setItem('medterm_srs', JSON.stringify(state.srsData));

    state.currentSrsIndex = (state.currentSrsIndex + 1) % state.srsQueue.length;
    renderDashboard();
    renderSrsCard();
  }

  // --- QUIZ ---
  function initQuiz() {
    const pool = state.currentModule === 'all' ? state.terms : state.terms.filter(t => t.module === state.currentModule);
    const targetPool = pool.length >= 4 ? pool : state.terms;

    const target = targetPool[Math.floor(Math.random() * targetPool.length)];
    state.currentQuizTarget = target;

    const dists = [];
    while (dists.length < 3) {
      const rand = state.terms[Math.floor(Math.random() * state.terms.length)];
      if (rand.id !== target.id && !dists.includes(rand)) dists.push(rand);
    }

    const options = [target, ...dists].sort(() => Math.random() - 0.5);

    elements.quizQuestionText.innerHTML = `Thuật ngữ Y khoa nào mang nghĩa: <br><span style="color:var(--accent-green); font-size:1.4rem; font-weight:800;">"${escapeHtml(target.vietnamese || target.term)}"</span>?`;
    elements.quizSubtext.textContent = `Chuyên khoa: ${target.module_name}`;

    elements.quizOptionsContainer.innerHTML = options.map((opt, idx) => `
      <button class="option-btn" data-id="${opt.id}" onclick="checkQuizOption(this, '${opt.id}', '${target.id}')">
        <span><b>${String.fromCharCode(65 + idx)}.</b> ${escapeHtml(opt.term)} ${opt.phonetic ? `<small style="color:var(--text-muted)">(${escapeHtml(opt.phonetic)})</small>` : ''}</span>
      </button>
    `).join('');

    elements.quizExplanationBox.classList.add('hidden');
    elements.quizNextBtn.classList.add('hidden');
  }

  window.checkQuizOption = function(btn, selectedId, correctId) {
    const btns = elements.quizOptionsContainer.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);

    state.quizTotalAsked++;

    if (selectedId === correctId) {
      state.quizScore++;
      btn.classList.add('correct');
      elements.quizExplanationText.textContent = `🎉 Chính xác! "${state.currentQuizTarget.term}" nghĩa là: ${state.currentQuizTarget.vietnamese}`;
    } else {
      btn.classList.add('incorrect');
      btns.forEach(b => { if (b.dataset.id === correctId) b.classList.add('correct'); });
      elements.quizExplanationText.textContent = `❌ Chưa đúng! Đáp án đúng là: ${state.currentQuizTarget.term} (${state.currentQuizTarget.vietnamese})`;
    }

    elements.quizScore.textContent = state.quizScore;
    elements.quizTotalAsked.textContent = state.quizTotalAsked;
    elements.quizExplanationBox.classList.remove('hidden');
    elements.quizNextBtn.classList.remove('hidden');
  };

  // --- TERM BUILDER & GHÉP TỪ GỐC ---
  function initBuilder() {
    const builderPool = [
      {
        term: "HYPERTHYROIDISM",
        meaning: "Bệnh cường giáp (Tăng hoạt động tuyến giáp)",
        slots: { prefix: "hyper-", root: "thyroid", suffix: "-ism" }
      },
      {
        term: "GASTROENTERITIS",
        meaning: "Viêm dạ dày ruột",
        slots: { prefix: "", root: "gastroenter", suffix: "-itis" }
      },
      {
        term: "ELECTROCARDIOGRAM",
        meaning: "Điện tâm đồ (Bản ghi hoạt động điện tim)",
        slots: { prefix: "electro-", root: "cardio", suffix: "-gram" }
      },
      {
        term: "HYPOGLYCEMIA",
        meaning: "Hạ đường huyết",
        slots: { prefix: "hypo-", root: "glyc", suffix: "-emia" }
      },
      {
        term: "HEPATOMEGALY",
        meaning: "Chứng gan to (Sự phì đại của gan)",
        slots: { prefix: "", root: "hepato", suffix: "-megaly" }
      }
    ];

    const target = builderPool[Math.floor(Math.random() * builderPool.length)];
    state.builderTarget = target;
    resetBuilderSlots();

    elements.builderMeaningTarget.textContent = target.meaning;

    const chips = [
      { type: "prefix", text: "hyper-" },
      { type: "prefix", text: "hypo-" },
      { type: "prefix", text: "electro-" },
      { type: "root", text: "thyroid" },
      { type: "root", text: "gastroenter" },
      { type: "root", text: "cardio" },
      { type: "root", text: "glyc" },
      { type: "root", text: "hepato" },
      { type: "suffix", text: "-ism" },
      { type: "suffix", text: "-itis" },
      { type: "suffix", text: "-gram" },
      { type: "suffix", text: "-emia" },
      { type: "suffix", text: "-megaly" }
    ].sort(() => Math.random() - 0.5);

    elements.paletteChips.innerHTML = chips.map(c => `
      <button class="chip-btn ${c.type}" onclick="addChipToSlot('${c.type}', '${c.text}')" style="margin:4px; padding:6px 12px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); cursor:pointer; font-weight:600;">${c.text}</button>
    `).join('');
  }

  function resetBuilderSlots() {
    elements.slotPrefix.textContent = 'Tiền tố (Prefix)';
    elements.slotRoot.textContent = 'Gốc từ (Root)';
    elements.slotSuffix.textContent = 'Hậu tố (Suffix)';
    elements.assembledTerm.textContent = '—';
    state.builderSelected = { prefix: '', root: '', suffix: '' };
  }

  window.addChipToSlot = function(type, text) {
    if (type === 'prefix') {
      elements.slotPrefix.textContent = text;
      state.builderSelected.prefix = text;
    } else if (type === 'root') {
      elements.slotRoot.textContent = text;
      state.builderSelected.root = text;
    } else if (type === 'suffix') {
      elements.slotSuffix.textContent = text;
      state.builderSelected.suffix = text;
    }

    const assembled = (state.builderSelected.prefix + state.builderSelected.root + state.builderSelected.suffix)
      .replace(/-/g, '').toUpperCase();
    elements.assembledTerm.textContent = assembled || '—';
  };

  function checkBuilderAnswer() {
    if (!state.builderTarget) return;

    const userAssembled = (state.builderSelected.prefix + state.builderSelected.root + state.builderSelected.suffix)
      .replace(/-/g, '').toUpperCase();
    const targetClean = state.builderTarget.term.replace(/-/g, '').toUpperCase();

    if (userAssembled === targetClean) {
      alert(`🎉 CHÍNH XÁC! Bạn đã ghép đúng thuật ngữ: ${state.builderTarget.term}`);
      speakText(state.builderTarget.term);
      setTimeout(initBuilder, 1000);
    } else {
      alert(`❌ Chưa đúng! Bạn đã ghép: "${userAssembled}". Hãy thử lại!`);
    }
  }

  // --- DICTIONARY ---
  function renderDictionary() {
    const q = elements.dictSearchInput.value.toLowerCase().trim();
    const mod = state.currentModule;

    const filtered = state.terms.filter(t => {
      const mMod = mod === 'all' || t.module === mod;
      const mQ = !q || t.term.toLowerCase().includes(q) || t.vietnamese.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
      return mMod && mQ;
    });

    elements.dictResultsCount.textContent = filtered.length;
    elements.dictListContainer.innerHTML = '';

    if (filtered.length === 0) {
      elements.dictListContainer.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:2rem 0;">Không tìm thấy thuật ngữ phù hợp.</p>`;
      return;
    }

    filtered.slice(0, 90).forEach(item => {
      const card = document.createElement('div');
      card.className = 'dict-item-card';
      card.style.background = 'var(--bg-card)';
      card.style.border = '1px solid var(--border-color)';
      card.style.borderRadius = 'var(--radius-md)';
      card.style.padding = '1rem';
      card.style.marginBottom = '1rem';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="font-size:1.1rem; color:#fff; font-weight:800;">${escapeHtml(item.term)}</h4>
            ${item.phonetic ? `<div style="font-family:var(--font-mono); color:var(--accent-cyan); font-size:0.85rem;">${escapeHtml(item.phonetic)}</div>` : ''}
          </div>
          <button class="btn-sub" onclick="event.stopPropagation(); speakText('${escapeJs(item.term)}')"><i class="fa-solid fa-volume-high"></i></button>
        </div>
        <p style="color:var(--accent-green); font-weight:700; margin:0.4rem 0;">${escapeHtml(item.vietnamese || 'Thuật ngữ Y khoa')}</p>
        ${item.note ? `<p style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(item.note)}</p>` : ''}
      `;
      card.addEventListener('click', () => {
        switchView('ai-assistant');
        elements.aiSearchInput.value = item.term;
        performAiSearch();
      });
      elements.dictListContainer.appendChild(card);
    });
  }

  // --- AI DICTIONARY SCREENSHOT MATCHING ---
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
      const model = state.apiModel || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

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
      .replace(/1\. Meaning in Vietnamese \(Nghĩa tiếng Việt\)/g, '<div class="ai-section-title"><i class="fa-solid fa-language"></i> 1. Meaning in Vietnamese (Nghĩa tiếng Việt)</div>')
      .replace(/2\. Meaning in English/g, '<div class="ai-section-title"><i class="fa-solid fa-book"></i> 2. Meaning in English</div>')
      .replace(/3\. Clinical Example \(Ví dụ lâm sàng\)/g, '<div class="ai-section-title"><i class="fa-solid fa-stethoscope"></i> 3. Clinical Example (Ví dụ lâm sàng)</div>')
      .replace(/4\. Word Analysis & Related Medical Roots \(Phân tích từ vựng & Căn tố y khoa\)/g, '<div class="ai-section-title"><i class="fa-solid fa-dna"></i> 4. Word Analysis & Related Medical Roots (Phân tích từ vựng & Căn tố y khoa)</div>')
      .replace(/Good luck with your medical studies!/g, '<div class="ai-footer-note">Good luck with your medical studies!')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function renderAiCardFormat(q, localMatch, isError = false, errMsg = '') {
    const termTitle = localMatch ? localMatch.term : q;
    const phonetic = localMatch ? localMatch.phonetic : '/fee-meyl ree-pruh-duhk-tiv sis-tuh m/';
    const vi = localMatch ? localMatch.vietnamese : 'Hệ sinh sản nữ / Thuật ngữ Y khoa';
    const note = localMatch ? localMatch.note : 'Giải phẫu và sinh lý hệ thống cơ quan.';

    return `
      <div class="ai-result-content">
        ${isError ? `<div style="color:var(--accent-rose); margin-bottom:12px;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi Gemini API: ${escapeHtml(errMsg)}. Hiển thị dữ liệu local:</div>` : ''}
        <div class="ai-greeting">Hello! Here is the explanation of the medical term "${escapeHtml(termTitle)}" prepared for your studies.</div>
        
        <h2 class="ai-term-title">${escapeHtml(termTitle)}</h2>
        <div class="ai-phonetic">Phonetic: ${escapeHtml(phonetic)}</div>

        <div class="ai-section">
          <div class="ai-section-title"><i class="fa-solid fa-language"></i> 1. Meaning in Vietnamese (Nghĩa tiếng Việt)</div>
          <div class="ai-section-content">
            <p><strong style="color:var(--accent-green); font-size:1.1rem;">${escapeHtml(vi)}</strong></p>
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
          <p><i class="fa-solid fa-key"></i> Bấm biểu tượng chìa khóa ở góc trên để dán API Key & mở Gemini AI giải thích chuyên sâu!</p>
        </div>
      </div>
    `;
  }

  function speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  }

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
