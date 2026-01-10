import { NextResponse } from 'next/server';

interface StoryImageRequest {
  title: string;
  content: string;
  character: {
    name: string;
    description: string;
  };
  setting: {
    name: string;
    description: string;
  };
}

export async function POST(req: Request) {
  try {
    const body: StoryImageRequest = await req.json();
    const { title, content, character, setting } = body;

    const apiKey = process.env.GEMINI_API_IMG_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_IMG_KEY not configured' },
        { status: 500 }
      );
    }

    // 构建图片生成提示词
    const prompt = `
Create a 16:9 aspect ratio cartoon illustration based on this children's story.

Story Title: ${title}

Main Character: ${character.name} - ${character.description}
Setting: ${setting.name} - ${setting.description}

Story Content:
${content.substring(0, 500)}${content.length > 500 ? '...' : ''}

Requirements:
- Cartoon style illustration suitable for 8-10 year old children
- 16:9 aspect ratio (wide format)
- Bright, cheerful, and age-appropriate
- Should capture the main theme or a key scene from the story
- Include the main character and setting elements
- Safe and positive imagery
`;

    // 调用 Gemini Image Generation API
    // 使用 gemini-2.5-flash-image 模型
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
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
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: '16:9',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Image API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate image', details: errorText },
        { status: response.status }
      );
    }

    // 检查响应类型
    const contentType = response.headers.get('content-type');
    
    if (contentType?.startsWith('image/')) {
      // 如果直接返回图片，读取为blob
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      return NextResponse.json({
        imageData: base64Image,
        mimeType: contentType || 'image/png',
      });
    }
    
    // 尝试解析JSON响应
    const data = await response.json();
    
    // Gemini Image API 返回的图片可能在 candidates[0].content.parts 中
    const imagePart = data.candidates?.[0]?.content?.parts?.find((part: any) => 
      part.inlineData || part.image || part.imageData
    );
    
    if (imagePart?.inlineData) {
      // 返回 base64 图片数据
      return NextResponse.json({
        imageData: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      });
    }
    
    if (imagePart?.image || imagePart?.imageData) {
      // 其他可能的图片数据格式
      return NextResponse.json({
        imageData: imagePart.image || imagePart.imageData,
        mimeType: 'image/png',
      });
    }

    // 如果没有找到图片数据，检查是否有URL
    const imageUrl = data.imageUrl || data.url || data.image_url;
    if (imageUrl) {
      return NextResponse.json({
        imageUrl: imageUrl,
      });
    }

    return NextResponse.json(
      { error: 'No image generated from API', response: data },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Story image generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate story image', details: error.message },
      { status: 500 }
    );
  }
}
