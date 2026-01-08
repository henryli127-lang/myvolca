-- 数据库约束和策略设置
-- 在 Supabase SQL Editor 中运行此脚本

-- ============================================
-- 1. 禁止更新 role 字段的约束
-- ============================================

-- 创建一个函数来检查 role 是否可以被更新
-- 只有在 role 为 NULL 时（新创建）才允许设置，之后禁止修改
CREATE OR REPLACE FUNCTION check_role_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果旧记录的 role 不为 NULL，且新记录的 role 与旧记录不同，则禁止更新
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role 字段一旦设置后不能修改';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS prevent_role_update ON profiles;
CREATE TRIGGER prevent_role_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_role_update();

-- ============================================
-- 2. 更新 RLS 策略：禁止更新 role 字段
-- ============================================

-- 删除旧的更新策略
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- 创建新的更新策略：允许更新，但 role 字段的更新会被触发器阻止
CREATE POLICY "profiles_update_policy"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. 验证约束
-- ============================================

-- 测试：尝试更新 role（应该失败）
-- UPDATE profiles SET role = 'parent' WHERE id = auth.uid() AND role = 'child';
-- 预期结果：错误 "role 字段一旦设置后不能修改"

-- ============================================
-- 4. 查看触发器和约束
-- ============================================

-- 查看触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- 查看策略
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';



