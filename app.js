/* MedTerm AI Pro - Medical English Web Application
   Designed & Coded by Nhật Duy
*/

// Application State
const state = {
  terms: (typeof MEDICAL_DATA !== 'undefined' && MEDICAL_DATA.terms) ? MEDICAL_DATA.terms : [],
  modules: (typeof MEDICAL_DATA !== 'undefined' && MEDICAL_DATA.modules) ? MEDICAL_DATA.modules : [],
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
  selectedParts: [],
  showGameHints: localStorage.getItem('medterm_game_hints') !== 'false',
  // Quiz State
  quizMode: 'end_feedback', // 'end_feedback' or 'instant_feedback'
  quizQuestions: [],
  quizUserAnswers: {}, // { qIndex: 'A'/'B'/'C'/'D' }
  quizCurrentIndex: 0,
  quizTimerInterval: null,
  quizTimeLeft: 15 * 60, // 15 minutes in seconds
  quizSubmitted: false
};

// Global helper: Navigation tab switching
window.switchTab = function(tabId) {
  const navBtns = document.querySelectorAll('.nav-btn, .mobile-nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  tabContents.forEach(p => p.classList.toggle('active', p.id === tabId));
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Global helper: Audio pronunciation
window.playAudio = function(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
};

// Global helper: Open AI Dictionary with term
window.openAiTerm = function(term) {
  const input = document.getElementById('ai-search-input');
  if (input) input.value = term;
  window.switchTab('tab-ai-dict');
  if (window.performAiSearch) window.performAiSearch();
};

// Global helper: Close term detail modal
window.closeTermModal = function() {
  const modal = document.getElementById('modal-term-detail');
  if (modal) modal.classList.remove('active');
};

// --- SRS / ANKI FLASHCARD GLOBAL FUNCTIONS ---
window.initSrs = function() {
  const select = document.getElementById('srs-module-select');
  const mod = select ? select.value : 'all';
  state.srsQueue = state.terms.filter(t => mod === 'all' || t.module === mod);
  state.currentSrsIndex = 0;
  window.renderSrsCard();
};

window.renderSrsCard = function() {
  const wrapper = document.getElementById('flashcard-wrapper');
  if (!wrapper) return;

  if (!state.srsQueue || state.srsQueue.length === 0 || state.currentSrsIndex >= state.srsQueue.length) {
    const select = document.getElementById('srs-module-select');
    const currentModId = select ? select.value : 'all';
    const currentModObj = state.modules.find(m => m[0] === currentModId);
    const currentModName = currentModObj ? currentModObj[1] : 'Tất cả bài học';

    wrapper.innerHTML = `
      <div class="srs-complete-card">
        <div class="srs-complete-title">
          <i class="fa-solid fa-circle-check"></i> Hoàn thành bộ thẻ!
        </div>
        <div class="srs-complete-subtitle">
          Bạn đã học xong tất cả thẻ trong <strong>"${escapeHtml(currentModName)}"</strong>. Chọn bước tiếp theo:
        </div>

        <div class="srs-complete-actions">
          <button class="btn-primary" onclick="window.restartCurrentSrsChapter()">
            <i class="fa-solid fa-rotate-left"></i> Học lại chương này (${state.srsQueue.length} thẻ)
          </button>
          <button class="btn-secondary" onclick="window.startAllSrsChapters()">
            <i class="fa-solid fa-layer-group"></i> Học tất cả các chương (${state.terms.length} thẻ)
          </button>
        </div>

        <div class="srs-module-picker-heading">
          <i class="fa-solid fa-book"></i> Hoặc chọn học lại một chương bất kỳ:
        </div>

        <div class="srs-module-grid">
          ${state.modules.map(([id, name]) => {
            const cnt = state.terms.filter(t => t.module === id).length;
            return `
              <button class="srs-mod-btn" onclick="window.selectSrsChapter('${escapeJs(id)}')">
                <span>${escapeHtml(name)}</span>
                <span class="badge-cnt">${cnt} thẻ</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    return;
  }

  const item = state.srsQueue[state.currentSrsIndex];
  wrapper.innerHTML = `
    <div class="flashcard" id="srs-card-el">
      <div class="f-front">
        <span class="hero-tag">${escapeHtml(item.module_name)}</span>
        <h2 style="font-size:1.8rem; font-weight:800; margin:1rem 0;">${escapeHtml(item.term)}</h2>
        <button class="btn-icon" style="margin:0 auto;" onclick="event.stopPropagation(); window.playAudio('${escapeJs(item.term)}')">
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
  if (el) {
    el.addEventListener('click', () => {
      const f = el.querySelector('.f-front');
      const b = el.querySelector('.f-back');
      if (f && b) {
        if (f.style.display !== 'none') {
          f.style.display = 'none';
          b.style.display = 'block';
          el.classList.add('flipped');
        } else {
          f.style.display = 'block';
          b.style.display = 'none';
          el.classList.remove('flipped');
        }
      }
    });
  }
};

window.rateCard = function(score) {
  if (!state.srsQueue || state.srsQueue.length === 0 || state.currentSrsIndex >= state.srsQueue.length) return;
  const item = state.srsQueue[state.currentSrsIndex];
  const srs = state.srsData[item.id] || { level: 0 };

  if (score >= 3) srs.level = (srs.level || 0) + 1;
  else srs.level = Math.max(0, (srs.level || 0) - 1);

  state.srsData[item.id] = srs;
  localStorage.setItem('medterm_srs', JSON.stringify(state.srsData));

  state.currentSrsIndex++;
  if (window.renderStats) window.renderStats();
  window.renderSrsCard();
};

window.restartCurrentSrsChapter = function() {
  state.currentSrsIndex = 0;
  window.renderSrsCard();
};

window.startAllSrsChapters = function() {
  const select = document.getElementById('srs-module-select');
  if (select) select.value = 'all';
  window.initSrs();
};

window.selectSrsChapter = function(modId) {
  const select = document.getElementById('srs-module-select');
  if (select) select.value = modId;
  window.initSrs();
};

// --- ROOT MATCHING GAME GLOBAL FUNCTIONS ---
window.updateHintToggleButton = function() {
  const btn = document.getElementById('btn-toggle-hints');
  if (btn) {
    btn.innerHTML = state.showGameHints ? 
      '<i class="fa-solid fa-eye"></i> Bản dịch: <strong>Bật</strong>' : 
      '<i class="fa-solid fa-eye-slash"></i> Bản dịch: <strong>Tắt</strong>';
  }
};

window.toggleGameHints = function() {
  state.showGameHints = !state.showGameHints;
  localStorage.setItem('medterm_game_hints', state.showGameHints ? 'true' : 'false');
  window.updateHintToggleButton();
  if (state.currentMatchTarget) {
    window.renderGameStage();
  }
};

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
    },
    {
      term: "NEPHROLITHIASIS",
      vietnamese: "Bệnh sỏi thận",
      parts: [
        { type: "root", text: "nephro-", hint: "Dạng kết hợp: Thận" },
        { type: "root", text: "lith-", hint: "Gốc từ: Sỏi" },
        { type: "suffix", text: "-iasis", hint: "Hậu tố: Tình trạng bệnh" }
      ]
    },
    {
      term: "BRONCHOSPASM",
      vietnamese: "Co thắt phế quản",
      parts: [
        { type: "root", text: "broncho-", hint: "Dạng kết hợp: Phế quản" },
        { type: "suffix", text: "-spasm", hint: "Hậu tố: Co thắt" }
      ]
    }
  ];

  const target = structuredPool[Math.floor(Math.random() * structuredPool.length)];
  state.currentMatchTarget = target;

  window.renderGameStage();
};

window.renderGameStage = function() {
  const stage = document.getElementById('assembly-stage');
  if (!stage) return;
  const target = state.currentMatchTarget;
  if (!target) return;

  const shuffledParts = [...target.parts].sort(() => Math.random() - 0.5);

  stage.innerHTML = `
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
        <button class="part-card ${p.type}" onclick="window.selectPart(${idx}, '${escapeJs(p.text)}')">
          <span>${escapeHtml(p.text)}</span>
          ${state.showGameHints ? `<small style="font-size:0.7rem; opacity:0.85;">(${escapeHtml(p.hint)})</small>` : ''}
        </button>
      `).join('')}
    </div>

    <div style="display:flex; justify-content:center; gap:12px; margin-top:1.5rem; flex-wrap:wrap;">
      <button class="btn-primary" style="max-width:180px;" onclick="window.checkAssemblyAnswer()"><i class="fa-solid fa-check"></i> Kiểm tra</button>
      <button class="btn-secondary" style="max-width:180px;" onclick="window.startRootMatchGame()"><i class="fa-solid fa-rotate-left"></i> Đổi câu hỏi</button>
    </div>

    <div class="assembly-feedback" id="assembly-feedback"></div>
  `;
};

window.selectPart = function(idx, text) {
  state.selectedParts.push(text);
  const dropZone = document.getElementById('drop-zone');
  const placeholder = document.getElementById('drop-placeholder');
  if (placeholder) placeholder.remove();

  if (dropZone) {
    const card = document.createElement('div');
    card.className = 'part-card root';
    card.style.background = 'linear-gradient(135deg, #3b82f6, #06b6d4)';
    card.textContent = text;
    dropZone.appendChild(card);
  }
};

window.checkAssemblyAnswer = function() {
  const feedback = document.getElementById('assembly-feedback');
  if (!state.currentMatchTarget || !feedback) return;

  const assembled = state.selectedParts.join('').replace(/-/g, '').toUpperCase();
  const correctClean = state.currentMatchTarget.term.replace(/-/g, '').toUpperCase();

  if (assembled === correctClean) {
    state.gameScore += 10;
    state.gameCombo += 1;
    const scoreEl = document.getElementById('game-score');
    const comboEl = document.getElementById('game-combo');
    if (scoreEl) scoreEl.textContent = state.gameScore;
    if (comboEl) comboEl.textContent = state.gameCombo;

    feedback.style.color = 'var(--accent-emerald)';
    feedback.innerHTML = `🎉 CHÍNH XÁC! <strong>${state.currentMatchTarget.term}</strong> = ${escapeHtml(state.currentMatchTarget.vietnamese)}`;
    window.playAudio(state.currentMatchTarget.term);

    setTimeout(() => window.startRootMatchGame(), 2000);
  } else {
    state.gameCombo = 0;
    const comboEl = document.getElementById('game-combo');
    if (comboEl) comboEl.textContent = 0;

    feedback.style.color = 'var(--accent-rose)';
    feedback.innerHTML = `❌ Chưa đúng! Bạn đã ghép: "${assembled}". Hãy thử lại!`;
  }
};

// --- QUIZ EXAM GLOBAL FUNCTIONS ---
window.startNewQuizExam = function() {
  if (typeof QUIZ_DATA === 'undefined' || !QUIZ_DATA || QUIZ_DATA.length === 0) {
    alert('Không tìm thấy dữ liệu bộ đề trắc nghiệm.');
    return;
  }

  const shuffledPool = [...QUIZ_DATA].sort(() => Math.random() - 0.5);
  const selected30 = shuffledPool.slice(0, 30);

  state.quizQuestions = selected30.map((q, idx) => {
    const optionsCopy = [...q.options];
    const shuffledOpts = optionsCopy.sort(() => Math.random() - 0.5);
    return {
      ...q,
      quizIndex: idx + 1,
      shuffledOptions: shuffledOpts
    };
  });

  state.quizUserAnswers = {};
  state.quizCurrentIndex = 0;
  state.quizTimeLeft = 15 * 60; // 15 mins
  state.quizSubmitted = false;

  const startScr = document.getElementById('quiz-start-screen');
  const examScr = document.getElementById('quiz-exam-screen');
  const resScr = document.getElementById('quiz-result-screen');

  if (startScr) startScr.style.display = 'none';
  if (resScr) resScr.style.display = 'none';
  if (examScr) examScr.style.display = 'block';

  window.startQuizTimer();
  window.renderQuizQuestion();
};

window.startQuizTimer = function() {
  if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);

  state.quizTimerInterval = setInterval(() => {
    state.quizTimeLeft--;

    const timerEl = document.getElementById('quiz-timer-display');
    if (timerEl) {
      const mins = Math.floor(state.quizTimeLeft / 60);
      const secs = state.quizTimeLeft % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      timerEl.textContent = formatted;

      if (state.quizTimeLeft <= 180) {
        timerEl.parentElement.classList.add('urgent');
      } else {
        timerEl.parentElement.classList.remove('urgent');
      }
    }

    if (state.quizTimeLeft <= 0) {
      clearInterval(state.quizTimerInterval);
      alert('⏱️ Hết thời gian 15 phút! Hệ thống tự động nộp bài thi.');
      window.submitQuizExam();
    }
  }, 1000);
};

window.renderQuizQuestion = function() {
  const q = state.quizQuestions[state.quizCurrentIndex];
  if (!q) return;

  const userSelectedKey = state.quizUserAnswers[state.quizCurrentIndex];
  const isInstantMode = state.quizMode === 'instant_feedback';

  const examContainer = document.getElementById('quiz-active-question-card');
  if (!examContainer) return;
  
  examContainer.innerHTML = `
    <div class="quiz-top-bar">
      <div>
        <span><i class="fa-solid fa-list-check"></i> Câu ${state.quizCurrentIndex + 1} / 30</span>
      </div>
      <div class="quiz-timer">
        <i class="fa-solid fa-clock"></i> <span id="quiz-timer-display">15:00</span>
      </div>
      <div class="quiz-badge">
        ${isInstantMode ? '⚡ Biết kết quả ngay' : '🏁 Nộp bài mới biết điểm'}
      </div>
    </div>

    <div class="quiz-q-text">
      <strong>Câu ${state.quizCurrentIndex + 1}:</strong> ${escapeHtml(q.question)}
    </div>

    <div class="quiz-options">
      ${q.shuffledOptions.map((opt, optIdx) => {
        const keys = ['A', 'B', 'C', 'D'];
        const optLabelKey = keys[optIdx];
        const isSelected = userSelectedKey === opt.key;
        
        let btnClass = 'quiz-opt-btn';
        if (isSelected) btnClass += ' selected';

        if (isInstantMode && userSelectedKey) {
          if (opt.key === q.correctKey) {
            btnClass += ' correct';
          } else if (isSelected && userSelectedKey !== q.correctKey) {
            btnClass += ' wrong';
          }
        }

        return `
          <button class="${btnClass}" onclick="window.selectQuizAnswer(${state.quizCurrentIndex}, '${escapeJs(opt.key)}')">
            <span class="quiz-opt-key">${optLabelKey}</span>
            <span>${escapeHtml(opt.text)}</span>
          </button>
        `;
      }).join('')}
    </div>

    ${isInstantMode && userSelectedKey ? `
      <div class="quiz-explanation-box">
        <strong style="color:var(--accent-emerald);">
          ${userSelectedKey === q.correctKey ? '🎉 Đúng!' : '❌ Chưa đúng!'} Đáp án đúng là phương án chứa: "${escapeHtml(q.options.find(o=>o.key===q.correctKey).text)}"
        </strong>
        ${q.explanation ? `<p style="margin-top:6px; color:var(--text-secondary);">${escapeHtml(q.explanation)}</p>` : ''}
      </div>
    ` : ''}

    <div class="quiz-nav-bar">
      <button class="btn-secondary" onclick="window.prevQuizQuestion()" ${state.quizCurrentIndex === 0 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i> Câu trước
      </button>

      <button class="btn-primary" style="max-width:160px;" onclick="window.confirmSubmitQuiz()">
        <i class="fa-solid fa-paper-plane"></i> Nộp Bài
      </button>

      <button class="btn-secondary" onclick="window.nextQuizQuestion()" ${state.quizCurrentIndex === 29 ? 'disabled' : ''}>
        Câu sau <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <div class="quiz-palette">
      ${state.quizQuestions.map((item, idx) => {
        const isAns = state.quizUserAnswers.hasOwnProperty(idx);
        let pClass = 'quiz-num-btn';
        if (idx === state.quizCurrentIndex) pClass += ' current';
        if (isAns) pClass += ' answered';

        if (isInstantMode && isAns) {
          if (state.quizUserAnswers[idx] === item.correctKey) pClass += ' correct-num';
          else pClass += ' wrong-num';
        }

        return `<button class="${pClass}" onclick="window.jumpQuizQuestion(${idx})">${idx + 1}</button>`;
      }).join('')}
    </div>
  `;

  const mins = Math.floor(state.quizTimeLeft / 60);
  const secs = state.quizTimeLeft % 60;
  const timerDisplay = document.getElementById('quiz-timer-display');
  if (timerDisplay) {
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};

window.selectQuizAnswer = function(qIndex, key) {
  if (state.quizSubmitted) return;
  state.quizUserAnswers[qIndex] = key;
  window.renderQuizQuestion();
};

window.prevQuizQuestion = function() {
  if (state.quizCurrentIndex > 0) {
    state.quizCurrentIndex--;
    window.renderQuizQuestion();
  }
};

window.nextQuizQuestion = function() {
  if (state.quizCurrentIndex < 29) {
    state.quizCurrentIndex++;
    window.renderQuizQuestion();
  }
};

window.jumpQuizQuestion = function(idx) {
  state.quizCurrentIndex = idx;
  window.renderQuizQuestion();
};

window.confirmSubmitQuiz = function() {
  const answeredCount = Object.keys(state.quizUserAnswers).length;
  const unanswered = 30 - answeredCount;

  let msg = `Bạn đã làm ${answeredCount}/30 câu.`;
  if (unanswered > 0) {
    msg += ` Còn ${unanswered} câu chưa trả lời.`;
  }
  msg += '\nBạn có chắc chắn muốn nộp bài thi?';

  if (confirm(msg)) {
    window.submitQuizExam();
  }
};

window.submitQuizExam = function() {
  state.quizSubmitted = true;
  if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);

  let correctCount = 0;
  state.quizQuestions.forEach((q, idx) => {
    if (state.quizUserAnswers[idx] === q.correctKey) {
      correctCount++;
    }
  });

  const percent = ((correctCount / 30) * 100).toFixed(1);
  const timeSpentSecs = (15 * 60) - state.quizTimeLeft;
  const mins = Math.floor(timeSpentSecs / 60);
  const secs = timeSpentSecs % 60;
  const timeFormatted = `${mins} phút ${secs} giây`;

  const examScr = document.getElementById('quiz-exam-screen');
  const resScr = document.getElementById('quiz-result-screen');

  if (examScr) examScr.style.display = 'none';
  if (resScr) {
    resScr.style.display = 'block';

    let badgeText = '🎉 Mức độ: Xuất sắc!';
    if (percent < 50) badgeText = '💪 Mức độ: Cần cố gắng thêm!';
    else if (percent < 80) badgeText = '👍 Mức độ: Đạt Khá!';

    resScr.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-header">
          <h2><i class="fa-solid fa-square-poll-vertical"></i> Kết Quả Bài Thi Trắc Nghiệm</h2>
          <p>Dưới đây là điểm số và chi tiết đáp án câu đúng/câu sai của bạn.</p>
        </div>

        <div class="quiz-result-score">
          <div class="score-circle">
            <span class="big-val">${correctCount}/30</span>
            <span class="percent">${percent}%</span>
          </div>
          <h3 style="font-size:1.3rem; margin-bottom:0.4rem;">${badgeText}</h3>
          <p style="color:var(--text-secondary); font-size:0.9rem;">Thời gian làm bài: <strong>${timeFormatted}</strong></p>
        </div>

        <div style="display:flex; justify-content:center; gap:12px; margin:1.5rem 0 2rem 0; flex-wrap:wrap;">
          <button class="btn-primary" style="max-width:260px;" onclick="window.startNewQuizExam()">
            <i class="fa-solid fa-rotate-right"></i> Làm bài thi mới (30 câu ngẫu nhiên)
          </button>
          <button class="btn-secondary" style="max-width:200px;" onclick="window.resetQuizToStart()">
            <i class="fa-solid fa-house"></i> Về màn hình chính
          </button>
        </div>

        <div style="border-top:1px solid var(--border-color); padding-top:1.5rem;">
          <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">
            <i class="fa-solid fa-list-check"></i> Chi Tiết 30 Câu Hỏi Bài Thi:
          </h3>

          ${state.quizQuestions.map((q, idx) => {
            const uAnsKey = state.quizUserAnswers[idx];
            const isCorrect = uAnsKey === q.correctKey;
            const correctOptObj = q.options.find(o => o.key === q.correctKey);
            const userOptObj = q.options.find(o => o.key === uAnsKey);

            return `
              <div class="quiz-review-item ${isCorrect ? 'is-correct' : 'is-wrong'}">
                <div style="font-weight:700; font-size:1rem; margin-bottom:0.5rem; color:#fff;">
                  Câu ${idx + 1}: ${escapeHtml(q.question)}
                </div>

                <div style="font-size:0.9rem; margin-bottom:0.3rem;">
                  Lựa chọn của bạn: 
                  <strong style="color:${isCorrect ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
                    ${userOptObj ? escapeHtml(userOptObj.text) : '(Bỏ trống)'}
                  </strong>
                </div>

                ${!isCorrect ? `
                  <div style="font-size:0.9rem; color:var(--accent-emerald); margin-bottom:0.3rem;">
                    Đáp án đúng: <strong>${escapeHtml(correctOptObj ? correctOptObj.text : '')}</strong>
                  </div>
                ` : ''}

                ${q.explanation ? `
                  <div style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.4rem; background:rgba(0,0,0,0.2); padding:0.5rem 0.8rem; border-radius:var(--radius-sm);">
                    <i class="fa-solid fa-lightbulb"></i> Giải thích: ${escapeHtml(q.explanation)}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
};

window.resetQuizToStart = function() {
  if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);
  const startScr = document.getElementById('quiz-start-screen');
  const examScr = document.getElementById('quiz-exam-screen');
  const resScr = document.getElementById('quiz-result-screen');

  if (examScr) examScr.style.display = 'none';
  if (resScr) resScr.style.display = 'none';
  if (startScr) startScr.style.display = 'block';
};

// --- AI DICTIONARY GLOBAL FUNCTIONS ---
window.performAiSearch = async function() {
  const input = document.getElementById('ai-search-input');
  const responseBox = document.getElementById('ai-dict-response');
  if (!input || !responseBox) return;

  const q = input.value.trim();
  if (!q) return;

  responseBox.innerHTML = `
    <div style="text-align:center; padding:30px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:var(--accent-cyan); margin-bottom:12px;"></i>
      <p style="color:var(--text-secondary);">Đang gửi truy vấn tới Gemini AI (${escapeHtml(state.apiModel)})...</p>
    </div>
  `;

  const localMatch = state.terms.find(t => t.term.toLowerCase() === q.toLowerCase());

  if (!state.apiKey) {
    responseBox.innerHTML = renderAiCardFormat(q, localMatch, false);
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
      responseBox.innerHTML = `<div class="ai-result-content">${formatMarkdownText(text)}</div>`;
    } else {
      throw new Error('Lỗi dữ liệu từ Gemini.');
    }
  } catch (err) {
    responseBox.innerHTML = renderAiCardFormat(q, localMatch, true, err.message);
  }
};

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
    .replace(/
/g, '<br>');
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

window.openTermModal = function(item) {
  const mTitle = document.getElementById('m-term-title');
  const mBody = document.getElementById('m-term-body');
  const modal = document.getElementById('modal-term-detail');

  if (mTitle) mTitle.textContent = item.term;
  if (mBody) {
    mBody.innerHTML = `
      <div style="margin-bottom:12px;">
        ${item.phonetic ? `<p style="font-family:var(--font-mono); color:var(--accent-cyan);">Phiên âm: ${escapeHtml(item.phonetic)}</p>` : ''}
        <h4 style="font-size:1.2rem; color:var(--accent-emerald); margin-top:4px;">${escapeHtml(item.vietnamese)}</h4>
      </div>
      ${item.note ? `<p style="color:var(--text-secondary); margin-bottom:16px;">${escapeHtml(item.note)}</p>` : ''}
      <div style="display:flex; gap:10px;">
        <button class="btn-primary" onclick="window.playAudio('${escapeJs(item.term)}')"><i class="fa-solid fa-volume-high"></i> Phát âm</button>
        <button class="btn-secondary" onclick="window.closeTermModal(); window.openAiTerm('${escapeJs(item.term)}');"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Tra cứu</button>
      </div>
    `;
  }
  if (modal) modal.classList.add('active');
};

window.renderStats = function() {
  const statTotal = document.getElementById('stat-total');
  const statMastered = document.getElementById('stat-mastered');
  const statLearning = document.getElementById('stat-learning');
  const statStreak = document.getElementById('stat-streak');

  if (statTotal) statTotal.textContent = state.terms.length.toLocaleString();

  let mastered = 0;
  let learning = 0;

  Object.values(state.srsData).forEach(s => {
    if (s.level >= 4) mastered++;
    else if (s.level > 0) learning++;
  });

  if (statMastered) statMastered.textContent = mastered;
  if (statLearning) statLearning.textContent = learning;
  if (statStreak) statStreak.textContent = `${state.streak} Ngày`;
};

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(s) {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// MAIN INITIALIZATION ON DOM LOADED
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const elements = {
    navBtns: document.querySelectorAll('.nav-btn, .mobile-nav-btn'),
    moduleGrid: document.getElementById('module-grid'),
    dictSearchInput: document.getElementById('dict-search-input'),
    dictModuleFilter: document.getElementById('dict-module-filter'),
    dictList: document.getElementById('dict-list'),
    searchCount: document.getElementById('search-count'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    btnToggleHints: document.getElementById('btn-toggle-hints'),
    btnAiSearch: document.getElementById('btn-ai-search'),
    aiSearchInput: document.getElementById('ai-search-input'),
    btnStartQuiz: document.getElementById('btn-start-quiz'),
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
    btnCloseTermModal: document.getElementById('btn-close-term-modal'),
    modalTermDetail: document.getElementById('modal-term-detail'),
    themeToggle: document.getElementById('theme-toggle'),
    srsModuleSelect: document.getElementById('srs-module-select')
  };

  function updateApiStatus() {
    if (elements.apiStatusDot) {
      elements.apiStatusDot.classList.toggle('active', !!state.apiKey);
    }
  }

  function populateSelects() {
    if (elements.dictModuleFilter) {
      elements.dictModuleFilter.innerHTML = '<option value="all">-- Tất cả hệ cơ quan & chuyên đề --</option>';
    }
    if (elements.srsModuleSelect) {
      elements.srsModuleSelect.innerHTML = '<option value="all">Tất cả bài học</option>';
    }

    state.modules.forEach(([id, name]) => {
      const opt = `<option value="${id}">${name}</option>`;
      if (elements.dictModuleFilter) elements.dictModuleFilter.insertAdjacentHTML('beforeend', opt);
      if (elements.srsModuleSelect) elements.srsModuleSelect.insertAdjacentHTML('beforeend', opt);
    });
  }

  function renderModules() {
    if (!elements.moduleGrid) return;
    elements.moduleGrid.innerHTML = '';
    const icons = {
      cau_tao: 'fa-cubes', goc_tu: 'fa-tree', nguon_goc: 'fa-monument',
      dang_ket_hop: 'fa-link', hau_to: 'fa-tag', tien_to: 'fa-tags',
      phien_am: 'fa-volume-high', tong_quan: 'fa-child', tim_mach: 'fa-heart-pulse',
      ho_hap: 'fa-lungs', tieu_hoa: 'fa-apple-whole', than_kinh: 'fa-brain', sinh_san_nu: 'fa-venus',
      izone_suc_khoe: 'fa-heart-pulse', izone_benh_ly: 'fa-virus', izone_chuyen_khoa: 'fa-user-doctor',
      izone_benh_vien: 'fa-hospital', izone_thuoc_thiet_bi: 'fa-pills', izone_viet_tat_thu_y: 'fa-stethoscope'
    };

    state.modules.forEach(([id, name]) => {
      const count = state.terms.filter(t => t.module === id).length;
      const icon = icons[id] || 'fa-notes-medical';

      const card = document.createElement('div');
      card.className = 'module-card';
      card.innerHTML = `
        <div class="module-card-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="module-card-info">
          <h4>${escapeHtml(name)}</h4>
          <span>${count} Thuật ngữ & Dữ liệu</span>
        </div>
      `;
      card.addEventListener('click', () => {
        if (elements.dictModuleFilter) elements.dictModuleFilter.value = id;
        window.switchTab('tab-dictionary');
        renderDictionary();
      });
      elements.moduleGrid.appendChild(card);
    });
  }

  function renderDictionary() {
    if (!elements.dictList) return;
    const q = elements.dictSearchInput ? elements.dictSearchInput.value.toLowerCase().trim() : '';
    const mod = elements.dictModuleFilter ? elements.dictModuleFilter.value : 'all';

    const filtered = state.terms.filter(t => {
      const mMod = mod === 'all' || t.module === mod;
      const mQ = !q || t.term.toLowerCase().includes(q) || t.vietnamese.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
      return mMod && mQ;
    });

    if (elements.searchCount) elements.searchCount.textContent = filtered.length;
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
            <button class="btn-sub" style="padding:2px 8px;" onclick="event.stopPropagation(); window.playAudio('${escapeJs(item.term)}')">
              <i class="fa-solid fa-volume-high"></i>
            </button>
          </div>
          ${item.phonetic ? `<div class="term-card-phonetic">${escapeHtml(item.phonetic)}</div>` : ''}
          <div class="term-card-meaning">${escapeHtml(item.vietnamese || 'Y khoa')}</div>
          ${item.note ? `<div class="term-card-note">${escapeHtml(item.note)}</div>` : ''}
        </div>
        <div class="term-card-footer">
          <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(item.module_name)}</span>
          <button class="btn-sm-ai" onclick="event.stopPropagation(); window.openAiTerm('${escapeJs(item.term)}')">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI Tra cứu
          </button>
        </div>
      `;
      card.addEventListener('click', () => window.openTermModal(item));
      elements.dictList.appendChild(card);
    });
  }

  function showApiMsg(msg, type) {
    if (!elements.apiKeyMsg) return;
    elements.apiKeyMsg.textContent = msg;
    elements.apiKeyMsg.style.display = 'block';
    elements.apiKeyMsg.style.color = type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)';
  }

  // EVENT LISTENERS SETUP
  if (elements.navBtns) {
    elements.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        window.switchTab(tab);
      });
    });
  }

  if (elements.themeToggle) {
    elements.themeToggle.addEventListener('click', () => {
      const curr = document.documentElement.getAttribute('data-theme');
      const next = curr === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
    });
  }

  if (elements.dictSearchInput) {
    elements.dictSearchInput.addEventListener('input', (e) => {
      if (elements.btnClearSearch) elements.btnClearSearch.style.display = e.target.value.trim() ? 'block' : 'none';
      renderDictionary();
    });
  }

  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener('click', () => {
      if (elements.dictSearchInput) elements.dictSearchInput.value = '';
      elements.btnClearSearch.style.display = 'none';
      renderDictionary();
    });
  }

  if (elements.dictModuleFilter) {
    elements.dictModuleFilter.addEventListener('change', renderDictionary);
  }

  if (elements.srsModuleSelect) {
    elements.srsModuleSelect.addEventListener('change', window.initSrs);
  }

  if (elements.btnToggleHints) {
    elements.btnToggleHints.addEventListener('click', window.toggleGameHints);
  }

  if (elements.btnAiSearch) {
    elements.btnAiSearch.addEventListener('click', window.performAiSearch);
  }

  if (elements.aiSearchInput) {
    elements.aiSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') window.performAiSearch();
    });
  }

  document.querySelectorAll('.quiz-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.quiz-mode-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.quizMode = card.dataset.mode;
    });
  });

  if (elements.btnStartQuiz) {
    elements.btnStartQuiz.addEventListener('click', window.startNewQuizExam);
  }

  if (elements.btnApiModal) {
    elements.btnApiModal.addEventListener('click', () => {
      if (elements.inputApiKey) elements.inputApiKey.value = state.apiKey;
      if (elements.inputModelName) elements.inputModelName.value = state.apiModel || 'gemini-2.5-flash';
      if (elements.modalApiConfig) elements.modalApiConfig.classList.add('active');
    });
  }

  if (elements.btnCloseApiModal) {
    elements.btnCloseApiModal.addEventListener('click', () => {
      if (elements.modalApiConfig) elements.modalApiConfig.classList.remove('active');
    });
  }

  if (elements.btnToggleKeyVis) {
    elements.btnToggleKeyVis.addEventListener('click', () => {
      if (!elements.inputApiKey) return;
      const isPass = elements.inputApiKey.type === 'password';
      elements.inputApiKey.type = isPass ? 'text' : 'password';
      elements.btnToggleKeyVis.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  }

  if (elements.btnPasteApiKey) {
    elements.btnPasteApiKey.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const clip = await navigator.clipboard.readText();
          if (clip && elements.inputApiKey) {
            elements.inputApiKey.value = clip.trim();
            showApiMsg('Đã dán API Key từ Clipboard!', 'success');
          }
        } else {
          const manual = prompt('Dán Gemini API Key của bạn:');
          if (manual && elements.inputApiKey) elements.inputApiKey.value = manual.trim();
        }
      } catch (err) {
        const manual = prompt('Dán Gemini API Key của bạn:');
        if (manual && elements.inputApiKey) elements.inputApiKey.value = manual.trim();
      }
    });
  }

  if (elements.btnSaveApiKey) {
    elements.btnSaveApiKey.addEventListener('click', () => {
      const key = elements.inputApiKey ? elements.inputApiKey.value.trim() : '';
      const model = elements.inputModelName ? (elements.inputModelName.value.trim() || 'gemini-2.5-flash') : 'gemini-2.5-flash';

      state.apiKey = key;
      state.apiModel = model;
      localStorage.setItem('medterm_api_key', key);
      localStorage.setItem('medterm_api_model', model);

      updateApiStatus();
      showApiMsg('Đã lưu API Key & Model thành công!', 'success');
      setTimeout(() => {
        if (elements.modalApiConfig) elements.modalApiConfig.classList.remove('active');
      }, 1200);
    });
  }

  if (elements.btnClearApiKey) {
    elements.btnClearApiKey.addEventListener('click', () => {
      state.apiKey = '';
      localStorage.removeItem('medterm_api_key');
      if (elements.inputApiKey) elements.inputApiKey.value = '';
      updateApiStatus();
      showApiMsg('Đã xóa API Key.', 'error');
    });
  }

  if (elements.btnCloseTermModal) {
    elements.btnCloseTermModal.addEventListener('click', window.closeTermModal);
  }

  // INITIAL RENDER
  updateApiStatus();
  populateSelects();
  renderModules();
  renderDictionary();
  window.renderStats();
  window.initSrs();
  window.updateHintToggleButton();
  window.startRootMatchGame();
});
