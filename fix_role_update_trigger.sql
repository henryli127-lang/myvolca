-- 修复角色更新触发器：允许在注册阶段（刚创建的用户）更新 role
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 修改 check_role_update 函数
-- 允许在注册后的短时间内（5分钟内）更新 role
-- ============================================

CREATE OR REPLACE FUNCTION check_role_update()
RETURNS TRIGGER AS $$
DECLARE
  profile_created_at TIMESTAMPTZ;
  time_since_creation INTERVAL;
BEGIN
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
  
  -- 如果旧记录的 role 不为 NULL，且新记录的 role 与旧记录不同
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    -- 如果是在注册后的5分钟内，允许更新（注册阶段）
    IF time_since_creation <= INTERVAL '5 minutes' THEN
      -- 允许更新，记录日志
      RAISE NOTICE '允许在注册阶段更新 role: % -> % (创建后 % 分钟)', OLD.role, NEW.role, EXTRACT(EPOCH FROM time_since_creation) / 60;
      RETURN NEW;
    ELSE
      -- 超过5分钟，禁止更新
      RAISE EXCEPTION 'role 字段一旦设置后不能修改（注册阶段已过）';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. 验证触发器
-- ============================================

-- 查看触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name = 'prevent_role_update';

-- ============================================
-- 3. 测试（可选，在测试环境中运行）
-- ============================================

-- 注意：以下测试需要在有测试用户的情况下运行
-- 测试1：尝试在注册后立即更新 role（应该成功）
-- UPDATE profiles SET role = 'parent' WHERE id = 'test-user-id' AND role = 'child';

-- 测试2：尝试在注册5分钟后更新 role（应该失败）
-- 需要等待5分钟后运行：
-- UPDATE profiles SET role = 'parent' WHERE id = 'test-user-id' AND role = 'child';


