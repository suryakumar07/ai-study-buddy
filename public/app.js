document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    const queryInput = document.getElementById('query-input');
    const submitBtn = document.getElementById('submit-btn');
    const sampleBtns = document.querySelectorAll('.sample-btn');
    const charCount = document.querySelector('.character-count');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');

    // Result containers
    const explanationEn = document.getElementById('explanation-en');
    const explanationTa = document.getElementById('explanation-ta');
    const flashcardsContainer = document.getElementById('flashcards-container');
    const mcqContainer = document.getElementById('mcq-container');
    const shortAnswerContainer = document.getElementById('short-answer-container');
    const longAnswerContainer = document.getElementById('long-answer-container');
    // CHANGED: The ID in the HTML is 'revision-en', not 'quickRevision-en'
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

    // --- Core Functions ---

    /**
     * Handles the main logic of submitting the query to the backend.
     */
    async function handleQuerySubmit() {
        const query = queryInput.value.trim();
        if (!query) {
            alert('Please enter a topic or question.');
            return;
        }

        toggleLoading(true);
        resultsSection.classList.add('hidden');

        try {
            // Call our backend API
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            console.error('Error fetching AI response:', error);
            alert(`An error occurred: ${error.message}`);
            resultsSection.classList.add('hidden'); // Hide results on error
        } finally {
            toggleLoading(false);
        }
    }

    /**
     * Toggles the loading state of the UI.
     * @param {boolean} isLoading - True if loading, false otherwise.
     */
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

    /**
     * Populates the entire UI with the data received from the API.
     * @param {object} data - The parsed JSON data from the backend.
     */
    function displayResults(data) {
        // Clear previous results
        clearContainers();
        
        // 1. Simple Explanation (No change needed here)
        explanationEn.innerHTML = data.explanation.english.replace(/\n/g, '<br>');
        explanationTa.innerHTML = data.explanation.tamil.replace(/\n/g, '<br>');

        // 2. Flashcards
        // CHANGED: Accessing new flattened properties like card.question, card.questionTamil
        data.flashcards.forEach(card => {
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
                 if (e.key === 'Enter' || e.key === ' ') {
                    flashcardEl.classList.toggle('flipped')
                 }
            });
            flashcardsContainer.appendChild(flashcardEl);
        });

        // 3. Practice Questions - MCQs
        // CHANGED: Key updated from 'mcqs' to 'mcq'. Properties updated (e.g., question_en -> question).
        // ADDED: Rendering for both English and Tamil options.
        data.practiceQuestions.mcq.forEach((mcq, index) => {
            // Create separate lists for English and Tamil options
            const enOptionsHtml = mcq.options.map((opt, i) => 
                `<li data-correct="${i === mcq.correct}">${i + 1}. ${opt}</li>`
            ).join('');
            const taOptionsHtml = mcq.optionsTamil.map((opt, i) => 
                `<li data-correct="${i === mcq.correct}">${i + 1}. ${opt}</li>`
            ).join('');

            const mcqEl = createQuestionElement(
                `MCQ ${index + 1}`,
                mcq.question,
                mcq.questionTamil,
                // Combine both lists into the additional HTML
                `<h5>Options:</h5><ul class="mcq-options">${enOptionsHtml}</ul>
                 <h5>விருப்பங்கள்:</h5><ul class="mcq-options">${taOptionsHtml}</ul>`
            );
            mcqContainer.appendChild(mcqEl);
        });

        // 4. Practice Questions - Short Answer
        // CHANGED: Key updated from 'shortAnswer' to 'short'. Properties updated.
        data.practiceQuestions.short.forEach((sa, index) => {
            const saEl = createQuestionElement(
                `Short Answer ${index + 1} (${sa.marks} marks)`,
                sa.question,
                sa.questionTamil
            );
            shortAnswerContainer.appendChild(saEl);
        });

        // 5. Practice Questions - Long Answer
        // CHANGED: Key from 'longAnswer' to 'long'. It's now an OBJECT, not an array, so we REMOVE the loop.
        const longAnswer = data.practiceQuestions.long;
        const laEl = createQuestionElement(
            `Long Answer Question (${longAnswer.marks} marks)`,
            longAnswer.question,
            longAnswer.questionTamil
        );
        longAnswerContainer.appendChild(laEl);
        
        // 6. Quick Revision
        // CHANGED: Key updated from 'revision' to 'quickRevision'.
        revisionEn.innerHTML = data.quickRevision.english.replace(/\n/g, '<br>');
        revisionTa.innerHTML = data.quickRevision.tamil.replace(/\n/g, '<br>');

        // Finally, show the results
        resultsSection.classList.remove('hidden');
    }
    
    /**
     * A helper function to create the HTML structure for a practice question.
     * @param {string} title - The title of the question (e.g., "MCQ 1").
     * @param {string} qEn - The English question text.
     * @param {string} qTa - The Tamil question text.
     * @param {string} [additionalHtml=''] - Optional additional HTML for answers/options.
     * @returns {HTMLElement} - The fully constructed question element.
     */
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

    /**
     * Clears all dynamic content containers before a new query.
     */
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