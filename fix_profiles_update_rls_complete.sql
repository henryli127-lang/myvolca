-- 完全修复 profiles 表的 UPDATE RLS 策略
-- 解决 406 错误问题
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 检查当前的 RLS 状态和策略
-- ============================================

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'profiles';

-- 查看所有现有的 UPDATE 策略
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'UPDATE';

-- ============================================
-- 2. 删除所有现有的 UPDATE 策略
-- ============================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- ============================================
-- 3. 确保 RLS 已启用
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. 创建新的 UPDATE 策略（简化版本）
-- ============================================

-- 策略：允许用户更新自己的 profile
-- 使用简单的 auth.uid() = id 检查，避免递归
CREATE POLICY "profiles_update_own"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)  -- 只能更新自己的记录
WITH CHECK (auth.uid() = id);  -- 更新后的记录仍然必须是自己的

-- ============================================
-- 5. 验证策略
-- ============================================

-- 查看新创建的策略
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'UPDATE';

-- 应该看到：
-- policyname: profiles_update_own
-- cmd: UPDATE
-- qual: (auth.uid() = id)
-- with_check: (auth.uid() = id)

-- ============================================
-- 6. 检查是否有其他策略冲突
-- ============================================

-- 查看所有 profiles 表的策略
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- ============================================
-- 7. 如果仍然有 406 错误，尝试临时禁用 RLS 测试
-- ============================================

-- 注意：这只是用于调试，不要在生产环境中使用
-- 临时禁用 RLS
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 测试更新操作
-- UPDATE profiles SET role = 'parent' WHERE id = auth.uid() AND role IS NULL;

-- 重新启用 RLS
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. 检查 auth.uid() 是否正常工作
-- ============================================

-- 在 Supabase Dashboard 的 SQL Editor 中，以认证用户身份运行：
-- SELECT auth.uid(), id FROM profiles WHERE id = auth.uid();
-- 
-- 如果 auth.uid() 返回 NULL，说明用户未正确认证
-- 如果 auth.uid() 与 id 不匹配，说明认证状态有问题

-- ============================================
-- 9. 如果问题仍然存在，检查触发器
-- ============================================

-- 检查是否有触发器阻止了更新
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND event_manipulation = 'UPDATE';

-- 如果看到 prevent_role_update 触发器，确保它允许从 NULL 更新
-- 运行 check_and_fix_role_update.sql 来修复


