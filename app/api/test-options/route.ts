import { NextResponse } from 'next/server';

// Fisher-Yates 洗牌算法：随机排列数组
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface TestWordsRequest {
  words: Array<{
    word: string;
    translation: string;
  }>;
}

export async function POST(req: Request) {
  try {
    const body: TestWordsRequest = await req.json();
    const { words } = body;

    if (!words || words.length === 0) {
      return NextResponse.json(
        { error: 'Words array is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // 构建单词列表字符串
    const wordsList = words.map(w => `- ${w.word} (${w.translation})`).join('\n');

    const prompt = `
You are a teacher creating multiple-choice questions for ESL students (8-10 years old).

Task: Generate multiple-choice options for translation and spelling tests.

For each word, provide:
1. Translation test options: 4 Chinese translation options (one correct, three distractors)
2. Spelling test options: 4 English word options (one correct, three distractors)

Guidelines:
- Distractors should be plausible but clearly wrong
- Options should be simple and age-appropriate
- For translation: distractors should be similar-sounding or related words
- For spelling: distractors should have similar spelling patterns but be different words

Words to generate options for:
${wordsList}

Output JSON Format:
{
  "options": [
    {
      "word": "example",
      "translation": "例子",
      "translationOptions": ["例子", "练习", "考试", "作业"],
      "translationCorrectIndex": 0,
      "spellingOptions": ["example", "exemple", "exampel", "exampul"],
      "spellingCorrectIndex": 0
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.
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
        { error: 'Failed to generate options', details: errorText },
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

    // 随机排列选项并更新正确答案索引
    const shuffledOptions = (json.options || []).map((option: any) => {
      // 随机排列翻译选项
      const translationOptions = [...(option.translationOptions || [])];
      const translationCorrectAnswer = translationOptions[option.translationCorrectIndex || 0];
      const translationShuffled = shuffleArray([...translationOptions]);
      const translationCorrectIndex = translationShuffled.findIndex(opt => opt === translationCorrectAnswer);

      // 随机排列拼写选项
      const spellingOptions = [...(option.spellingOptions || [])];
      const spellingCorrectAnswer = spellingOptions[option.spellingCorrectIndex || 0];
      const spellingShuffled = shuffleArray([...spellingOptions]);
      const spellingCorrectIndex = spellingShuffled.findIndex(opt => opt === spellingCorrectAnswer);

      return {
        ...option,
        translationOptions: translationShuffled,
        translationCorrectIndex: translationCorrectIndex >= 0 ? translationCorrectIndex : 0,
        spellingOptions: spellingShuffled,
        spellingCorrectIndex: spellingCorrectIndex >= 0 ? spellingCorrectIndex : 0,
      };
    });

    return NextResponse.json({
      options: shuffledOptions,
    });
  } catch (error: any) {
    console.error('Test options generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate test options', details: error.message },
      { status: 500 }
    );
  }
}
