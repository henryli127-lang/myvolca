-- 查询某个学生某一天的学习单词、测试记录和阅读记录
-- 参数说明：
--   :student_id - 学生用户ID (UUID)
--   :target_date - 目标日期 (DATE格式，例如 '2024-01-15')

-- ============================================
-- 1. 查询某一天的学习单词记录
-- ============================================
-- 基于 last_reviewed_at 或 updated_at 字段，获取该学生在指定日期学习的单词
SELECT 
    w.id AS word_id,
    w.word,
    w.translation,
    w.pos,
    up.status,
    up.translation_errors,
    up.spelling_errors,
    COALESCE(up.last_reviewed_at, up.updated_at) AS study_time,
    up.review_count
FROM user_progress up
INNER JOIN words w ON up.word_id = w.id
WHERE up.user_id = :student_id
    -- 筛选指定日期（使用 last_reviewed_at 或 updated_at）
    AND DATE(COALESCE(up.last_reviewed_at, up.updated_at)) = :target_date
ORDER BY COALESCE(up.last_reviewed_at, up.updated_at) DESC;

-- ============================================
-- 2. 查询某一天的测试记录
-- ============================================
-- 测试记录包括所有在指定日期测试过的单词（无论是否有错误）
-- 
-- 重要说明：
-- - 新学单词测试后会更新 updated_at 字段
-- - 复习单词测试后可能只更新 last_reviewed_at 字段，不更新 updated_at
-- - 因此需要同时检查 updated_at 和 last_reviewed_at 两个字段
SELECT 
    w.id AS word_id,
    w.word,
    w.translation,
    up.status,
    up.translation_errors,
    up.spelling_errors,
    COALESCE(up.last_reviewed_at, up.updated_at) AS test_time,
    up.updated_at,
    up.last_reviewed_at,
    CASE 
        WHEN up.translation_errors > 0 OR up.spelling_errors > 0 THEN 'tested_with_errors'
        WHEN up.status = 'mastered' THEN 'tested_mastered'
        ELSE 'tested_perfect'
    END AS test_type,
    CASE 
        WHEN DATE(up.last_reviewed_at) = :target_date AND DATE(up.updated_at) != :target_date THEN 'review_word'
        WHEN DATE(up.updated_at) = :target_date THEN 'new_word'
        ELSE 'other'
    END AS word_type
FROM user_progress up
INNER JOIN words w ON up.word_id = w.id
WHERE up.user_id = :student_id
    -- 筛选指定日期：同时检查 updated_at 和 last_reviewed_at
    -- 因为复习单词测试后可能只更新 last_reviewed_at 而不更新 updated_at
    AND (
        DATE(up.updated_at) = :target_date
        OR DATE(up.last_reviewed_at) = :target_date
    )
    -- 确保是测试记录（有错误记录或状态为mastered，或者last_reviewed_at在今天）
    -- 这样可以排除纯学习记录（只更新updated_at但没有测试）
    AND (
        up.translation_errors > 0 
        OR up.spelling_errors > 0 
        OR up.status = 'mastered'
        OR DATE(up.last_reviewed_at) = :target_date  -- 复习单词测试后会更新last_reviewed_at
    )
ORDER BY COALESCE(up.last_reviewed_at, up.updated_at) DESC;

-- ============================================
-- 3. 查询某一天的阅读记录
-- ============================================
-- 从 articles 表中获取该学生在指定日期创建或更新的文章
SELECT 
    id AS article_id,
    title,
    content,
    html_content,
    image_url,
    quiz,
    character,
    setting,
    created_at,
    updated_at
FROM articles
WHERE user_id = :student_id
    -- 筛选指定日期（基于创建时间或更新时间）
    AND (
        DATE(created_at) = :target_date
        OR DATE(updated_at) = :target_date
    )
ORDER BY created_at DESC;

