# Supabase 触发器设置说明

## 自动创建 Profile 的触发器

触发器应该在用户注册时自动创建 profile，但**不设置 role**（role 由前端在注册时根据用户选择设置）。

### 推荐的触发器实现

```sql
-- 创建函数：自动创建用户资料（不设置 role）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (
    NEW.id,
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：当新用户注册时自动创建 profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 重要说明

1. **不设置 role**：触发器只创建基础信息（id, email），role 留空（NULL）
2. **前端设置 role**：注册时，前端根据用户选择的角色（child/parent）设置 role
3. **role 锁定**：一旦 role 被设置，数据库触发器会阻止后续修改

### 验证触发器

```sql
-- 查看触发器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth';

-- 测试：创建一个测试用户（在 Supabase Dashboard 的 Authentication 中手动创建）
-- 然后检查 profiles 表是否自动创建了记录
SELECT * FROM profiles WHERE email = 'test@example.com';
```

## 数据库约束设置

运行 `database_constraints.sql` 文件来设置：
- 禁止更新 role 字段的触发器
- 相关的 RLS 策略

## 完整设置流程

1. **设置触发器**（运行上面的 SQL）
2. **设置数据库约束**（运行 `database_constraints.sql`）
3. **设置 RLS 策略**（运行 `fix_rls_complete.sql`）

完成以上步骤后，注册流程将按以下方式工作：

1. 用户注册 → Supabase Auth 创建用户
2. 触发器自动创建 profile（id, email，role 为 NULL）
3. 前端根据用户选择的角色设置 role
4. 如果是家长，前端关联孩子的 parent_id
5. role 被锁定，无法再修改


