# 紧急修复：无限递归错误

如果仍然遇到 `infinite recursion detected in policy for relation "profiles"` 错误，请按以下步骤操作：

## 方法 1：完全重置 RLS 策略（推荐）

1. 在 Supabase Dashboard 中打开 **SQL Editor**
2. 运行 `fix_rls_complete.sql` 文件中的所有 SQL
3. 这会：
   - 临时禁用所有 RLS
   - 删除所有现有策略
   - 重新启用 RLS
   - 创建新的简单策略（避免递归）

## 方法 2：临时禁用 RLS（仅用于测试）

如果急需让应用运行，可以临时禁用 RLS：

```sql
-- 临时禁用所有 RLS（仅用于测试和调试）
ALTER TABLE words DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_logs DISABLE ROW LEVEL SECURITY;
```

**警告**：这会允许所有认证用户访问所有数据，仅用于测试！

## 方法 3：检查外键约束

无限递归可能是因为 `profiles.parent_id` 的外键约束。检查并可能需要调整：

```sql
-- 查看外键约束
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'profiles';

-- 如果 parent_id 有外键约束，可能需要删除它（如果导致问题）
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_parent_id_fkey;
```

## 方法 4：使用服务端函数（高级）

如果 RLS 策略仍然有问题，可以考虑使用 PostgreSQL 函数来处理权限检查：

```sql
-- 创建一个函数来安全地获取用户资料
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  parent_id UUID,
  created_at TIMESTAMP
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.role,
    p.parent_id,
    p.created_at
  FROM profiles p
  WHERE p.id = user_uuid
    AND (p.id = auth.uid() OR true); -- 允许读取自己的或所有（根据需要调整）
END;
$$;
```

## 验证修复

运行以下查询验证策略是否正确：

```sql
-- 1. 检查所有策略
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 测试查询（使用你的用户ID）
SELECT * FROM profiles WHERE id = '79755c95-2d54-4a36-a019-d8f5ba3dd9b2';

-- 3. 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('words', 'user_progress', 'profiles', 'study_logs');
```

## 如果问题仍然存在

1. 检查 Supabase Dashboard 中的 **Authentication** > **Policies** 是否有其他策略
2. 检查是否有数据库触发器可能导致递归
3. 联系 Supabase 支持或查看 Supabase 日志获取更详细的错误信息


