-- 修复 profiles 表的 UPDATE RLS 策略
-- 解决 406 错误和 PGRST116 错误
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 检查当前的 UPDATE 策略
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'UPDATE';

-- ============================================
-- 2. 删除旧的 UPDATE 策略
-- ============================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;

-- ============================================
-- 3. 创建新的 UPDATE 策略
-- ============================================

-- 策略：允许用户更新自己的 profile
-- 注意：使用 auth.uid() 直接比较，避免引用 profiles 表导致递归
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)  -- 只能更新自己的记录
WITH CHECK (auth.uid() = id);  -- 更新后的记录仍然必须是自己的

-- ============================================
-- 4. 验证策略
-- ============================================

-- 查看新创建的策略
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'UPDATE';

-- ============================================
-- 5. 测试（可选）
-- ============================================

-- 注意：以下测试需要在有认证用户的情况下运行
-- 测试更新自己的 profile（应该成功）
-- UPDATE profiles SET role = 'parent' WHERE id = auth.uid() AND role IS NULL;

-- 测试更新别人的 profile（应该失败）
-- UPDATE profiles SET role = 'parent' WHERE id = 'other-user-id';

-- ============================================
-- 6. 如果仍然有 406 错误，检查以下内容
-- ============================================

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'profiles';

-- 如果 rowsecurity = false，说明 RLS 被禁用了
-- 如果 rowsecurity = true，检查策略是否正确

-- 检查是否有其他策略冲突
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- ============================================
-- 7. 临时调试：查看实际执行的查询
-- ============================================

-- 在 Supabase Dashboard 的 Logs 中查看实际的 SQL 查询
-- 检查是否有权限错误或其他问题



