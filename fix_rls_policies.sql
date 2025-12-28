-- 修复 RLS 策略，解决无限递归错误
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 删除所有旧策略
-- ============================================

-- user_progress 表
DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;

-- profiles 表
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read profiles by email" ON profiles;

-- study_logs 表
DROP POLICY IF EXISTS "Users can read own study logs" ON study_logs;
DROP POLICY IF EXISTS "Users can insert own study logs" ON study_logs;

-- words 表
DROP POLICY IF EXISTS "Allow authenticated users to read words" ON words;

-- ============================================
-- 2. 创建新策略（避免递归）
-- ============================================

-- words 表：允许所有认证用户读取
CREATE POLICY "Allow authenticated users to read words"
ON words
FOR SELECT
TO authenticated
USING (true);

-- user_progress 表：使用 auth.uid() 直接比较，不引用 profiles
CREATE POLICY "Users can read own progress"
ON user_progress
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own progress"
ON user_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own progress"
ON user_progress
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- profiles 表：使用 auth.uid() 直接比较，不引用自身
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- profiles 表：允许根据邮箱查找（用于关联家长功能）
-- 注意：这里允许读取，但实际应用中可以通过视图限制返回的字段
CREATE POLICY "Users can read profiles by email"
ON profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- study_logs 表：使用 auth.uid() 直接比较，不引用 profiles
CREATE POLICY "Users can read own study logs"
ON study_logs
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own study logs"
ON study_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

-- ============================================
-- 3. 验证策略
-- ============================================

-- 查看所有策略
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

