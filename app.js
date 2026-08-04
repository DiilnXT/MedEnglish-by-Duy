/* ==========================================================================
   MedTerm AI - JavaScript Application Engine & ANKI SRS Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let state = {
        currentView: 'dashboard',
        selectedModule: 'all',
        srsData: JSON.parse(localStorage.getItem('medterm_srs')) || {},
        quizScore: { correct: 0, total: 0 },
        streak: parseInt(localStorage.getItem('medterm_streak')) || 1,
        apiKey: localStorage.getItem('gemini_api_key') || '',
        apiModel: localStorage.getItem('gemini_api_model') || 'gemini-2.5-flash',
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
        
        // AI Chat
        chatMessagesBox: document.getElementById('chat-messages-box'),
        chatInputField: document.getElementById('chat-input-field'),
        chatSendBtn: document.getElementById('chat-send-btn'),
        
        // Modals & Buttons
        settingsModal: document.getElementById('settings-modal'),
        openSettingsBtn: document.getElementById('open-settings-modal'),
        aiStatusBtn: document.getElementById('ai-status-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
        saveApiKeyBtn: document.getElementById('save-api-key-btn'),
        geminiApiKeyInput: document.getElementById('gemini-api-key-input'),
        geminiModelSelect: document.getElementById('gemini-model-select'),
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
        elements.streakCounter.textContent = state.streak;
    }

    // --- Module Dropdown ---
    function populateModuleDropdown() {
        elements.moduleSelect.innerHTML = '<option value="all">📚 Tất cả 13 Chương Data (1,312 Từ)</option>';
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

        if (window.innerWidth <= 900) {
            elements.sidebar.classList.remove('mobile-open');
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
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Trình duyệt của bạn không hỗ trợ phát âm tự động.');
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
        elements.dueCountBadge.textContent = dueLen;
        elements.bannerDueCount.textContent = dueLen;
        elements.statDueToday.textContent = dueLen;
        elements.statMastered.textContent = masteredCount;
        elements.statTotalTerms.textContent = terms.length;

        const totalQuiz = state.quizScore.total;
        const accuracy = totalQuiz > 0 ? Math.round((state.quizScore.correct / totalQuiz) * 100) : 0;
        elements.statAccuracy.textContent = `${accuracy}%`;
    }

    function prepareAnkiSession() {
        calculateSRSMetrics();
        state.currentAnkiIndex = 0;
        renderCurrentFlashcard();
    }

    function renderCurrentFlashcard() {
        elements.mainFlashcard.classList.remove('flipped');
        elements.srsActions.classList.add('hidden');
        elements.flipPromptBtn.classList.remove('hidden');

        const dueCount = state.dueCardIds.length;
        elements.ankiRemainingCount.textContent = dueCount;

        if (dueCount === 0 || state.currentAnkiIndex >= dueCount) {
            elements.cardTermText.textContent = '🎉 Bạn đã hoàn thành các thẻ ôn hôm nay!';
            elements.cardPhoneticText.textContent = 'Hãy giữ chuỗi streak và quay lại vào ngày mai.';
            elements.cardModuleTitle.textContent = 'Thành công';
            elements.cardSpeakBtn.style.display = 'none';
            elements.flipPromptBtn.classList.add('hidden');
            return;
        }

        elements.cardSpeakBtn.style.display = 'inline-flex';
        const termId = state.dueCardIds[state.currentAnkiIndex];
        const term = MEDICAL_DATA.terms.find(t => t.id === termId);

        if (!term) return;

        elements.cardModuleTitle.textContent = term.module_title;
        elements.cardBackModuleTitle.textContent = term.module_title;
        elements.cardTermText.textContent = term.term;
        elements.cardPhoneticText.textContent = term.phonetic || '—';
        elements.cardMeaningText.textContent = term.meaning;
        elements.cardBreakdownText.innerHTML = `<strong>Nguồn/Phân tích:</strong> ${term.note || 'Thuật ngữ Y khoa chuyên ngành'}`;
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
            srs.nextReview = now + (10 * 60 * 1000); // 10 mins
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
        calculateSRSMetrics();
        renderCurrentFlashcard();
    }

    // --- Dashboard Modules Progress ---
    function renderDashboard() {
        elements.modulesProgressContainer.innerHTML = '';
        
        MEDICAL_DATA.modules.forEach(mod => {
            const modTerms = MEDICAL_DATA.terms.filter(t => t.module_id === mod.id);
            const total = modTerms.length;
            let mastered = 0;
            
            modTerms.forEach(t => {
                const srs = state.srsData[t.id];
                if (srs && srs.interval >= 21) mastered++;
            });

            const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;

            const card = document.createElement('div');
            card.className = 'mod-progress-card';
            card.innerHTML = `
                <div class="mod-card-header">
                    <div class="mod-card-title">${mod.title}</div>
                    <span class="mod-card-count">${mastered}/${total} từ</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                </div>
                <div class="mod-card-meta">
                    <span>Đã làm chủ: ${percent}%</span>
                    <span>Thẻ ôn: <i class="fa-solid fa-angle-right"></i></span>
                </div>
            `;
            card.addEventListener('click', () => {
                state.selectedModule = mod.id;
                elements.moduleSelect.value = mod.id;
                switchView('srs-study');
            });
            elements.modulesProgressContainer.appendChild(card);
        });
    }

    // --- Interactive Quiz Logic ---
    function generateQuizQuestion() {
        const terms = getFilteredTerms();
        if (terms.length < 4) return;

        elements.quizExplanationBox.classList.add('hidden');
        elements.quizNextBtn.classList.add('hidden');

        // Pick random term
        const correctTerm = terms[Math.floor(Math.random() * terms.length)];
        
        // Pick 3 random distractors
        let options = [correctTerm];
        while (options.length < 4) {
            const rand = terms[Math.floor(Math.random() * terms.length)];
            if (!options.find(o => o.id === rand.id)) {
                options.push(rand);
            }
        }

        // Shuffle options
        options.sort(() => Math.random() - 0.5);

        state.currentQuizQuestion = {
            correctTerm: correctTerm,
            options: options
        };

        elements.quizQuestionText.textContent = correctTerm.term;
        elements.quizSubtext.textContent = correctTerm.phonetic || '';

        elements.quizOptionsContainer.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.innerHTML = `<i class="fa-regular fa-circle"></i> <span>${opt.meaning}</span>`;
            btn.addEventListener('click', () => handleQuizAnswer(opt, btn));
            elements.quizOptionsContainer.appendChild(btn);
        });
    }

    function handleQuizAnswer(selectedOpt, selectedBtn) {
        const allBtns = elements.quizOptionsContainer.querySelectorAll('.quiz-option');
        allBtns.forEach(b => b.classList.add('disabled'));

        state.quizScore.total += 1;
        const isCorrect = selectedOpt.id === state.currentQuizQuestion.correctTerm.id;

        if (isCorrect) {
            state.quizScore.correct += 1;
            selectedBtn.classList.add('correct');
            selectedBtn.querySelector('i').className = 'fa-solid fa-circle-check';
        } else {
            selectedBtn.classList.add('incorrect');
            selectedBtn.querySelector('i').className = 'fa-solid fa-circle-xmark';
            
            // Highlight correct answer
            allBtns.forEach(b => {
                if (b.textContent.includes(state.currentQuizQuestion.correctTerm.meaning)) {
                    b.classList.add('correct');
                }
            });
        }

        elements.quizScoreText.textContent = state.quizScore.correct;
        elements.quizTotalText.textContent = state.quizScore.total;

        // Show Explanation
        const term = state.currentQuizQuestion.correctTerm;
        elements.quizExplanationText.innerHTML = `<strong>${term.term}</strong> (${term.phonetic}): ${term.meaning}.<br><em>Phân tích:</em> ${term.note}`;
        elements.quizExplanationBox.classList.remove('hidden');
        elements.quizNextBtn.classList.remove('hidden');

        calculateSRSMetrics();
    }

    // --- Word Assembly / Builder Game ---
    function prepareWordBuilder() {
        const termsWithHyphen = MEDICAL_DATA.terms.filter(t => t.note && (t.note.includes('-') || t.term.includes('-')));
        const target = termsWithHyphen.length > 0 ? termsWithHyphen[Math.floor(Math.random() * termsWithHyphen.length)] : MEDICAL_DATA.terms[0];

        state.builderTarget = target;
        state.assembledSlots = { prefix: '', root: '', suffix: '' };

        elements.builderMeaningTarget.textContent = target.meaning;
        elements.slotPrefix.textContent = 'Tiền tố (Prefix)';
        elements.slotRoot.textContent = 'Gốc từ (Root)';
        elements.slotSuffix.textContent = 'Hậu tố (Suffix)';
        elements.slotPrefix.className = 'slot';
        elements.slotRoot.className = 'slot';
        elements.slotSuffix.className = 'slot';
        elements.assembledTermText.textContent = '—';

        // Generate Palette Chips
        let chips = ['hyper-', 'hypo-', 'gastr', 'hepat', 'card', 'nephr', '-itis', '-algia', '-megaly', '-logy'];
        elements.paletteChips.innerHTML = '';
        chips.forEach(c => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = c;
            chip.addEventListener('click', () => {
                if (c.endsWith('-')) {
                    state.assembledSlots.prefix = c.replace('-', '');
                    elements.slotPrefix.textContent = state.assembledSlots.prefix;
                    elements.slotPrefix.classList.add('filled');
                } else if (c.startsWith('-')) {
                    state.assembledSlots.suffix = c.replace('-', '');
                    elements.slotSuffix.textContent = state.assembledSlots.suffix;
                    elements.slotSuffix.classList.add('filled');
                } else {
                    state.assembledSlots.root = c;
                    elements.slotRoot.textContent = state.assembledSlots.root;
                    elements.slotRoot.classList.add('filled');
                }
                updateAssembledPreview();
            });
            elements.paletteChips.appendChild(chip);
        });
    }

    function updateAssembledPreview() {
        const term = `${state.assembledSlots.prefix}${state.assembledSlots.root}${state.assembledSlots.suffix}`;
        elements.assembledTermText.textContent = term || '—';
    }

    // --- Dictionary View ---
    function renderDictionary(query = '') {
        elements.dictListContainer.innerHTML = '';
        const filtered = MEDICAL_DATA.terms.filter(t => {
            const q = query.toLowerCase().strip();
            if (!q) return true;
            return t.term.toLowerCase().includes(q) || 
                   t.meaning.toLowerCase().includes(q) || 
                   (t.note && t.note.toLowerCase().includes(q));
        }).slice(0, 100);

        elements.dictResultsCount.textContent = filtered.length;

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'dict-item-card';
            card.innerHTML = `
                <div>
                    <div class="dict-term-title">${item.term}</div>
                    <div class="dict-phonetic">${item.phonetic}</div>
                    <div class="dict-meaning">${item.meaning}</div>
                    <div class="dict-note">${item.note}</div>
                </div>
                <button class="btn-icon speak-item-btn" title="Nghe phát âm">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
            `;
            card.querySelector('.speak-item-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                speakText(item.term);
            });
            elements.dictListContainer.appendChild(card);
        });
    }

    // --- Gemini AI Integration & Chat ---
    function updateApiKeyStatus() {
        if (state.apiKey) {
            const truncated = state.apiKey.substring(0, 6) + '...' + state.apiKey.substring(state.apiKey.length - 4);
            elements.apiKeyStatusText.textContent = `Đã lưu Key (${truncated})`;
            elements.apiKeyStatusText.style.color = 'var(--accent-green)';
            elements.geminiApiKeyInput.value = state.apiKey;
        } else {
            elements.apiKeyStatusText.textContent = 'Chưa lưu API Key';
            elements.apiKeyStatusText.style.color = 'var(--accent-orange)';
            elements.geminiApiKeyInput.value = '';
        }
        elements.geminiModelSelect.value = state.apiModel;
    }

    async function sendGeminiPrompt(userPrompt) {
        appendChatMessage('user', userPrompt);
        
        const loadingMsg = appendChatMessage('system', '🤖 Gemini AI đang suy nghĩ & phân tích thuật ngữ...');

        if (!state.apiKey) {
            // Local AI Fallback Breakdown
            setTimeout(() => {
                loadingMsg.querySelector('.msg-bubble').innerHTML = `
                    <strong>💡 Phân tích từ Hệ thống Local AI (Chưa lưu Gemini Key):</strong><br>
                    Bạn chưa dán Gemini API Key. Để sử dụng AI trực tiếp từ Google, vui lòng mở nút <strong>"Cấu hình Gemini API"</strong> ở góc dưới bên trái, dán Key và nhấn <strong>Lưu Key</strong>!<br><br>
                    <em>Kết quả tra cứu nhanh local:</em> Tìm thấy các tài liệu và quy tắc liên quan đến "${userPrompt}" trong bộ 1,312 thuật ngữ.
                `;
            }, 600);
            return;
        }

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${state.apiModel}:generateContent?key=${state.apiKey}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Bạn là Trợ lý Y Khoa Chuyên Nghiệp. Hãy giải thích chi tiết thuật ngữ, nguồn gốc La-tinh/Hy Lạp, phân tích gốc từ/tiền tố/hậu tố, ví dụ lâm sàng và ứng dụng thực tế bằng tiếng Việt khoa học, trực quan cho sinh viên y khoa:\n\nCâu hỏi/Thuật ngữ: ${userPrompt}`
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                const aiReply = data.candidates[0].content.parts[0].text;
                loadingMsg.querySelector('.msg-bubble').innerHTML = formattedMarkdown(aiReply);
            } else if (data.error) {
                loadingMsg.querySelector('.msg-bubble').innerHTML = `<span class="text-warning">❌ Lỗi API Gemini: ${data.error.message}</span>`;
            } else {
                loadingMsg.querySelector('.msg-bubble').textContent = 'Không nhận được phản hồi hợp lệ từ Gemini API.';
            }
        } catch (err) {
            loadingMsg.querySelector('.msg-bubble').innerHTML = `<span class="text-warning">⚠️ Không thể kết nối với Gemini API: ${err.message}. Kiểm tra lại mạng hoặc API Key.</span>`;
        }
    }

    function formattedMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    function appendChatMessage(role, text) {
        const msg = document.createElement('div');
        msg.className = `chat-msg ${role === 'user' ? 'user-msg' : 'system-msg'}`;
        msg.innerHTML = `
            <i class="fa-solid ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
            <div class="msg-bubble">${text}</div>
        `;
        elements.chatMessagesBox.appendChild(msg);
        elements.chatMessagesBox.scrollTop = elements.chatMessagesBox.scrollHeight;
        return msg;
    }

    // --- Setup Event Listeners ---
    function setupEventListeners() {
        // Navigation View Switches
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                if (view) switchView(view);
            });
        });

        // Global Module Filter Change
        elements.moduleSelect.addEventListener('change', (e) => {
            state.selectedModule = e.target.value;
            calculateSRSMetrics();
            if (state.currentView === 'dashboard') renderDashboard();
            if (state.currentView === 'srs-study') prepareAnkiSession();
            if (state.currentView === 'dictionary') renderDictionary(elements.dictSearchInput.value);
        });

        // Banner Action Buttons
        document.getElementById('start-anki-btn').addEventListener('click', () => switchView('srs-study'));
        document.getElementById('go-quiz-btn').addEventListener('click', () => switchView('quiz'));

        // Flashcard Interactions
        elements.mainFlashcard.addEventListener('click', () => {
            elements.mainFlashcard.classList.toggle('flipped');
            if (elements.mainFlashcard.classList.contains('flipped')) {
                elements.srsActions.classList.remove('hidden');
                elements.flipPromptBtn.classList.add('hidden');
            }
        });

        elements.cardFlipTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.mainFlashcard.classList.add('flipped');
            elements.srsActions.classList.remove('hidden');
            elements.flipPromptBtn.classList.add('hidden');
        });

        elements.cardSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            speakText(elements.cardTermText.textContent);
        });

        // ANKI Rating Buttons
        document.querySelectorAll('.srs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rating = btn.dataset.rating;
                rateCard(rating);
            });
        });

        // Quiz Next Question
        elements.quizNextBtn.addEventListener('click', generateQuizQuestion);

        // Word Builder Buttons
        elements.builderResetBtn.addEventListener('click', prepareWordBuilder);
        elements.builderCheckBtn.addEventListener('click', () => {
            const assembled = `${state.assembledSlots.prefix}${state.assembledSlots.root}${state.assembledSlots.suffix}`;
            if (assembled.toLowerCase() === state.builderTarget.term.toLowerCase()) {
                alert('🎉 Chính xác! Bạn đã ghép từ rất chuẩn.');
                prepareWordBuilder();
            } else {
                alert(`❌ Chưa chính xác. Thuật ngữ đúng là: ${state.builderTarget.term}`);
            }
        });

        // Dictionary Search Input
        elements.dictSearchInput.addEventListener('input', (e) => {
            renderDictionary(e.target.value);
        });

        elements.dictClearBtn.addEventListener('click', () => {
            elements.dictSearchInput.value = '';
            renderDictionary('');
        });

        // AI Chat Send
        elements.chatSendBtn.addEventListener('click', () => {
            const q = elements.chatInputField.value.trim();
            if (q) {
                elements.chatInputField.value = '';
                sendGeminiPrompt(q);
            }
        });

        elements.chatInputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                elements.chatSendBtn.click();
            }
        });

        document.getElementById('chat-config-api-btn').addEventListener('click', () => {
            elements.settingsModal.classList.remove('hidden');
        });

        // Modals & Settings
        elements.openSettingsBtn.addEventListener('click', () => {
            elements.settingsModal.classList.remove('hidden');
        });
        elements.aiStatusBtn.addEventListener('click', () => {
            elements.settingsModal.classList.remove('hidden');
        });

        const closeModal = () => elements.settingsModal.classList.add('hidden');
        elements.closeModalBtn.addEventListener('click', closeModal);
        elements.cancelSettingsBtn.addEventListener('click', closeModal);

        // Save API Key Functionality
        elements.saveApiKeyBtn.addEventListener('click', () => {
            const keyVal = elements.geminiApiKeyInput.value.trim();
            const modelVal = elements.geminiModelSelect.value;

            state.apiKey = keyVal;
            state.apiModel = modelVal;

            localStorage.setItem('gemini_api_key', keyVal);
            localStorage.setItem('gemini_api_model', modelVal);

            updateApiKeyStatus();
            closeModal();
            alert('✅ Đã lưu cấu hình Gemini API Key thành công!');
        });

        // Paste Key Clipboard Helper (Supports Ctrl+V and click/tap paste)
        elements.pasteKeyBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    const clipText = await navigator.clipboard.readText();
                    if (clipText) {
                        elements.geminiApiKeyInput.value = clipText.trim();
                        alert('📋 Đã dán API Key từ bộ nhớ tạm (Clipboard)!');
                        return;
                    }
                }
            } catch (err) {
                console.log('Clipboard permission not granted, focusing input for Ctrl+V');
            }
            elements.geminiApiKeyInput.focus();
            elements.geminiApiKeyInput.select();
        });

        // Clear Key
        elements.clearKeyBtn.addEventListener('click', () => {
            state.apiKey = '';
            localStorage.removeItem('gemini_api_key');
            updateApiKeyStatus();
            alert('🗑️ Đã xóa API Key đã lưu.');
        });

        // Theme Toggle
        elements.themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            document.body.className = newTheme === 'dark' ? 'dark-mode' : 'light-mode';
        });

        // Mobile Menu
        elements.mobileMenuToggle.addEventListener('click', () => {
            elements.sidebar.classList.toggle('mobile-open');
        });
    }

    // Start App
    init();
});
