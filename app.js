/* Medical English Learning Web Application Logic & SRS Engine */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  let currentModule = 'ALL';
  let srsProgress = loadSRSProgress();
  let currentCardIndex = 0;
  let srsQueue = [];
  let currentQuiz = null;
  let speechRecognition = None;

  // Initialize UI
  initTheme();
  initNavigation();
  updateDashboardStats();
  renderModuleGrid();
  prepareSRSQueue();
  renderCurrentFlashcard();
  renderDictionaryList();
  initSearchAndAI();
  initQuiz();
  initSpeechRecognition();

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem('med_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
      themeBtn.addEventListener('click', () => {
        const active = document.documentElement.getAttribute('data-theme');
        const next = active === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('med_theme', next);
        themeBtn.innerHTML = next === 'dark' ? '☀️' : '🌙';
      });
    }
  }

  // --- Navigation & Tab Switching ---
  function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(target).classList.add('active');

        if (target === 'tab-flashcards') {
          prepareSRSQueue();
          renderCurrentFlashcard();
        } else if (target === 'tab-quiz') {
          startNewQuiz();
        } else if (target === 'tab-dictionary') {
          renderDictionaryList();
        }
      });
    });
  }

  // --- SRS / Anki Storage Logic ---
  function loadSRSProgress() {
    const data = localStorage.getItem('med_srs_progress');
    return data ? JSON.parse(data) : {};
  }

  function saveSRSProgress() {
    localStorage.setItem('med_srs_progress', JSON.stringify(srsProgress));
    updateDashboardStats();
    renderModuleGrid();
  }

  function getTermSRS(termId) {
    return srsProgress[termId] || {
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      dueDate: Date.now(),
      status: 'new' // 'new', 'learning', 'mastered'
    };
  }

  // SM-2 Spaced Repetition Rating (1: Again, 2: Hard, 3: Good, 4: Easy)
  function rateCard(termId, rating) {
    let card = getTermSRS(termId);
    let q = rating; // rating from 1 to 4 mapped to SM-2 quality 2 to 5

    if (rating === 1) { // Again
      card.repetition = 0;
      card.interval = 1;
      card.status = 'learning';
    } else {
      if (card.repetition === 0) {
        card.interval = 1;
      } else if (card.repetition === 1) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.easeFactor);
      }
      card.repetition += 1;
      card.status = card.repetition >= 3 ? 'mastered' : 'learning';
    }

    // Ease Factor calculation: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const quality = rating + 1; // 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 5
    card.easeFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (card.easeFactor < 1.3) card.easeFactor = 1.3;

    card.dueDate = Date.now() + card.interval * 24 * 60 * 60 * 1000;
    card.lastReviewed = Date.now();

    srsProgress[termId] = card;
    saveSRSProgress();

    // Next Card
    currentCardIndex++;
    if (currentCardIndex >= srsQueue.length) {
      prepareSRSQueue();
      currentCardIndex = 0;
    }
    renderCurrentFlashcard();
  }

  // --- Queue Preparation ---
  function prepareSRSQueue() {
    const filtered = currentModule === 'ALL' 
      ? MEDICAL_DATA 
      : MEDICAL_DATA.filter(t => t.module === currentModule);

    const now = Date.now();
    // Prioritize due cards or new cards
    srsQueue = [...filtered].sort((a, b) => {
      const srsA = getTermSRS(a.id);
      const srsB = getTermSRS(b.id);
      return srsA.dueDate - srsB.dueDate;
    });

    if (srsQueue.length === 0) srsQueue = MEDICAL_DATA;
  }

  // --- Flashcard Rendering ---
  function renderCurrentFlashcard() {
    const cardContainer = document.getElementById('flashcard-wrapper');
    if (!cardContainer || srsQueue.length === 0) return;

    const termData = srsQueue[currentCardIndex % srsQueue.length];
    const srsState = getTermSRS(termData.id);

    cardContainer.innerHTML = `
      <div class="flashcard" id="active-card">
        <div class="card-face card-front">
          <div class="card-header-badge">${termData.module} • ${srsState.status.toUpperCase()}</div>
          <div class="card-body">
            <div class="card-term">${escapeHtml(termData.term)}</div>
            ${termData.phonetic ? `
              <div class="card-phonetic">
                ${escapeHtml(termData.phonetic)}
                <button class="audio-btn" onclick="event.stopPropagation(); playSpeech('${escapeJs(termData.term)}')">🔊</button>
              </div>
            ` : `
              <button class="audio-btn" style="margin:0 auto;" onclick="event.stopPropagation(); playSpeech('${escapeJs(termData.term)}')">🔊 Phát âm</button>
            `}
          </div>
          <div class="card-footer-tip">💡 Chạm để lật thẻ xem nghĩa & phân tích</div>
        </div>

        <div class="card-face card-back">
          <div class="card-header-badge" style="color: var(--accent-emerald); background: rgba(16,185,129,0.1);">NGHĨA & PHÂN TÍCH</div>
          <div class="card-body">
            <div class="card-vietnamese">${escapeHtml(termData.vietnamese)}</div>
            ${termData.notes ? `<div class="card-notes">${escapeHtml(termData.notes)}</div>` : ''}
          </div>
          <div class="card-footer-tip">Đánh giá mức độ ghi nhớ của bạn bên dưới:</div>
        </div>
      </div>
    `;

    const card = document.getElementById('active-card');
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });

    // Update Counter
    const queueCounter = document.getElementById('srs-queue-counter');
    if (queueCounter) {
      queueCounter.innerText = `Thẻ ${currentCardIndex + 1} / ${srsQueue.length}`;
    }
  }

  // Bind SRS Rating Buttons
  document.getElementById('rate-again')?.addEventListener('click', () => {
    if (srsQueue[currentCardIndex]) rateCard(srsQueue[currentCardIndex].id, 1);
  });
  document.getElementById('rate-hard')?.addEventListener('click', () => {
    if (srsQueue[currentCardIndex]) rateCard(srsQueue[currentCardIndex].id, 2);
  });
  document.getElementById('rate-good')?.addEventListener('click', () => {
    if (srsQueue[currentCardIndex]) rateCard(srsQueue[currentCardIndex].id, 3);
  });
  document.getElementById('rate-easy')?.addEventListener('click', () => {
    if (srsQueue[currentCardIndex]) rateCard(srsQueue[currentCardIndex].id, 4);
  });

  // --- Dashboard Stats & Modules ---
  function updateDashboardStats() {
    const totalCount = MEDICAL_DATA.length;
    let masteredCount = 0;
    let learningCount = 0;

    Object.values(srsProgress).forEach(item => {
      if (item.status === 'mastered') masteredCount++;
      else if (item.status === 'learning') learningCount++;
    });

    const newCount = totalCount - masteredCount - learningCount;
    const overallPercent = Math.round((masteredCount / totalCount) * 100) || 0;

    document.getElementById('stat-total').innerText = totalCount;
    document.getElementById('stat-mastered').innerText = masteredCount;
    document.getElementById('stat-learning').innerText = learningCount;
    document.getElementById('stat-percent').innerText = `${overallPercent}%`;
  }

  function renderModuleGrid() {
    const grid = document.getElementById('module-grid');
    if (!grid) return;

    // Group terms by module
    const modulesMap = {};
    MEDICAL_DATA.forEach(t => {
      if (!modulesMap[t.module]) modulesMap[t.module] = [];
      modulesMap[t.module].push(t);
    });

    let html = `
      <div class="module-card ${currentModule === 'ALL' ? 'selected' : ''}" data-mod="ALL">
        <div class="module-header">
          <div class="module-name">🌟 Tất cả các bài học (Full Data)</div>
          <div class="module-count">${MEDICAL_DATA.length} từ</div>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 100%"></div></div>
      </div>
    `;

    Object.keys(modulesMap).forEach(modName => {
      const list = modulesMap[modName];
      let modMastered = 0;
      list.forEach(item => {
        if (srsProgress[item.id] && srsProgress[item.id].status === 'mastered') modMastered++;
      });
      const pct = Math.round((modMastered / list.length) * 100) || 0;

      html += `
        <div class="module-card ${currentModule === modName ? 'selected' : ''}" data-mod="${escapeHtml(modName)}">
          <div class="module-header">
            <div class="module-name">${escapeHtml(modName)}</div>
            <div class="module-count">${list.length} từ</div>
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Đã thuộc: ${modMastered}/${list.length} (${pct}%)</div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%"></div></div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Add click listeners
    grid.querySelectorAll('.module-card').forEach(card => {
      card.addEventListener('click', () => {
        currentModule = card.dataset.mod;
        renderModuleGrid();
        prepareSRSQueue();
        currentCardIndex = 0;
        renderCurrentFlashcard();
      });
    });
  }

  // --- Dictionary & AI Search Engine ---
  function renderDictionaryList(filterQuery = '') {
    const container = document.getElementById('dict-list');
    if (!container) return;

    let filtered = MEDICAL_DATA;
    if (currentModule !== 'ALL') {
      filtered = filtered.filter(t => t.module === currentModule);
    }

    if (filterQuery.trim() !== '') {
      const q = filterQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.term.toLowerCase().includes(q) || 
        t.vietnamese.toLowerCase().includes(q) || 
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-muted);">Không tìm thấy thuật ngữ phù hợp với "${escapeHtml(filterQuery)}"</div>`;
      return;
    }

    container.innerHTML = filtered.slice(0, 100).map(item => `
      <div class="dict-card">
        <div class="dict-term">
          <span>${escapeHtml(item.term)}</span>
          <button class="audio-btn" onclick="playSpeech('${escapeJs(item.term)}')">🔊</button>
        </div>
        ${item.phonetic ? `<div class="dict-phonetic">${escapeHtml(item.phonetic)}</div>` : ''}
        <div class="dict-viet">👉 ${escapeHtml(item.vietnamese)}</div>
        ${item.notes ? `<div class="dict-notes">💡 ${escapeHtml(item.notes)}</div>` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:auto;">📚 ${escapeHtml(item.module)}</div>
      </div>
    `).join('');
  }

  function initSearchAndAI() {
    const input = document.getElementById('dict-search-input');
    const aiOutput = document.getElementById('ai-assistant-output');

    if (input) {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        renderDictionaryList(val);
        generateAIExplanation(val, aiOutput);
      });
    }
  }

  // Smart Offline AI Medical Terminology Explainer
  function generateAIExplanation(query, outputEl) {
    if (!outputEl) return;
    if (!query || query.trim().length < 2) {
      outputEl.innerHTML = `🤖 <b>Trợ lý AI Y Khoa:</b> Nhập thuật ngữ, tiền tố, hậu tố hoặc câu hỏi (ví dụ: <i>hyperthyroidism, gastroenteritis, viêm phổi, gốc từ dạ dày</i>) để nhận phân tích tự động.`;
      return;
    }

    const q = query.toLowerCase().trim();
    // Search matching terms
    const matches = MEDICAL_DATA.filter(t => 
      t.term.toLowerCase().includes(q) || 
      t.vietnamese.toLowerCase().includes(q)
    );

    let analysis = `🤖 <b>Phân tích AI cho từ khóa "${escapeHtml(query)}":</b><br>`;

    if (matches.length > 0) {
      const top = matches[0];
      analysis += `<b>1. Thuật ngữ chuẩn:</b> <span style="color:var(--accent-cyan); font-weight:700;">${escapeHtml(top.term)}</span> (${escapeHtml(top.phonetic || 'Chưa có phiên âm')}) = <b>${escapeHtml(top.vietnamese)}</b><br>`;
      
      // Deconstruct structure if hyphenated or known roots
      if (top.notes) {
        analysis += `<b>2. Phân tích cấu trúc & Ngữ cảnh:</b> ${escapeHtml(top.notes)}<br>`;
      }
      
      // Greek vs Latin Root Insight
      if (q.includes('gast') || q.includes('stomat') || q.includes('hepat') || q.includes('cardi') || q.includes('nephr')) {
        analysis += `<b>3. Lời khuyên Y khoa:</b> Các gốc từ bắt đầu bằng tiếng Hy Lạp thường chỉ <i>bệnh học & triệu chứng</i> (ví dụ: gastritis, stomatitis), còn gốc La-tinh chỉ <i>giải phẫu & vị trí</i>.<br>`;
      }

      analysis += `<i>Tìm thấy ${matches.length} thuật ngữ liên quan trong hệ thống.</i>`;
    } else {
      analysis += `Không tìm thấy thuật ngữ khớp tuyệt đối. Vui lòng thử tìm kiếm bằng các tiền tố (hyper-, hypo-, dys-) hoặc gốc từ (cardi-, gastr-, nephr-).`;
    }

    outputEl.innerHTML = analysis;
  }

  // --- Quiz Mode ---
  function initQuiz() {
    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', startNewQuiz);
    }
  }

  function startNewQuiz() {
    const quizCard = document.getElementById('quiz-card');
    if (!quizCard) return;

    let pool = currentModule === 'ALL' ? MEDICAL_DATA : MEDICAL_DATA.filter(t => t.module === currentModule);
    if (pool.length < 4) pool = MEDICAL_DATA;

    // Pick random target term
    const target = pool[Math.floor(Math.random() * pool.length)];

    // Pick 3 distractors
    const distractors = [];
    while (distractors.length < 3) {
      const randomItem = MEDICAL_DATA[Math.floor(Math.random() * MEDICAL_DATA.length)];
      if (randomItem.id !== target.id && !distractors.includes(randomItem)) {
        distractors.push(randomItem);
      }
    }

    const options = [target, ...distractors].sort(() => Math.random() - 0.5);

    quizCard.innerHTML = `
      <div class="quiz-header">
        <div style="font-weight:700; color:var(--accent-cyan);">BÀI TẬP TRẮC NGHIỆM INTERACTIVE</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(target.module)}</div>
      </div>
      <div class="quiz-question">
        Thuật ngữ Y khoa nào mang nghĩa: <br>
        <span style="color:var(--accent-emerald); font-size:1.5rem; font-weight:800;">"${escapeHtml(target.vietnamese)}"</span>?
      </div>
      <div class="options-grid">
        ${options.map((opt, idx) => `
          <button class="option-btn" data-id="${opt.id}" onclick="checkQuizAnswer(this, '${opt.id}', '${target.id}')">
            <span><b>${String.fromCharCode(65 + idx)}.</b> ${escapeHtml(opt.term)} ${opt.phonetic ? `<small style="color:var(--text-muted)">(${escapeHtml(opt.phonetic)})</small>` : ''}</span>
          </button>
        `).join('')}
      </div>
      <div id="quiz-feedback" style="margin-top: 1rem; font-weight: 700;"></div>
    `;
  }

  window.checkQuizAnswer = function(btn, selectedId, correctId) {
    const grid = btn.parentElement;
    const buttons = grid.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);

    const feedback = document.getElementById('quiz-feedback');

    if (selectedId === correctId) {
      btn.classList.add('correct');
      feedback.style.color = 'var(--accent-emerald)';
      feedback.innerHTML = '🎉 Chính xác! Bạn đã chọn đúng thuật ngữ.';
      rateCard(correctId, 3); // Record good SRS
    } else {
      btn.classList.add('incorrect');
      buttons.forEach(b => {
        if (b.dataset.id === correctId) b.classList.add('correct');
      });
      feedback.style.color = 'var(--accent-rose)';
      feedback.innerHTML = '❌ Chưa đúng! Hãy xem đáp án chính xác được đánh dấu xanh.';
      rateCard(correctId, 1); // Record again SRS
    }
  };

  // --- Audio / Text-To-Speech ---
  window.playSpeech = function(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85; // slightly slower for clear medical pronunciation
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Trình duyệt của bạn không hỗ trợ phát âm tự động.');
    }
  };

  // --- Speech Recognition Practice ---
  function initSpeechRecognition() {
    const micBtn = document.getElementById('mic-practice-btn');
    const speechResult = document.getElementById('speech-result');

    if (!micBtn) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      speechRecognition = new SpeechRec();
      speechRecognition.lang = 'en-US';
      speechRecognition.interimResults = false;

      micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('recording')) {
          speechRecognition.stop();
          micBtn.classList.remove('recording');
        } else {
          speechRecognition.start();
          micBtn.classList.add('recording');
          if (speechResult) speechResult.innerText = '🎙️ Đang lắng nghe... Hãy đọc thuật ngữ tiếng Anh!';
        }
      });

      speechRecognition.onresult = (event) => {
        micBtn.classList.remove('recording');
        const transcript = event.results[0][0].transcript;
        if (speechResult) {
          speechResult.innerHTML = `🗣️ Bạn đã đọc: "<b>${escapeHtml(transcript)}</b>"`;
        }
      };

      speechRecognition.onerror = () => {
        micBtn.classList.remove('recording');
        if (speechResult) speechResult.innerText = '⚠️ Không nhận diện được âm thanh. Thử lại nhé!';
      };
    } else {
      if (micBtn) micBtn.style.display = 'none';
    }
  }

  // Helper Functions
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
  }
});
