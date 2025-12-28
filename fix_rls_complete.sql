-- 完全修复 RLS 策略，解决无限递归错误
-- 在 Supabase SQL Editor 中运行此脚本
-- 注意：这会删除所有现有策略并重新创建

-- ============================================
-- 步骤 1: 完全禁用 RLS（临时）
-- ============================================

ALTER TABLE words DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 步骤 2: 删除所有现有策略
-- ============================================

-- 删除 words 表的所有策略
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'words') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON words';
    END LOOP;
END $$;

-- 删除 user_progress 表的所有策略
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_progress') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_progress';
    END LOOP;
END $$;

-- 删除 profiles 表的所有策略
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
END $$;

-- 删除 study_logs 表的所有策略
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'study_logs') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON study_logs';
    END LOOP;
END $$;

-- ============================================
-- 步骤 3: 重新启用 RLS
-- ============================================

ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 步骤 4: 创建新的简单策略（避免递归）
-- ============================================

-- words 表：允许所有认证用户读取
CREATE POLICY "words_select_policy"
ON words
FOR SELECT
TO authenticated
USING (true);

-- user_progress 表：使用简单的 UUID 比较
CREATE POLICY "user_progress_select_policy"
ON user_progress
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

CREATE POLICY "user_progress_insert_policy"
ON user_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "user_progress_update_policy"
ON user_progress
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- profiles 表：使用简单的 UUID 比较，不引用任何其他表
CREATE POLICY "profiles_select_own_policy"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- profiles 表：允许根据邮箱查找（用于关联家长）
-- 注意：这个策略允许读取，但实际应用中应该限制返回的字段
CREATE POLICY "profiles_select_by_email_policy"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert_policy"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- study_logs 表：使用简单的 UUID 比较
CREATE POLICY "study_logs_select_policy"
ON study_logs
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

CREATE POLICY "study_logs_insert_policy"
ON study_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

-- ============================================
-- 步骤 5: 验证策略
-- ============================================

-- 查看所有策略
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 测试查询（应该能正常工作）
-- SELECT auth.uid() as current_user;
-- SELECT COUNT(*) FROM words;
-- SELECT * FROM profiles WHERE id = auth.uid();