-- ============================================
-- 4. 综合查询（一次性获取所有记录）
-- ============================================
-- 使用 UNION ALL 将三种记录合并，并添加类型标识
WITH daily_study_words AS (
    -- 学习单词记录
    SELECT 
        'study_word' AS record_type,
        w.id AS word_id,
        w.word,
        w.translation,
        NULL AS article_id,
        NULL AS title,
        up.status,
        up.translation_errors,
        up.spelling_errors,
        COALESCE(up.last_reviewed_at, up.updated_at) AS record_time,
        up.review_count
    FROM user_progress up
    INNER JOIN words w ON up.word_id = w.id
    WHERE up.user_id = :student_id
        AND DATE(COALESCE(up.last_reviewed_at, up.updated_at)) = :target_date
),
daily_test_records AS (
    -- 测试记录（包括所有在指定日期测试过的单词，无论是否有错误）
    -- 重要：复习单词测试后可能只更新 last_reviewed_at 而不更新 updated_at
    -- 因此需要同时检查 updated_at 和 last_reviewed_at 两个字段
    SELECT 
        'test_record' AS record_type,
        w.id AS word_id,
        w.word,
        w.translation,
        NULL AS article_id,
        NULL AS title,
        up.status,
        up.translation_errors,
        up.spelling_errors,
        COALESCE(up.last_reviewed_at, up.updated_at) AS record_time,
        NULL AS review_count
    FROM user_progress up
    INNER JOIN words w ON up.word_id = w.id
    WHERE up.user_id = :student_id
        -- 筛选指定日期：同时检查 updated_at 和 last_reviewed_at
        -- 因为复习单词测试后可能只更新 last_reviewed_at
        AND (
            DATE(up.updated_at) = :target_date
            OR DATE(up.last_reviewed_at) = :target_date
        )
        -- 确保是测试记录（有错误记录或状态为mastered，或者last_reviewed_at在今天）
        AND (
            up.translation_errors > 0 
            OR up.spelling_errors > 0 
            OR up.status = 'mastered'
            OR DATE(up.last_reviewed_at) = :target_date  -- 复习单词测试后会更新last_reviewed_at
        )
),
daily_reading_records AS (
    -- 阅读记录
    SELECT 
        'reading_record' AS record_type,
        NULL AS word_id,
        NULL AS word,
        NULL AS translation,
        id AS article_id,
        title,
        NULL AS status,
        NULL AS translation_errors,
        NULL AS spelling_errors,
        created_at AS record_time,
        NULL AS review_count
    FROM articles
    WHERE user_id = :student_id
        AND (
            DATE(created_at) = :target_date
            OR DATE(updated_at) = :target_date
        )
)
SELECT 
    record_type,
    word_id,
    word,
    translation,
    article_id,
    title,
    status,
    translation_errors,
    spelling_errors,
    record_time,
    review_count
FROM daily_study_words
UNION ALL
SELECT 
    record_type,
    word_id,
    word,
    translation,
    article_id,
    title,
    status,
    translation_errors,
    spelling_errors,
    record_time,
    review_count
FROM daily_test_records
UNION ALL
SELECT 
    record_type,
    word_id,
    word,
    translation,
    article_id,
    title,
    status,
    translation_errors,
    spelling_errors,
    record_time,
    review_count
FROM daily_reading_records
ORDER BY record_time DESC;

-- ============================================
-- 5. 统计查询（获取某一天的学习统计）
-- ============================================
SELECT 
    -- 学习单词统计
    COUNT(DISTINCT CASE 
        WHEN DATE(COALESCE(up.last_reviewed_at, up.updated_at)) = :target_date 
        THEN up.word_id 
    END) AS study_words_count,
    
    -- 测试记录统计（同时检查 updated_at 和 last_reviewed_at）
    COUNT(DISTINCT CASE 
        WHEN (
            DATE(up.updated_at) = :target_date 
            OR DATE(up.last_reviewed_at) = :target_date
        )
            AND (
                up.translation_errors > 0 
                OR up.spelling_errors > 0 
                OR up.status = 'mastered'
                OR DATE(up.last_reviewed_at) = :target_date  -- 复习单词测试后会更新last_reviewed_at
            )
        THEN up.word_id 
    END) AS test_records_count,
    
    -- 阅读记录统计
    COUNT(DISTINCT CASE 
        WHEN DATE(a.created_at) = :target_date OR DATE(a.updated_at) = :target_date
        THEN a.id 
    END) AS reading_records_count,
    
    -- 总错误数统计（同时检查 updated_at 和 last_reviewed_at）
    SUM(CASE 
        WHEN (
            DATE(up.updated_at) = :target_date 
            OR DATE(up.last_reviewed_at) = :target_date
        )
        THEN COALESCE(up.translation_errors, 0) + COALESCE(up.spelling_errors, 0)
        ELSE 0 
    END) AS total_errors,
    
    -- 掌握单词数统计（同时检查 updated_at 和 last_reviewed_at）
    COUNT(DISTINCT CASE 
        WHEN (
            DATE(up.updated_at) = :target_date 
            OR DATE(up.last_reviewed_at) = :target_date
        ) AND up.status = 'mastered'
        THEN up.word_id 
    END) AS mastered_words_count
FROM user_progress up
FULL OUTER JOIN articles a ON a.user_id = :student_id
WHERE up.user_id = :student_id OR a.user_id = :student_id;
