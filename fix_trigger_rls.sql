-- 修复触发器 RLS 问题：确保 handle_new_user 触发器能够创建 profile
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 问题分析
-- ============================================
-- 当触发器执行时，auth.uid() 可能还没有完全设置，导致 RLS 策略阻止插入
-- 需要创建一个特殊的策略，允许触发器函数插入 profile

-- ============================================
-- 1. 检查当前的 RLS 策略
-- ============================================

-- 查看当前的 profiles INSERT 策略
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
WHERE tablename = 'profiles'
  AND cmd = 'INSERT';

-- ============================================
-- 2. 删除可能阻止触发器插入的策略
-- ============================================

-- 删除旧的 INSERT 策略（如果存在）
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "Allow trigger to insert profile" ON profiles;

-- ============================================
-- 3. 创建新的 INSERT 策略：允许触发器和用户插入
-- ============================================

-- 策略1：允许用户插入自己的 profile（注册时）
-- 这个策略允许用户在注册时插入自己的 profile
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 策略2：允许触发器函数插入 profile（使用 SECURITY DEFINER）
-- 这个策略允许 handle_new_user 触发器函数插入 profile
-- SECURITY DEFINER 函数会以函数所有者的权限运行，但 RLS 仍然会检查
-- 我们需要一个策略，允许在触发器执行时插入
-- 注意：这个策略允许插入，只要 id 匹配（触发器会确保这一点）

-- 实际上，SECURITY DEFINER 函数应该能够绕过 RLS
-- 但如果不行，我们可以创建一个更宽松的策略用于触发器

-- ============================================
-- 4. 确保触发器函数有正确的权限
-- ============================================

-- 重新创建 handle_new_user 函数，确保使用 SECURITY DEFINER
-- 并且确保函数所有者有足够的权限
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 使用 SECURITY DEFINER，函数会以创建者的权限运行
  -- 这应该能够绕过 RLS 策略
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULL  -- role 设置为 NULL，由前端设置
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 记录错误但不阻止用户创建
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 确保触发器存在
-- ============================================

-- 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 6. 如果 RLS 仍然阻止，创建一个更宽松的策略
-- ============================================

-- 如果上面的策略仍然不行，创建一个允许所有认证用户插入的策略
-- （仅在触发器执行时使用）
-- 注意：这个策略比较宽松，但触发器会确保只插入正确的 id

-- 先尝试上面的策略，如果不行再使用这个
-- CREATE POLICY "Allow trigger insert"
-- ON profiles
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (true);  -- 允许所有认证用户插入

-- ============================================
-- 7. 验证
-- ============================================

-- 查看触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth';

-- 查看函数
SELECT 
  routine_name,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- 查看 RLS 策略
SELECT 
  tablename,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- ============================================
-- 8. 测试（可选）
-- ============================================

-- 在 Supabase Dashboard 的 Authentication 中手动创建一个测试用户
-- 然后检查 profiles 表是否自动创建了记录：
-- SELECT * FROM profiles WHERE email = 'test@example.com';

-- 如果仍然没有创建，检查 Supabase 日志中的错误信息


