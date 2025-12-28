-- 修复 handle_new_user 触发器：确保不设置默认 role
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 检查当前的触发器函数
-- ============================================

-- 查看当前的 handle_new_user 函数
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- ============================================
-- 2. 重新创建函数：确保不设置 role
-- ============================================

-- 创建函数：自动创建用户资料（不设置 role，role 必须为 NULL）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULL  -- 明确设置为 NULL，不设置默认值
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. 确保触发器存在
-- ============================================

-- 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器：当新用户注册时自动创建 profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. 检查 profiles 表的默认值
-- ============================================

-- 查看 profiles 表的默认值（确保 role 没有默认值）
SELECT 
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'role';

-- ============================================
-- 5. 如果 role 有默认值，移除它
-- ============================================

-- 移除 role 字段的默认值（如果存在）
ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT;

-- ============================================
-- 6. 验证
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

-- 查看函数定义
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

