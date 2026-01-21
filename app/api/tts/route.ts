import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

// 防止前端触发 405
export async function POST(req: Request) {
  return GET(req);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'en';

  if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

  try {
    // 1. 优先尝试 Edge TTS (高质量)
    const voice = lang === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-AnaNeural';
    const audioBuffer = await getEdgeAudioRaw(text, voice);

    return new NextResponse(audioBuffer as any, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    console.warn(`Edge TTS Failed (${error.message}), switching to Google TTS fallback...`);

    // 2. 灾备方案：如果 Edge 挂了，自动降级使用 Google TTS (虽然音质一般，但保证能用)
    try {
      const googleAudio = await getGoogleTTS(text, lang);
      return new NextResponse(googleAudio as any, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': googleAudio.length.toString(),
          'Cache-Control': 'no-cache', // 谷歌接口通常不建议长缓存
        },
      });
    } catch (googleError) {
      // 如果连谷歌都挂了，那才是真的完了
      return NextResponse.json(
        { error: 'All TTS services failed', details: error.message },
        { status: 500 }
      );
    }
  }
}

// Edge TTS 实现 (去除了所有多余 Header)
async function getEdgeAudioRaw(text: string, voice: string): Promise<Buffer> {
  const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WSS_URL, {
      headers: {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        // 使用已知最稳定的旧版 UA
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9"
        // 🔴 关键改动：彻底移除 Origin 头。不伪装成插件，也不伪装成必应官网。
      }
    });

    const chunks: Buffer[] = [];

    // 设置 10秒 超时，避免请求卡死
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Timeout"));
    }, 10000);

    ws.on('open', () => {
      const reqId = uuidv4().replace(/-/g, '');
      ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%'>${text}</prosody></voice></speak>`);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const buf = data as Buffer;
        const idx = buf.indexOf(Buffer.from("Path:audio\r\n"));
        if (idx !== -1) {
          const headEnd = buf.indexOf(Buffer.from("\r\n\r\n"), idx);
          if (headEnd !== -1) chunks.push(buf.subarray(headEnd + 4));
        }
      } else if (data.toString().includes("Turn.End")) {
        ws.close();
      }
    });

    ws.on('close', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on('unexpected-response', (req, res) => {
      clearTimeout(timer);
      reject(new Error(`Edge 403/Blocked: ${res.statusCode}`));
    });
  });
}

// 简单的 Google TTS 备用方案 (无需 Key，直接调用)
// 支持长文本，自动分块处理
async function getGoogleTTS(text: string, lang: string): Promise<Buffer> {
  const targetLang = lang === 'zh' ? 'zh-CN' : 'en';

  // 分块处理长文本 (Google TTS 限制约 200 字符)
  const chunks = splitTextIntoChunks(text, 180);

  // 并发获取所有音频块
  const audioBuffers = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${targetLang}&client=tw-ob`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google TTS Failed: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    })
  );

  // 合并所有音频块
  return Buffer.concat(audioBuffers);
}

// 将长文本拆分成固定长度的块，尽量在句子或单词边界切分
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 尝试在句号、问号、感叹号处切分
    let splitIndex = -1;
    const sentenceEnders = ['. ', '! ', '? ', '。', '！', '？', '；', '; '];

    for (const ender of sentenceEnders) {
      const idx = remaining.lastIndexOf(ender, maxLength);
      if (idx > 0 && idx > splitIndex) {
        splitIndex = idx + ender.length;
      }
    }

    // 如果找不到句子边界，尝试在逗号处切分
    if (splitIndex === -1) {
      const commas = [', ', '，', '、'];
      for (const comma of commas) {
        const idx = remaining.lastIndexOf(comma, maxLength);
        if (idx > 0 && idx > splitIndex) {
          splitIndex = idx + comma.length;
        }
      }
    }

    // 如果还是找不到，尝试在空格处切分
    if (splitIndex === -1) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
      if (splitIndex > 0) {
        splitIndex += 1; // 包含空格后的位置
      }
    }

    // 最后手段：强制在 maxLength 处切分
    if (splitIndex <= 0) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks.filter(chunk => chunk.length > 0);
}