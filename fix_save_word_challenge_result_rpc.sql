-- 修复 save_word_challenge_result RPC 函数
-- 确保测试时同时更新 updated_at 和 last_reviewed_at 字段
-- 这样无论是新学单词还是复习单词，测试后都会更新 updated_at

-- ============================================
-- 删除旧函数（如果存在）
-- ============================================
DROP FUNCTION IF EXISTS public.save_word_challenge_result(BIGINT, INTEGER, INTEGER, TEXT);

-- ============================================
-- 创建修复后的函数
-- ============================================
CREATE OR REPLACE FUNCTION public.save_word_challenge_result(
    p_word_id BIGINT,
    p_trans_errors INTEGER,
    p_spell_errors INTEGER,
    p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_progress (
        user_id, 
        word_id, 
        translation_errors, 
        spelling_errors, 
        status, 
        last_reviewed_at,
        updated_at,
        created_at
    )
    VALUES (
        auth.uid(), 
        p_word_id, 
        p_trans_errors, 
        p_spell_errors, 
        p_status, 
        NOW(),
        NOW(),  -- ✅ 新学单词时也设置 updated_at
        NOW()
    )
    ON CONFLICT (user_id, word_id) 
    DO UPDATE SET 
        translation_errors = public.user_progress.translation_errors + EXCLUDED.translation_errors,
        spelling_errors = public.user_progress.spelling_errors + EXCLUDED.spelling_errors,
        status = EXCLUDED.status,
        last_reviewed_at = NOW(),
        updated_at = NOW();  -- ✅ 修复：复习单词测试时也更新 updated_at
END;
$$;

-- ============================================
-- 授予权限
-- ============================================
GRANT EXECUTE ON FUNCTION public.save_word_challenge_result(BIGINT, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_word_challenge_result(BIGINT, INTEGER, INTEGER, TEXT) TO anon;

-- ============================================
-- 验证函数
-- ============================================
-- 查看函数定义
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'save_word_challenge_result';
