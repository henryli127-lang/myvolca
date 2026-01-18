-- 查询学生今天的学习单词记录
-- 学生ID: 21fa466b-9d99-4e62-a172-3daa34ba6a56
-- 日期: 今天 (CURRENT_DATE)

SELECT 
    w.id AS word_id,
    w.word AS 单词,
    w.translation AS 翻译,
    w.pos AS 词性,
    up.status AS 状态,
    up.translation_errors AS 翻译错误数,
    up.spelling_errors AS 拼写错误数,
    COALESCE(up.last_reviewed_at, up.updated_at) AS 学习时间,
    up.review_count AS 复习次数,
    up.created_at AS 首次学习时间
FROM user_progress up
INNER JOIN words w ON up.word_id = w.id
WHERE up.user_id = '21fa466b-9d99-4e62-a172-3daa34ba6a56'
    -- 筛选今天的学习记录（使用 last_reviewed_at 或 updated_at）
    AND DATE(COALESCE(up.last_reviewed_at, up.updated_at)) = CURRENT_DATE
ORDER BY COALESCE(up.last_reviewed_at, up.updated_at) DESC;

-- ============================================
-- 统计信息
-- ============================================
SELECT 
    COUNT(*) AS 今天学习单词总数,
    COUNT(CASE WHEN up.status = 'mastered' THEN 1 END) AS 已掌握单词数,
    COUNT(CASE WHEN up.status = 'learning' THEN 1 END) AS 学习中单词数,
    SUM(COALESCE(up.translation_errors, 0)) AS 翻译错误总数,
    SUM(COALESCE(up.spelling_errors, 0)) AS 拼写错误总数,
    AVG(up.review_count) AS 平均复习次数
FROM user_progress up
WHERE up.user_id = '21fa466b-9d99-4e62-a172-3daa34ba6a56'
    AND DATE(COALESCE(up.last_reviewed_at, up.updated_at)) = CURRENT_DATE;
