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

    // 查询单词（不区分大小写）
    const { data, error } = await supabase
      .from('words')
      .select('word, translation')
      .ilike('word', word)
      .limit(1);

    if (error) {
      console.error('查询单词失败:', error);
      return NextResponse.json(
        { error: 'Failed to lookup word', details: error.message },
        { status: 500 }
      );
    }

    if (data && data.length > 0) {
      return NextResponse.json({
        word: data[0].word,
        translation: data[0].translation,
      });
    }

    // 如果没找到，返回 null
    return NextResponse.json({ word: null, translation: null });
  } catch (error: any) {
    console.error('Word lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup word', details: error.message },
      { status: 500 }
    );
  }
}
