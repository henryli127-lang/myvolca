-- 诊断测试记录保存问题
-- 用于检查某个学生某一天的测试记录是否完整保存

-- 参数说明：
--   :student_id - 学生用户ID (UUID)
--   :target_date - 目标日期 (DATE格式，例如 '2024-01-15')

-- ============================================
-- 1. 检查指定日期所有更新的 user_progress 记录
-- ============================================
-- 这会显示所有在指定日期更新的记录，包括学习和测试
SELECT 
    w.id AS word_id,
    w.word,
    w.translation,
    up.status,
    up.translation_errors,
    up.spelling_errors,
    up.updated_at,
    up.last_reviewed_at,
    up.created_at,
    CASE 
        WHEN up.translation_errors > 0 OR up.spelling_errors > 0 THEN '可能有测试错误'
        WHEN up.status = 'mastered' AND DATE(up.updated_at) = :target_date THEN '可能是测试掌握'
        WHEN DATE(up.created_at) = :target_date THEN '新学单词'
        ELSE '其他更新'
    END AS record_type
FROM user_progress up
INNER JOIN words w ON up.word_id = w.id
WHERE up.user_id = :student_id
    AND DATE(up.updated_at) = :target_date
ORDER BY up.updated_at DESC;

-- ============================================
-- 2. 检查是否有单词在指定日期被测试但没有记录
-- ============================================
-- 这个查询可以帮助识别可能遗漏的测试记录
-- 注意：这个查询需要知道测试的单词ID列表，需要手动替换

-- 示例：如果测试了7个单词，ID分别是 1,2,3,4,5,6,7
-- 替换下面的 IN (1,2,3,4,5,6,7) 为实际的单词ID列表

SELECT 
    w.id AS word_id,
    w.word,
    w.translation,
    CASE 
        WHEN up.id IS NULL THEN '❌ 没有 user_progress 记录'
        WHEN DATE(up.updated_at) != :target_date THEN '⚠️ 有记录但更新日期不匹配'
        ELSE '✅ 有记录且日期匹配'
    END AS status_check,
    up.updated_at,
    up.translation_errors,
    up.spelling_errors,
    up.status
FROM words w
LEFT JOIN user_progress up ON w.id = up.word_id AND up.user_id = :student_id
WHERE w.id IN (1, 2, 3, 4, 5, 6, 7)  -- ⚠️ 替换为实际的测试单词ID列表
ORDER BY w.id;

-- ============================================
-- 3. 检查测试记录的时间分布
-- ============================================
-- 帮助识别是否有单词在测试时没有被更新
SELECT 
    DATE(up.updated_at) AS update_date,
    EXTRACT(HOUR FROM up.updated_at) AS update_hour,
    COUNT(*) AS record_count,
    STRING_AGG(w.word, ', ' ORDER BY w.word) AS words
FROM user_progress up
INNER JOIN words w ON up.word_id = w.id
WHERE up.user_id = :student_id
    AND DATE(up.updated_at) = :target_date
GROUP BY DATE(up.updated_at), EXTRACT(HOUR FROM up.updated_at)
ORDER BY update_hour;

-- ============================================
-- 4. 对比学习记录和测试记录
-- ============================================
-- 检查是否有单词被学习但没有被测试（或反之）
WITH study_records AS (
    SELECT DISTINCT up.word_id
    FROM user_progress up
    WHERE up.user_id = :student_id
        AND DATE(COALESCE(up.last_reviewed_at, up.updated_at)) = :target_date
),
test_records AS (
    SELECT DISTINCT up.word_id
    FROM user_progress up
    WHERE up.user_id = :student_id
        AND DATE(up.updated_at) = :target_date
        AND (
            up.translation_errors IS NOT NULL 
            OR up.spelling_errors IS NOT NULL
            OR up.status = 'mastered'
        )
)
SELECT 
    w.id AS word_id,
    w.word,
    CASE 
        WHEN s.word_id IS NOT NULL AND t.word_id IS NOT NULL THEN '学习和测试都有'
        WHEN s.word_id IS NOT NULL THEN '只有学习记录'
        WHEN t.word_id IS NOT NULL THEN '只有测试记录'
        ELSE '没有记录'
    END AS record_status
FROM words w
LEFT JOIN study_records s ON w.id = s.word_id
LEFT JOIN test_records t ON w.id = t.word_id
WHERE s.word_id IS NOT NULL OR t.word_id IS NOT NULL
ORDER BY w.id;
