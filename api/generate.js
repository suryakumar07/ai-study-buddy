import { GoogleGenerativeAI } from "@google/generative-ai";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = `${systemPrompt}\n\nHere is the user's query: "${query}"`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    let text = response.text();

    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON object found in the AI response.");
    }
    const jsonString = jsonMatch[0];

    const data = JSON.parse(jsonString);
    res.status(200).json(data);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "An unknown server error occurred." });
  }
}
