import { NextResponse } from 'next/server';

interface StoryRequest {
  character: {
    id: string;
    name: string;
    description: string;
  };
  setting: {
    id: string;
    name: string;
    description: string;
  };
  words: Array<{
    word: string;
    translation: string;
  }>;
}

export async function POST(req: Request) {
  try {
    const body: StoryRequest = await req.json();
    const { character, setting, words } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // 构建单词列表字符串
    const wordsList = words.length > 0
      ? words.map(w => `- ${w.word} (${w.translation})`).join('\n')
      : 'No specific words required.';

    const prompt = `
You are a creative writing assistant and teacher for students learning English as a second language (ESL).

Target Audience: 8-10 years old ESL students
Reading Level: Beginner to Elementary (CEFR A1-A2)
- Use simple sentence structures (subject-verb-object)
- Prefer common, everyday vocabulary
- Avoid complex grammar (no passive voice, conditional sentences, or complex tenses)
- Keep sentences short (10-15 words maximum)
- Use present tense and simple past tense only
- Include dialogue to make it engaging

Task 1: Write a fun, engaging short story (approx 200-300 words).
Protagonist: ${character.name} (${character.description})
Setting: ${setting.name} (${setting.description})

IMPORTANT: The story MUST naturally incorporate these English words that the student just learned:
${wordsList}

Use these words naturally in the story context. Make sure each word appears at least once in a meaningful way.

Vocabulary Guidelines:
- Use only high-frequency words (top 1000-2000 most common English words)
- Avoid idioms, phrasal verbs, or slang
- Define any necessary advanced words through context
- Repeat key vocabulary words 2-3 times throughout the story for reinforcement

Task 2: Create a reading comprehension quiz based on the story.
- 3 to 5 questions.
- Each question must have exactly 4 options.
- At least one question should test understanding of the vocabulary words used.
- Questions should be simple and direct.
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
- Story should be exciting, positive, and age-appropriate
- Use clear, simple language suitable for 8-10 year old ESL learners
- Return ONLY valid JSON, no markdown formatting.
`;

    // 调用 Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate story', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json(
        { error: 'No content generated from API' },
        { status: 500 }
      );
    }

    // 解析 JSON（可能包含 markdown 代码块）
    let json;
    try {
      // 尝试直接解析
      json = JSON.parse(text);
    } catch (e) {
      // 如果失败，尝试提取 JSON（可能在 markdown 代码块中）
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        json = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }

    return NextResponse.json({
      title: json.title || `The Adventure of ${character.name}`,
      content: json.content || 'Story generation failed to format correctly.',
      quiz: json.quiz || [],
    });
  } catch (error: any) {
    console.error('Story generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate story', details: error.message },
      { status: 500 }
    );
  }
}
