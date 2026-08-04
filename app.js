/* ==========================================================================
   MedTerm AI Pro - JavaScript Application Engine & ANKI SRS Logic
   Designed & Coded by Nhật Duy
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let state = {
        currentView: 'dashboard',
        selectedModule: 'all',
        srsData: JSON.parse(localStorage.getItem('medterm_srs')) || {},
        quizScore: { correct: 0, total: 0 },
        streak: parseInt(localStorage.getItem('medterm_streak')) || 1,
        apiKey: localStorage.getItem('gemini_api_key') || localStorage.getItem('medterm_api_key') || '',
        apiModel: localStorage.getItem('gemini_api_model') || localStorage.getItem('medterm_api_model') || 'gemini-2.5-flash',
        currentAnkiIndex: 0,
        dueCardIds: [],
        currentQuizQuestion: null,
        builderTarget: null,
        assembledSlots: { prefix: '', root: '', suffix: '' }
    };

    // --- DOM Elements ---
    const elements = {
        navItems: document.querySelectorAll('.nav-item, .mobile-nav-item'),
        views: document.querySelectorAll('.app-view'),
        moduleSelect: document.getElementById('global-module-select'),
        dueCountBadge: document.getElementById('due-count-badge'),
        bannerDueCount: document.getElementById('banner-due-count'),
        streakCounter: document.getElementById('streak-counter'),
        apiKeyStatusText: document.getElementById('api-key-status-text'),
        
        // Stats
        statTotalTerms: document.getElementById('stat-total-terms'),
        statDueToday: document.getElementById('stat-due-today'),
        statMastered: document.getElementById('stat-mastered'),
        statAccuracy: document.getElementById('stat-accuracy'),
        modulesProgressContainer: document.getElementById('modules-progress-container'),
        
        // ANKI SRS
        ankiRemainingCount: document.getElementById('anki-remaining-count'),
        mainFlashcard: document.getElementById('main-flashcard'),
        cardModuleTitle: document.getElementById('card-module-title'),
        cardTermText: document.getElementById('card-term-text'),
        cardPhoneticText: document.getElementById('card-phonetic-text'),
        cardSpeakBtn: document.getElementById('card-speak-btn'),
        cardBackModuleTitle: document.getElementById('card-back-module-title'),
        cardMeaningText: document.getElementById('card-meaning-text'),
        cardBreakdownText: document.getElementById('card-breakdown-text'),
        cardNoteText: document.getElementById('card-note-text'),
        srsActions: document.getElementById('srs-actions'),
        flipPromptBtn: document.getElementById('flip-prompt-btn'),
        cardFlipTrigger: document.getElementById('card-flip-trigger'),
        
        // Quiz
        quizScoreText: document.getElementById('quiz-score'),
        quizTotalText: document.getElementById('quiz-total-asked'),
        quizQuestionText: document.getElementById('quiz-question-text'),
        quizSubtext: document.getElementById('quiz-subtext'),
        quizOptionsContainer: document.getElementById('quiz-options-container'),
        quizExplanationBox: document.getElementById('quiz-explanation-box'),
        quizExplanationText: document.getElementById('quiz-explanation-text'),
        quizNextBtn: document.getElementById('quiz-next-btn'),
        
        // Word Builder
        builderMeaningTarget: document.getElementById('builder-meaning-target'),
        slotPrefix: document.getElementById('slot-prefix'),
        slotRoot: document.getElementById('slot-root'),
        slotSuffix: document.getElementById('slot-suffix'),
        assembledTermText: document.getElementById('assembled-term'),
        paletteChips: document.getElementById('palette-chips'),
        builderResetBtn: document.getElementById('builder-reset-btn'),
        builderCheckBtn: document.getElementById('builder-check-btn'),
        
        // Dictionary
        dictSearchInput: document.getElementById('dict-search-input'),
        dictClearBtn: document.getElementById('dict-clear-btn'),
        dictResultsCount: document.getElementById('dict-results-count'),
        dictListContainer: document.getElementById('dict-list-container'),
        
        // AI Chat / AI Dict
        chatMessagesBox: document.getElementById('chat-messages-box'),
        chatInputField: document.getElementById('chat-input-field'),
        chatSendBtn: document.getElementById('chat-send-btn'),
        aiSearchInput: document.getElementById('ai-search-input'),
        aiSearchBtn: document.getElementById('ai-search-btn'),
        aiDictResponse: document.getElementById('ai-dict-response'),
        
        // Modals & Buttons
        settingsModal: document.getElementById('settings-modal'),
        openSettingsBtn: document.getElementById('open-settings-modal'),
        aiStatusBtn: document.getElementById('ai-status-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
        saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        geminiApiKeyInput: document.getElementById('gemini-api-key-input'),
        geminiModelInput: document.getElementById('gemini-model-input'),
        pasteKeyBtn: document.getElementById('paste-key-btn'),
        clearKeyBtn: document.getElementById('clear-key-btn'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
        sidebar: document.getElementById('sidebar')
    };

    // Initialize Application
    function init() {
        populateModuleDropdown();
        updateApiKeyStatus();
        calculateSRSMetrics();
        setupEventListeners();
        renderDashboard();
        renderDictionary();
        
        // Check Streak
        if (elements.streakCounter) elements.streakCounter.textContent = state.streak;
    }

    // --- Module Dropdown ---
    function populateModuleDropdown() {
        if (!elements.moduleSelect) return;
        elements.moduleSelect.innerHTML = '<option value="all">📚 Tất cả 13 Chương Data (1,379 Từ)</option>';
        MEDICAL_DATA.modules.forEach(mod => {
            const count = MEDICAL_DATA.terms.filter(t => t.module_id === mod.id).length;
            const opt = document.createElement('option');
            opt.value = mod.id;
            opt.textContent = `${mod.title} (${count} từ)`;
            elements.moduleSelect.appendChild(opt);
        });
    }

    // --- Navigation ---
    function switchView(viewName) {
        state.currentView = viewName;
        elements.views.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');

        elements.navItems.forEach(item => {
            if (item.dataset.view === viewName) item.classList.add('active');
            else item.classList.remove('active');
        });

        if (window.innerWidth <= 900 && elements.sidebar) {
            elements.sidebar.classList.remove('active');
        }

        // View specific triggers
        if (viewName === 'srs-study') prepareAnkiSession();
        if (viewName === 'quiz') generateQuizQuestion();
        if (viewName === 'builder') prepareWordBuilder();
    }

    // --- Audio Pronunciation (Web Speech API) ---
    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.85;
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- SRS & ANKI SM-2 Algorithm Engine ---
    function getFilteredTerms() {
        if (state.selectedModule === 'all') return MEDICAL_DATA.terms;
        return MEDICAL_DATA.terms.filter(t => t.module_id === state.selectedModule);
    }

    function calculateSRSMetrics() {
        const now = Date.now();
        const terms = getFilteredTerms();
        state.dueCardIds = [];
        let masteredCount = 0;

        terms.forEach(term => {
            const srs = state.srsData[term.id];
            if (!srs) {
                state.dueCardIds.push(term.id);
            } else {
                if (srs.nextReview <= now) {
                    state.dueCardIds.push(term.id);
                }
                if (srs.interval >= 21) {
                    masteredCount++;
                }
            }
        });

        // Update UI Badges & Stats
        const dueLen = state.dueCardIds.length;
        if (elements.dueCountBadge) elements.dueCountBadge.textContent = dueLen;
        if (elements.bannerDueCount) elements.bannerDueCount.textContent = dueLen;
        if (elements.statDueToday) elements.statDueToday.textContent = dueLen;
        if (elements.statMastered) elements.statMastered.textContent = masteredCount;
        if (elements.statTotalTerms) elements.statTotalTerms.textContent = terms.length;

        const totalQuiz = state.quizScore.total;
        const accuracy = totalQuiz > 0 ? Math.round((state.quizScore.correct / totalQuiz) * 100) : 100;
        if (elements.statAccuracy) elements.statAccuracy.textContent = `${accuracy}%`;
    }

    function prepareAnkiSession() {
        calculateSRSMetrics();
        state.currentAnkiIndex = 0;
        renderCurrentFlashcard();
    }

    function renderCurrentFlashcard() {
        if (!elements.mainFlashcard) return;

        elements.mainFlashcard.classList.remove('flipped');
        if (elements.srsActions) elements.srsActions.classList.add('hidden');
        if (elements.flipPromptBtn) elements.flipPromptBtn.classList.remove('hidden');

        const dueCount = state.dueCardIds.length;
        if (elements.ankiRemainingCount) elements.ankiRemainingCount.textContent = dueCount;

        if (dueCount === 0 || state.currentAnkiIndex >= dueCount) {
            elements.cardTermText.textContent = '🎉 Hoàn thành các thẻ ôn!';
            elements.cardPhoneticText.textContent = 'Bạn đã duyệt qua hết thẻ bài học hôm nay.';
            elements.cardModuleTitle.textContent = 'Thành công';
            if (elements.cardSpeakBtn) elements.cardSpeakBtn.style.display = 'none';
            if (elements.flipPromptBtn) elements.flipPromptBtn.classList.add('hidden');
            return;
        }

        if (elements.cardSpeakBtn) elements.cardSpeakBtn.style.display = 'inline-flex';
        const termId = state.dueCardIds[state.currentAnkiIndex];
        const term = MEDICAL_DATA.terms.find(t => t.id === termId);

        if (!term) return;

        elements.cardModuleTitle.textContent = term.module_title;
        elements.cardBackModuleTitle.textContent = term.module_title;
        elements.cardTermText.textContent = term.term;
        elements.cardPhoneticText.textContent = term.phonetic || '—';
        elements.cardMeaningText.textContent = term.meaning;
        elements.cardBreakdownText.innerHTML = `<strong>Nguồn/Ghi chú:</strong> ${escapeHtml(term.note || 'Thuật ngữ Y khoa chuyên ngành')}`;
        elements.cardNoteText.textContent = `Chương: ${term.module_title}`;
    }

    function rateCard(rating) {
        const termId = state.dueCardIds[state.currentAnkiIndex];
        if (!termId) return;

        let srs = state.srsData[termId] || {
            repetitions: 0,
            interval: 1,
            easeFactor: 2.5,
            nextReview: Date.now()
        };

        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (rating === 'again') {
            srs.repetitions = 0;
            srs.interval = 1;
            srs.easeFactor = Math.max(1.3, srs.easeFactor - 0.2);
            srs.nextReview = now + (10 * 60 * 1000);
        } else if (rating === 'hard') {
            srs.repetitions += 1;
            srs.interval = Math.max(2, Math.round(srs.interval * 1.2));
            srs.easeFactor = Math.max(1.3, srs.easeFactor - 0.15);
            srs.nextReview = now + (srs.interval * ONE_DAY);
        } else if (rating === 'good') {
            srs.repetitions += 1;
            srs.interval = Math.max(4, Math.round(srs.interval * srs.easeFactor));
            srs.nextReview = now + (srs.interval * ONE_DAY);
        } else if (rating === 'easy') {
            srs.repetitions += 1;
            srs.interval = Math.max(7, Math.round(srs.interval * srs.easeFactor * 1.3));
            srs.easeFactor += 0.15;
            srs.nextReview = now + (srs.interval * ONE_DAY);
        }

        state.srsData[termId] = srs;
        localStorage.setItem('medterm_srs', JSON.stringify(state.srsData));

        state.currentAnkiIndex++;
        renderCurrentFlashcard();
    }

    // --- Interactive Quiz Engine ---
    function generateQuizQuestion() {
        const pool = getFilteredTerms();
        if (pool.length < 4) return;

        const target = pool[Math.floor(Math.random() * pool.length)];
        state.currentQuizQuestion = target;

        const distractors = [];
        while (distractors.length < 3) {
            const randomItem = MEDICAL_DATA.terms[Math.floor(Math.random() * MEDICAL_DATA.terms.length)];
            if (randomItem.id !== target.id && !distractors.includes(randomItem)) {
                distractors.push(randomItem);
            }
        }

        const options = [target, ...distractors].sort(() => Math.random() - 0.5);

        elements.quizQuestionText.innerHTML = `Thuật ngữ Y khoa nào mang nghĩa: <br><span style="color:var(--accent-green); font-size:1.4rem; font-weight:800;">"${escapeHtml(target.meaning)}"</span>?`;
        elements.quizSubtext.textContent = `Chuyên khoa: ${target.module_title}`;

        elements.quizOptionsContainer.innerHTML = options.map((opt, idx) => `
            <button class="option-btn" data-id="${opt.id}" onclick="checkQuizAnswer(this, '${opt.id}', '${target.id}')">
                <span><b>${String.fromCharCode(65 + idx)}.</b> ${escapeHtml(opt.term)} ${opt.phonetic ? `<small style="color:var(--text-muted)">(${escapeHtml(opt.phonetic)})</small>` : ''}</span>
            </button>
        `).join('');

        elements.quizExplanationBox.classList.add('hidden');
        elements.quizNextBtn.classList.add('hidden');
    }

    window.checkQuizAnswer = function(btn, selectedId, correctId) {
        const grid = btn.parentElement;
        const buttons = grid.querySelectorAll('.option-btn');
        buttons.forEach(b => b.disabled = true);

        state.quizScore.total++;

        if (selectedId === correctId) {
            state.quizScore.correct++;
            btn.classList.add('correct');
            elements.quizExplanationText.textContent = `🎉 Chính xác! "${state.currentQuizQuestion.term}" nghĩa là: ${state.currentQuizQuestion.meaning}`;
            rateCard('good');
        } else {
            btn.classList.add('incorrect');
            buttons.forEach(b => { if (b.dataset.id === correctId) b.classList.add('correct'); });
            elements.quizExplanationText.textContent = `❌ Chưa đúng! Đáp án đúng là: ${state.currentQuizQuestion.term} (${state.currentQuizQuestion.meaning})`;
            rateCard('again');
        }

        elements.quizScoreText.textContent = state.quizScore.correct;
        elements.quizTotalText.textContent = state.quizScore.total;
        elements.quizExplanationBox.classList.remove('hidden');
        elements.quizNextBtn.classList.remove('hidden');
    };

    // --- Word Builder / Root Matching ---
    function prepareWordBuilder() {
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
        resetBuilder();

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
            <button class="chip ${c.type}" onclick="selectChip('${c.type}', '${c.text}')">${c.text}</button>
        `).join('');
    }

    function resetBuilder() {
        elements.slotPrefix.textContent = 'Tiền tố (Prefix)';
        elements.slotRoot.textContent = 'Gốc từ (Root)';
        elements.slotSuffix.textContent = 'Hậu tố (Suffix)';
        elements.assembledTermText.textContent = '—';
        state.assembledSlots = { prefix: '', root: '', suffix: '' };
    }

    window.selectChip = function(type, text) {
        if (type === 'prefix') {
            elements.slotPrefix.textContent = text;
            state.assembledSlots.prefix = text;
        } else if (type === 'root') {
            elements.slotRoot.textContent = text;
            state.assembledSlots.root = text;
        } else if (type === 'suffix') {
            elements.slotSuffix.textContent = text;
            state.assembledSlots.suffix = text;
        }

        const assembled = (state.assembledSlots.prefix + state.assembledSlots.root + state.assembledSlots.suffix)
            .replace(/-/g, '').toUpperCase();
        elements.assembledTermText.textContent = assembled || '—';
    };

    function checkBuilderAnswer() {
        if (!state.builderTarget) return;

        const userAssembled = (state.assembledSlots.prefix + state.assembledSlots.root + state.assembledSlots.suffix)
            .replace(/-/g, '').toUpperCase();
        const targetClean = state.builderTarget.term.replace(/-/g, '').toUpperCase();

        if (userAssembled === targetClean) {
            alert(`🎉 CHÍNH XÁC! Bạn đã ghép đúng thuật ngữ: ${state.builderTarget.term}`);
            speakText(state.builderTarget.term);
            setTimeout(prepareWordBuilder, 1000);
        } else {
            alert(`❌ Chưa đúng! Bạn đã ghép: "${userAssembled}". Hãy thử lại!`);
        }
    }

    // --- Dictionary Search ---
    function renderDictionary() {
        if (!elements.dictListContainer) return;
        const query = elements.dictSearchInput.value.toLowerCase().trim();
        const mod = state.selectedModule;

        const filtered = MEDICAL_DATA.terms.filter(t => {
            const matchMod = mod === 'all' || t.module_id === mod;
            const matchQ = !query || t.term.toLowerCase().includes(query) || t.meaning.toLowerCase().includes(query) || t.note.toLowerCase().includes(query);
            return matchMod && matchQ;
        });

        elements.dictResultsCount.textContent = filtered.length;
        elements.dictListContainer.innerHTML = '';

        if (filtered.length === 0) {
            elements.dictListContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem 0;">Không tìm thấy thuật ngữ phù hợp.</p>`;
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
            card.style.cursor = 'pointer';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h4 style="font-size:1.1rem; color:#fff; font-weight:800;">${escapeHtml(item.term)}</h4>
                        ${item.phonetic ? `<div style="font-family:var(--font-mono); color:var(--accent-cyan); font-size:0.85rem;">${escapeHtml(item.phonetic)}</div>` : ''}
                    </div>
                    <button class="btn-sub" style="padding:4px 8px;" onclick="event.stopPropagation(); speakText('${escapeJs(item.term)}')">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                </div>
                <p style="color:var(--accent-green); font-weight:700; margin:0.4rem 0;">${escapeHtml(item.meaning || 'Thuật ngữ Y khoa')}</p>
                ${item.note ? `<p style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(item.note)}</p>` : ''}
            `;

            card.addEventListener('click', () => {
                switchView('ai-assistant');
                if (elements.aiSearchInput) elements.aiSearchInput.value = item.term;
                sendGeminiPrompt(item.term);
            });

            elements.dictListContainer.appendChild(card);
        });
    }

    // --- Gemini AI Assistant & AI Dictionary (Matches Screenshot Format) ---
    async function sendGeminiPrompt(promptText) {
        const q = promptText || (elements.aiSearchInput ? elements.aiSearchInput.value.trim() : '');
        if (!q) return;

        const resBox = elements.aiDictResponse || elements.chatMessagesBox;
        if (!resBox) return;

        resBox.innerHTML = `
            <div style="text-align:center; padding:30px;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:var(--accent-cyan); margin-bottom:12px;"></i>
                <p style="color:var(--text-secondary);">Đang kết nối Gemini AI (${escapeHtml(state.apiModel)})...</p>
            </div>
        `;

        const localMatch = MEDICAL_DATA.terms.find(t => t.term.toLowerCase() === q.toLowerCase());

        if (!state.apiKey) {
            resBox.innerHTML = renderAiCardFormat(q, localMatch, false);
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
                resBox.innerHTML = `<div class="ai-response-box">${formatMarkdownText(text)}</div>`;
            } else {
                throw new Error('Lỗi phản hồi từ Gemini API.');
            }
        } catch (err) {
            resBox.innerHTML = renderAiCardFormat(q, localMatch, true, err.message);
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
        const title = localMatch ? localMatch.term : q;
        const phonetic = localMatch ? localMatch.phonetic : '/fee-meyl ree-pruh-duhk-tiv sis-tuh m/';
        const vi = localMatch ? localMatch.meaning : 'Hệ sinh sản nữ / Thuật ngữ Y khoa';
        const note = localMatch ? localMatch.note : 'Giải phẫu và sinh lý hệ thống cơ quan.';

        return `
            <div class="ai-response-box">
                ${isError ? `<div style="color:var(--accent-red); font-size:0.85rem; margin-bottom:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi Gemini API: ${escapeHtml(errMsg)}. Hiển thị dữ liệu local:</div>` : ''}
                <div class="ai-greeting">Hello! Here is the explanation of the medical term "${escapeHtml(title)}" prepared for your studies.</div>
                
                <h3 class="ai-term-title">${escapeHtml(title)}</h3>
                <div class="ai-phonetic">Phonetic: ${escapeHtml(phonetic)}</div>

                <div style="margin-bottom:12px;">
                    <div class="ai-section-title"><i class="fa-solid fa-language"></i> 1. Meaning in Vietnamese (Nghĩa tiếng Việt)</div>
                    <p style="color:var(--accent-green); font-weight:700;">${escapeHtml(vi)}</p>
                    <p style="color:#d1d5db; font-size:0.9rem;">${escapeHtml(note)}</p>
                </div>

                <div style="margin-bottom:12px;">
                    <div class="ai-section-title"><i class="fa-solid fa-book"></i> 2. Meaning in English</div>
                    <p style="color:#d1d5db; font-size:0.9rem;">The ensemble of anatomical organs and structures in medical terminology representing ${escapeHtml(title)}.</p>
                </div>

                <div class="ai-footer-note">
                    <p><i class="fa-solid fa-key"></i> Bấm "Cấu hình Gemini API" ở Sidebar/Header để dán API Key & mở Gemini AI trực tiếp!</p>
                </div>
            </div>
        `;
    }

    function updateApiKeyStatus() {
        if (elements.apiKeyStatusText) {
            if (state.apiKey) {
                const trunc = state.apiKey.substring(0, 6) + '...' + state.apiKey.slice(-4);
                elements.apiKeyStatusText.textContent = `Đã lưu Key (${trunc})`;
                elements.apiKeyStatusText.style.color = 'var(--accent-green)';
            } else {
                elements.apiKeyStatusText.textContent = 'Chưa lưu API Key';
                elements.apiKeyStatusText.style.color = 'var(--accent-orange)';
            }
        }
        if (elements.geminiApiKeyInput) elements.geminiApiKeyInput.value = state.apiKey;
        if (elements.geminiModelInput) elements.geminiModelInput.value = state.apiModel;
    }

    function setupEventListeners() {
        // Nav items
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                switchView(view);
            });
        });

        // Mobile menu
        elements.mobileMenuToggle?.addEventListener('click', () => {
            elements.sidebar?.classList.toggle('active');
        });

        // Theme toggle
        elements.themeToggleBtn?.addEventListener('click', () => {
            const curr = document.documentElement.getAttribute('data-theme');
            const next = curr === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
        });

        // Settings Modal
        elements.openSettingsBtn?.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
        elements.aiStatusBtn?.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
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
            alert('✅ Đã lưu Gemini API Key & Model thành công!');
            elements.settingsModal.classList.add('hidden');
        });

        // Clear Key
        elements.clearKeyBtn?.addEventListener('click', () => {
            state.apiKey = '';
            localStorage.removeItem('gemini_api_key');
            updateApiKeyStatus();
            alert('🗑️ Đã xóa API Key.');
        });

        // Quiz Next
        elements.quizNextBtn?.addEventListener('click', generateQuizQuestion);

        // Builder Actions
        elements.builderResetBtn?.addEventListener('click', resetBuilder);
        elements.builderCheckBtn?.addEventListener('click', checkBuilderAnswer);

        // AI Search
        elements.aiSearchBtn?.addEventListener('click', () => sendGeminiPrompt());
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
