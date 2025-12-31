import { NextResponse } from 'next/server';
import crypto from 'crypto';
import WebSocket from 'ws';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { text, lang } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const voice = lang === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-AvaNeural';
    
    // 💡 2025 最新：必须使用这个特定格式的 ConnectionId
    const connectionId = crypto.randomUUID().replace(/-/g, '').toUpperCase();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;

    return await new Promise<NextResponse>((resolve: (value: NextResponse) => void) => {
      let resolved = false;
      const socket = new WebSocket(wsUrl, {
        headers: {
          // 🚨 2025 核心：微软现在强制检查这个特定的 Origin，否则直接 403/404
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
        console.log('WebSocket connected');
        connectionOpened = true;
        
        // 转义 XML 特殊字符
        const escapeXml = (str: string) => {
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        };

        try {
          // 🚨 2025 核心：消息头必须包含 X-Timestamp 且格式严丝合缝
          // ✅ 关键修复：添加 outputFormat 指定支持的音频格式（使用 24khz-48kbitrate，质量好且兼容）
          const configMsg = `X-Timestamp:${startTime}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataOptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"},"voice":{"cache":{"maxSize":1024,"maxAge":3600},"name":"${voice}"}}}}`;
          
          if (socket.readyState !== WebSocket.OPEN) {
            console.error('Socket not open when trying to send config');
            safeResolve(NextResponse.json({ error: 'Socket not ready' }, { status: 500 }));
            return;
          }

          try {
            socket.send(configMsg);
            console.log('Sent config message successfully');
          } catch (error: any) {
            console.error('Error sending config message:', error);
            safeResolve(NextResponse.json({ error: 'Failed to send config message', details: error.message }, { status: 500 }));
            return;
          }

          // 延迟发送 SSML，确保 config 先处理（增加延迟时间）
          setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN && !resolved) {
              try {
                const escapedText = escapeXml(text);
                const xmlLang = lang === 'zh' ? 'zh-CN' : 'en-US';
                const ssmlMsg = `X-Timestamp:${startTime}\r\nX-RequestId:${connectionId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapedText}</prosody></voice></speak>`;
                
                try {
                  socket.send(ssmlMsg);
                  console.log('Sent SSML message successfully, text length:', text.length);
                } catch (error: any) {
                  console.error('Error sending SSML message:', error);
                  if (!resolved) {
                    safeResolve(NextResponse.json({ error: 'Failed to send SSML message', details: error.message }, { status: 500 }));
                  }
                }
              } catch (error: any) {
                console.error('Error preparing SSML message:', error);
                if (!resolved) {
                  safeResolve(NextResponse.json({ error: 'Failed to prepare SSML message', details: error.message }, { status: 500 }));
                }
              }
            } else if (socket.readyState !== WebSocket.OPEN && !resolved) {
              console.error('Socket closed before sending SSML, state:', socket.readyState);
              safeResolve(NextResponse.json({ error: 'Socket closed before sending SSML' }, { status: 500 }));
            }
          }, 300); // 增加延迟到 300ms，给服务器更多时间处理 config
        } catch (error: any) {
          console.error('Error in open handler:', error);
          if (!resolved) {
            safeResolve(NextResponse.json({ error: 'Failed to send messages', details: error.message }, { status: 500 }));
          }
        }
      });

      socket.on('message', (data: Buffer | string, isBinary: boolean) => {
        // 统一转换为 Buffer 处理
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
        
        // 检查是否包含文本头部（Path:audio, Path:turn.end 等）
        const textStart = buffer.toString('utf8', 0, Math.min(200, buffer.length));
        
        if (textStart.includes('Path:audio')) {
          // 包含音频数据，需要提取纯音频部分
          const separator = Buffer.from('Path:audio\r\n');
          const index = buffer.indexOf(separator);
          if (index !== -1) {
            // 找到分隔符，提取后面的音频数据
            const audioChunk = buffer.slice(index + separator.length);
            // 进一步检查：如果音频数据前还有文本头部（如 X-RequestId），继续查找
            const audioStart = audioChunk.toString('utf8', 0, Math.min(100, audioChunk.length));
            if (audioStart.includes('X-RequestId') || audioStart.includes('Content-Type')) {
              // 还有文本头部，查找下一个 \r\n\r\n 或直接查找 MP3 帧头
              let audioDataStart = -1
              // 查找 MP3 帧头 (0xFF 0xFB 或 0xFF 0xFA)
              for (let i = 0; i < Math.min(500, audioChunk.length - 1); i++) {
                if (audioChunk[i] === 0xFF && (audioChunk[i + 1] & 0xE0) === 0xE0) {
                  audioDataStart = i
                  break
                }
              }
              if (audioDataStart > 0) {
                const pureAudio = audioChunk.slice(audioDataStart)
                audioData = Buffer.concat([audioData, pureAudio])
                console.log(`Extracted pure audio (trimmed ${audioDataStart} bytes), total size: ${audioData.length}`)
              } else {
                // 没找到 MP3 帧头，尝试查找 \r\n\r\n 后的数据
                const doubleNewline = Buffer.from('\r\n\r\n')
                const newlineIndex = audioChunk.indexOf(doubleNewline)
                if (newlineIndex !== -1) {
                  const pureAudio = audioChunk.slice(newlineIndex + doubleNewline.length)
                  audioData = Buffer.concat([audioData, pureAudio])
                  console.log(`Extracted audio after double newline, total size: ${audioData.length}`)
                } else {
                  // 如果都找不到，直接使用整个 chunk（可能已经是纯音频）
                  audioData = Buffer.concat([audioData, audioChunk])
                  console.log(`Using entire chunk (no separator found), total size: ${audioData.length}`)
                }
              }
            } else {
              // 没有额外的文本头部，直接使用
              audioData = Buffer.concat([audioData, audioChunk])
              console.log(`Received audio chunk (with Path:audio header), total size: ${audioData.length}`)
            }
          } else {
            // 没有找到 Path:audio 分隔符，可能是纯音频数据
            audioData = Buffer.concat([audioData, buffer])
            console.log(`Received audio data (no Path:audio header), total size: ${audioData.length}`)
          }
        } else if (textStart.includes('Path:turn.end')) {
          // 收到结束信号
          console.log('Received turn.end, closing connection');
          socket.close();
          if (audioData.length > 0) {
            // 验证音频数据是否有效（MP3 文件通常以 0xFF 0xFB 或 ID3 标签开头）
            const isValidAudio = audioData[0] === 0xFF || 
                                 (audioData[0] === 0x49 && audioData[1] === 0x44 && audioData[2] === 0x33) ||
                                 audioData.length > 100; // 如果数据足够大，假设有效
            
            if (!isValidAudio) {
              console.warn('Audio data may be invalid, first bytes:', audioData.slice(0, 10));
            }
            
            console.log(`Returning audio data, size: ${audioData.length}, first bytes:`, Array.from(audioData.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            safeResolve(new NextResponse(audioData, { 
              headers: { 
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
                'Accept-Ranges': 'bytes'
              } 
            }));
          } else {
            console.error('turn.end received but no audio data');
            safeResolve(NextResponse.json({ error: 'No audio data received' }, { status: 500 }));
          }
        } else if (textStart.includes('Path:error')) {
          // 收到错误消息
          const errorMsg = buffer.toString('utf8');
          console.error('Received error message:', errorMsg);
          socket.close();
          safeResolve(NextResponse.json({ error: 'TTS service error', details: errorMsg }, { status: 502 }));
        } else if (isBinary || buffer.length > 50) {
          // 可能是纯二进制音频数据（没有文本头部）
          audioData = Buffer.concat([audioData, buffer]);
          console.log(`Received binary data (likely audio), total size: ${audioData.length}`);
        } else {
          // 文本消息（可能是状态消息）
          const message = buffer.toString('utf8');
          console.log('Received text message:', message.substring(0, 200));
        }
      });

      socket.on('error', (err: any) => {
        console.error('WebSocket error:', err);
        if (!resolved) {
          socket.close();
          safeResolve(NextResponse.json({ error: 'WebSocket connection error', details: err.message }, { status: 502 }));
        }
      });

      socket.on('close', (code: number, reason: Buffer) => {
        console.log(`WebSocket closed: code=${code}, reason=${reason.toString()}, audioData.length=${audioData.length}, resolved=${resolved}`);
        
        // 如果连接已打开但还没有解析，检查是否有音频数据
        if (!resolved && connectionOpened) {
          if (audioData.length > 0) {
            // 有音频数据，返回它
            console.log(`Connection closed with audio data, returning ${audioData.length} bytes, first bytes:`, Array.from(audioData.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            safeResolve(new NextResponse(audioData, { 
              headers: { 
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
                'Accept-Ranges': 'bytes'
              } 
            }));
          } else {
            // 没有音频数据，返回错误
            console.warn('WebSocket closed without audio data');
            safeResolve(NextResponse.json({ error: 'Connection closed without audio data', code, reason: reason.toString() }, { status: 500 }));
          }
        }
      });

      // 连接超时检查
      setTimeout(() => {
        if (!connectionOpened) {
          console.error('WebSocket connection timeout - never opened');
          socket.close();
          safeResolve(NextResponse.json({ error: 'Connection timeout - failed to connect' }, { status: 504 }));
        }
      }, 5000);

      // 整体超时
      setTimeout(() => {
        if (!resolved) {
          console.error('Request timeout - no response received');
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
          if (audioData.length > 0) {
            // 即使超时，如果有音频数据也返回
            safeResolve(new NextResponse(audioData, { 
              headers: { 
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioData.length.toString(),
                // ✅ 新增：让浏览器缓存这个音频 1 年 (因为单词的发音是不会变的)
                'Cache-Control': 'public, max-age=31536000, immutable'
              } 
            }));
          } else {
            safeResolve(NextResponse.json({ error: 'Connection Timeout' }, { status: 504 }));
          }
        }
      }, 10000);
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}