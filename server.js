// 1. Import necessary libraries
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // Loads environment variables from .env file

// 2. Initialize the Express app and the Google Generative AI client
const app = express();
const port = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. Configure middleware
app.use(express.json()); // To parse JSON request bodies
app.use(express.static('public')); // To serve static files (index.html, style.css)

// 4. Define the AI's persona and instructions (the "System Prompt")
const systemPrompt = `
You are AI Study Buddy, a bilingual (English + Tamil) tutor for Indian students.
You MUST return ONLY valid JSON matching this exact schema and property order:

{
  "explanation": {
    "english": "string",
    "tamil": "string"
  },
  "flashcards": [
    {
      "question": "string",
      "answer": "string",
      "questionTamil": "string",
      "answerTamil": "string"
    }
  ],
  "practiceQuestions": {
    "mcq": [
      {
        "question": "string",
        "questionTamil": "string",
        "options": ["string","string","string","string"],
        "optionsTamil": ["string","string","string","string"],
        "correct": 0
      }
    ],
    "short": [
      {
        "question": "string",
        "questionTamil": "string",
        "marks": 2
      }
    ],
    "long": {
      "question": "string",
      "questionTamil": "string",
      "marks": 5
    }
  },
  "quickRevision": {
    "english": "string",
    "tamil": "string"
  }
}

Rules:
- Output must be valid JSON, UTF-8, with no markdown, no extra keys, and no explanation outside JSON.
- English and Tamil must convey the same meaning; Tamil must be in Tamil script (no transliteration).
- MCQ must have exactly 4 unique options and exactly one correct index (0..3).
- Generate exactly 3-5 flashcards, exactly 3 MCQs, exactly 2 short questions, exactly 1 long question.
- Keep explanations concise, exam-focused, and free of chain-of-thought.
`;

// 5. Create the API endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const fullPrompt = `${systemPrompt}\n\nHere is the user's query: "${query}"`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let text = response.text();

         // Find the JSON block within the response text
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON object found in the AI response.');
        }
        const jsonString = jsonMatch[0];

        // Parse the extracted JSON string
        const data = JSON.parse(jsonString);

        res.status(200).json(data);

    } catch (error) {
    console.error('API Error:', error);
    // Send the actual error message back to the frontend
    res.status(500).json({ error: error.message || 'An unknown server error occurred.' });
    }
});

// 6. Start the server
app.listen(port, () => {
    console.log(`AI Study Buddy server is running at http://localhost:${port}`);
});