import { NextResponse } from 'next/server';
import crypto from 'crypto';
import WebSocket from 'ws';

// 1. 改为 GET 方法
export async function GET(req: Request): Promise<NextResponse> {
  try {
    // 2. 从 URL 参数获取数据，而不是 req.json()
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const lang = searchParams.get('lang') || 'en';

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const voice = lang === 'zh' ? 'zh-CN-Liaoning-XiaobeiNeural' : 'en-US-AnaNeural';
    
    const connectionId = crypto.randomUUID().replace(/-/g, '').toUpperCase();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;

    return await new Promise<NextResponse>((resolve: (value: NextResponse) => void) => {
      let resolved = false;
      const socket = new WebSocket(wsUrl, {
        headers: {
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        }
      });

      let audioData = Buffer.alloc(0);
      const startTime = Date.now().toString();
      let connectionOpened = false;

      const safeResolve = (response: NextResponse): void => {
        if (!resolved) {
          resolved = true;
          resolve(response);
        }
      };

      socket.on('open', () => {
        // ... (保持原有的 WebSocket 发送逻辑不变) ...
        // ... 这里的代码完全复用之前的，不需要改动 ...
        
        // 为了节省篇幅，这里省略中间的 config 和 ssml 发送代码
        // 请保留你原来 socket.on('open') 里的所有逻辑
        // 记得把里面的 req.json() 相关的变量删掉，使用上面定义的 text 和 voice
        
        // --- 可以在这里把原来代码复制进去 ---
        const configMsg = `X-Timestamp:${startTime}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataOptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"},"voice":{"cache":{"maxSize":1024,"maxAge":3600},"name":"${voice}"}}}}`;
        socket.send(configMsg);

        setTimeout(() => {
            const ssmlMsg = `X-Timestamp:${startTime}\r\nX-RequestId:${connectionId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${text}</prosody></voice></speak>`;
            socket.send(ssmlMsg);
        }, 300);
      });

      socket.on('message', (data: Buffer | string, isBinary: boolean) => {
         // ... (保持原有的 message 处理逻辑不变) ...
         // ... 这里的代码完全复用之前的，不需要改动 ...
         
         // 重点：找到 safeResolve 返回音频的地方，确保 Cache-Control 存在
         // 在处理 Path:turn.end 的逻辑里：
         
         const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
         const textStart = buffer.toString('utf8', 0, Math.min(200, buffer.length));

         // ... (省略音频提取逻辑) ...
         if (isBinary || textStart.includes('Path:audio')) {
             // ... 你的音频拼接逻辑 ...
             if (textStart.includes('Path:audio')) {
                 const separator = Buffer.from('Path:audio\r\n');
                 const index = buffer.indexOf(separator);
                 if (index !== -1) {
                     audioData = Buffer.concat([audioData, buffer.slice(index + separator.length)]);
                 }
             } else {
                 audioData = Buffer.concat([audioData, buffer]);
             }
         } else if (textStart.includes('Path:turn.end')) {
             socket.close();
             if (audioData.length > 0) {
                 safeResolve(new NextResponse(audioData, { 
                   headers: { 
                     'Content-Type': 'audio/mpeg',
                     'Content-Length': audioData.length.toString(),
                     // ✅ 关键：GET 请求下，这个 Header 会让浏览器缓存文件一年
                     'Cache-Control': 'public, max-age=31536000, immutable'
                   } 
                 }));
             }
             // ...
         }
      });

      // ... (Error 和 Close 处理保持不变) ...
      
      socket.on('error', (err) => {
          if (!resolved) safeResolve(NextResponse.json({ error: 'WS Error' }, { status: 500 }));
      });
      
      setTimeout(() => {
          if (!resolved) safeResolve(NextResponse.json({ error: 'Timeout' }, { status: 504 }));
      }, 10000);
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}