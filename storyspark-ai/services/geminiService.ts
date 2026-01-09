import { GoogleGenAI } from "@google/genai";
import { SelectionItem, QuizQuestion } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateStoryContent = async (
  character: SelectionItem,
  setting: SelectionItem
): Promise<{ title: string; content: string; quiz: QuizQuestion[] }> => {
  try {
    const ai = getClient();
    
    const prompt = `
      You are a creative writing assistant and teacher for students.
      
      Task 1: Write a fun, engaging short story (approx 200-300 words).
      Protagonist: ${character.name} (${character.description})
      Setting: ${setting.name} (${setting.description})
      
      Task 2: Create a reading comprehension quiz based on the story.
      - 3 to 5 questions.
      - Each question must have exactly 4 options.
      - Identify the correct answer index (0-3).
      
      Output JSON Format:
      {
        "title": "Story Title",
        "content": "Full story content...",
        "quiz": [
          {
            "question": "What did the character find?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswerIndex": 0
          }
        ]
      }
      
      Style Rules:
      - Accessible language for middle schoolers.
      - Story should be exciting and positive.
      - Return ONLY valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No content generated");
    }

    const json = JSON.parse(text);
    return {
      title: json.title || `The Adventure of ${character.name}`,
      content: json.content || "Story generation failed to format correctly.",
      quiz: json.quiz || []
    };

  } catch (error) {
    console.error("Error generating story:", error);
    throw error;
  }
};
