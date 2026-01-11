-- 修复 get_learning_history RPC 函数
-- 解决 last_reviewed_at 为 null 的记录无法显示的问题
-- 在 Supabase SQL Editor 中运行此脚本

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_learning_history(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

-- 创建修复后的函数
-- 如果 last_reviewed_at 为 null，使用 updated_at 作为备用时间字段
CREATE OR REPLACE FUNCTION get_learning_history(
    p_user_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    word_id INTEGER,
    word TEXT,
    translation TEXT,
    translation_errors INTEGER,
    spelling_errors INTEGER,
    status TEXT,
    last_reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id as word_id,
        w.word,
        w.translation,
        up.translation_errors,
        up.spelling_errors,
        up.status,
        -- 如果 last_reviewed_at 为 null，使用 updated_at 作为备用
        COALESCE(up.last_reviewed_at, up.updated_at) as last_reviewed_at
    FROM public.user_progress up
    JOIN public.words w ON up.word_id = w.id
    WHERE up.user_id = p_user_id
    -- 使用 COALESCE 进行日期筛选：如果 last_reviewed_at 为 null，使用 updated_at
    AND COALESCE(up.last_reviewed_at, up.updated_at) >= p_start_date
    AND COALESCE(up.last_reviewed_at, up.updated_at) <= p_end_date
    ORDER BY COALESCE(up.last_reviewed_at, up.updated_at) DESC;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION get_learning_history(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_learning_history(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
