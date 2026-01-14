import { NextResponse } from 'next/server';

/**
 * 使用免费的在线翻译服务翻译单词
 * 使用 MyMemory Translation API (免费，无需API密钥)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word');
    const lang = searchParams.get('lang') || 'zh'; // 默认翻译为中文

    if (!word) {
      return NextResponse.json(
        { error: 'Word parameter is required' },
        { status: 400 }
      );
    }

    const cleanWord = word.trim().toLowerCase();
    
    // 如果单词太短（少于2个字符），直接返回
    if (cleanWord.length < 2) {
      return NextResponse.json({ 
        word: cleanWord, 
        translation: null 
      });
    }

    try {
      // 使用 MyMemory Translation API (免费服务)
      // API文档: https://mymemory.translated.net/doc
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanWord)}&langpair=en|${lang}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Translation API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.responseData && data.responseData.translatedText) {
        const translation = data.responseData.translatedText.trim();
        
        // 如果翻译结果和原文相同，可能没有找到翻译
        if (translation.toLowerCase() === cleanWord) {
          return NextResponse.json({ 
            word: cleanWord, 
            translation: null 
          });
        }
        
        return NextResponse.json({
          word: cleanWord,
          translation: translation,
        });
      }

      return NextResponse.json({ 
        word: cleanWord, 
        translation: null 
      });
    } catch (apiError: any) {
      console.error('Translation API error:', apiError);
      
      // 如果API失败，尝试使用Google Translate的免费接口（作为备用）
      try {
        const googleResponse = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURIComponent(cleanWord)}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          if (googleData && googleData[0] && googleData[0][0] && googleData[0][0][0]) {
            const translation = googleData[0][0][0].trim();
            if (translation.toLowerCase() !== cleanWord) {
              return NextResponse.json({
                word: cleanWord,
                translation: translation,
              });
            }
          }
        }
      } catch (googleError) {
        console.error('Google Translate fallback error:', googleError);
      }

      return NextResponse.json({ 
        word: cleanWord, 
        translation: null 
      });
    }
  } catch (error: any) {
    console.error('Translate error:', error);
    return NextResponse.json(
      { error: 'Failed to translate word', details: error.message },
      { status: 500 }
    );
  }
}
