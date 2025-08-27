// public/app.js
import { supabase } from "./js/supabaseClient.js";
import { getSession, setupAuthListener, login, signUp } from "./js/auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    const queryInput = document.getElementById('query-input');
    const submitBtn = document.getElementById('submit-btn');
    const sampleBtns = document.querySelectorAll('.sample-btn');
    const charCount = document.querySelector('.character-count');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');

    // Auth elements (ensure these exist in your index.html as suggested)
    const authEmail = document.getElementById('auth-email');
    const authPass = document.getElementById('auth-pass');
    const btnSignup = document.getElementById('btn-signup');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const authMsg = document.getElementById('auth-msg');

    // Result containers
    const explanationEn = document.getElementById('explanation-en');
    const explanationTa = document.getElementById('explanation-ta');
    const flashcardsContainer = document.getElementById('flashcards-container');
    const mcqContainer = document.getElementById('mcq-container');
    const shortAnswerContainer = document.getElementById('short-answer-container');
    const longAnswerContainer = document.getElementById('long-answer-container');
    const revisionEn = document.getElementById('revision-en');
    const revisionTa = document.getElementById('revision-ta');

    // --- Event Listeners ---

    // Update character count on input
    queryInput.addEventListener('input', () => {
        const count = queryInput.value.length;
        charCount.textContent = `${count} characters`;
    });

    // Handle form submission
    submitBtn.addEventListener('click', handleQuerySubmit);

    // Allow pressing Enter to submit
    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleQuerySubmit();
        }
    });

    // Populate textarea with sample topics
    sampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            queryInput.value = btn.dataset.topic;
            queryInput.dispatchEvent(new Event('input')); // Trigger input event for char count
            queryInput.focus();
        });
    });

    // Signup/Login/Logout handlers
    if (btnSignup) btnSignup.addEventListener('click', async () => {
        try {
            authMsg.textContent = 'Signing up...';
            await signUp(authEmail.value, authPass.value);
            authMsg.textContent = 'Signup OK — check your email for confirmation if required.';
        } catch (err) {
            authMsg.textContent = err.message || 'Signup failed';
        }
    });

    if (btnLogin) btnLogin.addEventListener('click', async () => {
        try {
            authMsg.textContent = 'Logging in...';
            await login(authEmail.value, authPass.value);
            authMsg.textContent = 'Logged in!';
        } catch (err) {
            authMsg.textContent = err.message || 'Login failed';
        }
    });

    if (btnLogout) btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        authMsg.textContent = 'Logged out';
    });

    // Update UI on session changes
    setupAuthListener((session) => {
        const loggedIn = !!session?.user;
        if (btnLogout) btnLogout.style.display = loggedIn ? 'inline-block' : 'none';
        // show/hide input section based on login
        const inputSection = document.querySelector('.input-section');
        if (inputSection) inputSection.style.display = loggedIn ? 'block' : 'none';
    });

    // --- Core Functions ---

    async function handleQuerySubmit() {
        const query = queryInput.value.trim();
        if (!query) {
            alert('Please enter a topic or question.');
            return;
        }

        toggleLoading(true);
        resultsSection.classList.add('hidden');

        try {
            // Get Supabase session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('Please login first to continue.');
                toggleLoading(false);
                return;
            }

            // Attach access token
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            console.error('Error fetching AI response:', error);
            const errorMessage = error.message || 'Server Error';
            alert(`An error occurred: ${errorMessage}`);
            resultsSection.classList.add('hidden');
        } finally {
            toggleLoading(false);
        }
    }

    function toggleLoading(isLoading) {
        const submitText = document.querySelector('.submit-text');
        const loadingText = document.querySelector('.loading-text');

        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
            submitBtn.disabled = true;
            submitText.classList.add('hidden');
            loadingText.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
            submitText.classList.remove('hidden');
            loadingText.classList.add('hidden');
        }
    }

    function displayResults(data) {
        // Clear previous
        clearContainers();

        // 1. Simple Explanation
        if (data?.explanation?.english) explanationEn.innerHTML = data.explanation.english.replace(/\n/g, '<br>');
        if (data?.explanation?.tamil) explanationTa.innerHTML = data.explanation.tamil.replace(/\n/g, '<br>');

        // 2. Flashcards
        (data.flashcards || []).forEach(card => {
            const flashcardEl = document.createElement('div');
            flashcardEl.className = 'flashcard';
            flashcardEl.tabIndex = 0;
            flashcardEl.innerHTML = `
                <div class="flashcard-inner">
                    <div class="flashcard-front">
                        <h4>English Question</h4>
                        <p>${card.question}</p>
                        <div class="flashcard-divider"></div>
                        <h4>Tamil Kelvi</h4>
                        <p>${card.questionTamil}</p>
                    </div>
                    <div class="flashcard-back">
                        <h4>English Answer</h4>
                        <p>${card.answer}</p>
                        <div class="flashcard-divider"></div>
                        <h4>Tamil Pathil</h4>
                        <p>${card.answerTamil}</p>
                    </div>
                </div>
            `;
            flashcardEl.addEventListener('click', () => flashcardEl.classList.toggle('flipped'));
            flashcardEl.addEventListener('keydown', (e) => {
                 if (e.key === 'Enter' || e.key === ' ') flashcardEl.classList.toggle('flipped');
            });
            flashcardsContainer.appendChild(flashcardEl);
        });

        // 3. MCQs
        (data?.practiceQuestions?.mcq || []).forEach((mcq, index) => {
            const enOptionsHtml = mcq.options.map((opt, i) => `<li data-correct="${i === mcq.correct}">${i + 1}. ${opt}</li>`).join('');
            const taOptionsHtml = mcq.optionsTamil.map((opt, i) => `<li data-correct="${i === mcq.correct}">${i + 1}. ${opt}</li>`).join('');

            const mcqEl = createQuestionElement(
                `MCQ ${index + 1}`,
                mcq.question,
                mcq.questionTamil,
                `<h5>Options:</h5><ul class="mcq-options">${enOptionsHtml}</ul>
                 <h5>விருப்பங்கள்:</h5><ul class="mcq-options">${taOptionsHtml}</ul>`
            );
            mcqContainer.appendChild(mcqEl);
        });

        // 4. Short answers
        (data?.practiceQuestions?.short || []).forEach((sa, index) => {
            const saEl = createQuestionElement(`Short Answer ${index + 1} (${sa.marks} marks)`, sa.question, sa.questionTamil);
            shortAnswerContainer.appendChild(saEl);
        });

        // 5. Long answer (object)
        const longAnswer = data?.practiceQuestions?.long;
        if (longAnswer) {
            const laEl = createQuestionElement(`Long Answer Question (${longAnswer.marks} marks)`, longAnswer.question, longAnswer.questionTamil);
            longAnswerContainer.appendChild(laEl);
        }

        // 6. Quick revision
        if (data?.quickRevision?.english) revisionEn.innerHTML = data.quickRevision.english.replace(/\n/g, '<br>');
        if (data?.quickRevision?.tamil) revisionTa.innerHTML = data.quickRevision.tamil.replace(/\n/g, '<br>');

        resultsSection.classList.remove('hidden');
    }

    function createQuestionElement(title, qEn, qTa, additionalHtml = '') {
        const questionEl = document.createElement('div');
        questionEl.className = 'question-item';
        questionEl.innerHTML = `
            <p class="question-text">${title}</p>
            <div class="question-languages">
                <div class="question-lang">
                    <h5>English</h5>
                    <p>${qEn}</p>
                </div>
                <div class="question-lang">
                    <h5>தமிழ்</h5>
                    <p>${qTa}</p>
                </div>
            </div>
            ${additionalHtml}
        `;
        return questionEl;
    }

    function clearContainers() {
        explanationEn.textContent = '';
        explanationTa.textContent = '';
        flashcardsContainer.innerHTML = '';
        mcqContainer.innerHTML = '';
        shortAnswerContainer.innerHTML = '';
        longAnswerContainer.innerHTML = '';
        revisionEn.textContent = '';
        revisionTa.textContent = '';
    }
});
