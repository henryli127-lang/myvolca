-- 创建单词查询函数（不区分大小写）
-- 在 Supabase SQL Editor 中运行此脚本

-- 如果函数已存在，先删除
DROP FUNCTION IF EXISTS lookup_word_translation(TEXT);

-- 创建函数
CREATE OR REPLACE FUNCTION lookup_word_translation(p_word TEXT)
RETURNS TABLE(word TEXT, translation TEXT) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT w.word::TEXT, w.translation::TEXT
  FROM words w
  WHERE LOWER(TRIM(w.word)) = LOWER(TRIM(p_word))
  LIMIT 1;
END;
$$;

-- 授予权限给认证用户
GRANT EXECUTE ON FUNCTION lookup_word_translation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_word_translation(TEXT) TO anon;
