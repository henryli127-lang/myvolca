-- 修复历史数据：更新那些 last_reviewed_at 晚于 updated_at 的记录
-- 将 updated_at 设置为 last_reviewed_at 的值
-- 这样可以修复之前测试时没有正确更新 updated_at 的记录

-- ============================================
-- 1. 查看需要修复的记录（预览）
-- ============================================
-- 先运行这个查询，查看有多少记录需要修复
SELECT 
    user_id,
    word_id,
    updated_at AS current_updated_at,
    last_reviewed_at,
    translation_errors,
    spelling_errors,
    status,
    CASE 
        WHEN last_reviewed_at > updated_at THEN '需要修复'
        ELSE '正常'
    END AS fix_status
FROM public.user_progress
WHERE last_reviewed_at IS NOT NULL
    AND last_reviewed_at > updated_at
ORDER BY last_reviewed_at DESC
LIMIT 100;  -- 限制显示前100条，查看效果

-- ============================================
-- 2. 统计需要修复的记录数量
-- ============================================
SELECT 
    COUNT(*) AS total_records_to_fix,
    COUNT(DISTINCT user_id) AS affected_users,
    COUNT(DISTINCT word_id) AS affected_words
FROM public.user_progress
WHERE last_reviewed_at IS NOT NULL
    AND last_reviewed_at > updated_at;

-- ============================================
-- 3. 执行修复（更新 updated_at）
-- ============================================
-- 将 last_reviewed_at 晚于 updated_at 的记录的 updated_at 更新为 last_reviewed_at
UPDATE public.user_progress
SET updated_at = last_reviewed_at
WHERE last_reviewed_at IS NOT NULL
    AND last_reviewed_at > updated_at;

-- ============================================
-- 4. 验证修复结果
-- ============================================
-- 检查是否还有需要修复的记录
SELECT 
    COUNT(*) AS remaining_records_to_fix
FROM public.user_progress
WHERE last_reviewed_at IS NOT NULL
    AND last_reviewed_at > updated_at;
-- 如果返回 0，说明所有记录都已修复

-- ============================================
-- 5. 查看修复后的记录示例
-- ============================================
SELECT 
    user_id,
    word_id,
    updated_at,
    last_reviewed_at,
    translation_errors,
    spelling_errors,
    status,
    CASE 
        WHEN updated_at = last_reviewed_at THEN '已修复'
        ELSE '异常'
    END AS status_check
FROM public.user_progress
WHERE last_reviewed_at IS NOT NULL
    AND updated_at = last_reviewed_at
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- 6. 按用户统计修复情况（可选）
-- ============================================
SELECT 
    user_id,
    COUNT(*) AS fixed_records,
    MIN(updated_at) AS earliest_fixed_date,
    MAX(updated_at) AS latest_fixed_date
FROM public.user_progress
WHERE last_reviewed_at IS NOT NULL
    AND updated_at = last_reviewed_at
    AND updated_at > created_at  -- 确保是修复后的记录
GROUP BY user_id
ORDER BY fixed_records DESC;
