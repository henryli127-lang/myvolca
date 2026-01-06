-- 检查并修复 role 更新问题
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 检查当前的 check_role_update 函数
-- ============================================

SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'check_role_update';

-- ============================================
-- 2. 检查触发器
-- ============================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name = 'prevent_role_update';

-- ============================================
-- 3. 修复 check_role_update 函数
-- 允许从 NULL 更新到任何值（注册阶段）
-- ============================================

CREATE OR REPLACE FUNCTION check_role_update()
RETURNS TRIGGER AS $$
DECLARE
  profile_created_at TIMESTAMPTZ;
  time_since_creation INTERVAL;
BEGIN
  -- 如果是从 NULL 更新到任何值，允许（注册阶段）
  IF OLD.role IS NULL THEN
    RAISE NOTICE '允许更新 role: NULL -> %', NEW.role;
    RETURN NEW;
  END IF;
  
  -- 如果 role 没有改变，允许
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;
  
  -- 如果 role 从非 NULL 变为另一个非 NULL 值，检查是否在注册阶段
  -- 获取 profile 的创建时间
  SELECT created_at INTO profile_created_at
  FROM profiles
  WHERE id = NEW.id;
  
  -- 如果找不到创建时间，使用当前时间（安全起见，不允许更新）
  IF profile_created_at IS NULL THEN
    profile_created_at := NOW();
  END IF;
  
  -- 计算创建后经过的时间
  time_since_creation := NOW() - profile_created_at;
  
  -- 如果是在注册后的5分钟内，允许更新（注册阶段）
  IF time_since_creation <= INTERVAL '5 minutes' THEN
    RAISE NOTICE '允许在注册阶段更新 role: % -> % (创建后 % 分钟)', OLD.role, NEW.role, EXTRACT(EPOCH FROM time_since_creation) / 60;
    RETURN NEW;
  ELSE
    -- 超过5分钟，禁止更新
    RAISE EXCEPTION 'role 字段一旦设置后不能修改（注册阶段已过）';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. 验证函数
-- ============================================

SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'check_role_update';

-- ============================================
-- 5. 测试（可选）
-- ============================================

-- 测试：尝试从 NULL 更新到 'parent'（应该成功）
-- 注意：需要替换 'test-user-id' 为实际的用户 ID
-- UPDATE profiles SET role = 'parent' WHERE id = 'test-user-id' AND role IS NULL;


