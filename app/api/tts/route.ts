import { NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const lang = searchParams.get('lang') || 'en';

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // 根据语言选择语音角色
    const voice = lang === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-AnaNeural';
    
    // 初始化 TTS 实例
    const tts = new MsEdgeTTS();
    
    // 设置元数据 (声音和格式)
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // 生成音频流
    const { audioStream } = await tts.toStream(text);

    // 将流转换为 Buffer (Next.js Response 需要)
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        // 缓存一年，避免重复请求
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    console.error('TTS Route Error:', error);
    return NextResponse.json(
      { error: 'TTS Failed', details: error.message }, 
      { status: 500 }
    );
  }
}