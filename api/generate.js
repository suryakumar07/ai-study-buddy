import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // MUST be service role key and kept secret on server
);

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
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

  try {
    // 1) Auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.replace("Bearer ", "");

    // 2) Validate token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // 3) Validate query parameter
    const { query } = req.body;
    if (typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "Query must be a non-empty string" });
    }
    const sanitizedQuery = query.replace(/[{}$<>]/g, "");

    // 4) Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = `${systemPrompt}\n\nHere is the user's query: "${sanitizedQuery}"`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // 5) Extract & parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON object found in the AI response.");
    const jsonString = jsonMatch[0];
    const data = JSON.parse(jsonString);

    // Optional: increment request counter for user here (next step)
    res.status(200).json(data);
  } catch (error) {
    console.error("API Error:", error);
    const message = error?.message || "Unknown server error";
    const status = error?.status || 500;
    res.status(status).json({ error: message });
  }
}
