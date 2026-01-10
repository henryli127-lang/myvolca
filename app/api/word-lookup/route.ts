import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word');

    if (!word) {
      return NextResponse.json(
        { error: 'Word parameter is required' },
        { status: 400 }
      );
    }

    // 查询单词（不区分大小写）- 仅使用RPC函数
    const cleanWord = word.trim()
    console.log('API: 查询单词:', cleanWord);
    
    // 使用RPC函数进行不区分大小写匹配
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('lookup_word_translation', {
        p_word: cleanWord
      });

      if (rpcError) {
        console.error('API: RPC函数错误:', rpcError.message || rpcError);
        return NextResponse.json(
          { error: 'Failed to lookup word', details: rpcError.message },
          { status: 500 }
        );
      }

      if (rpcData) {
        // RPC函数可能返回数组或单个对象
        const result = Array.isArray(rpcData) ? (rpcData.length > 0 ? rpcData[0] : null) : rpcData;
        if (result && result.word && result.translation) {
          console.log('API: RPC函数找到单词:', { word: result.word, translation: result.translation });
          return NextResponse.json({
            word: result.word,
            translation: result.translation,
          });
        }
      }

      // 如果没找到，返回 null
      console.log('API: 未找到单词:', cleanWord);
      return NextResponse.json({ word: null, translation: null });
    } catch (rpcErr: any) {
      console.error('API: RPC函数异常:', rpcErr.message);
      return NextResponse.json(
        { error: 'Failed to lookup word', details: rpcErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Word lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup word', details: error.message },
      { status: 500 }
    );
  }
}
