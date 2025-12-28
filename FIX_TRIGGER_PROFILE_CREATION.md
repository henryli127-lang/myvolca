# 修复触发器未创建 Profile 和角色更新失败的问题

## 问题描述

1. **触发器未创建 Profile**：新注册的用户在 `auth.users` 表中创建成功，但在 `profiles` 表中没有创建对应的记录。
2. **角色更新失败**：家长注册时，更新 role 返回 406 错误和 PGRST116 错误（0 rows）。

## 原因分析

1. **RLS 策略阻止触发器插入**：虽然触发器函数使用了 `SECURITY DEFINER`，但 RLS 策略可能仍然阻止了插入操作
2. **触发器执行时机问题**：在用户注册时，`auth.uid()` 可能还没有完全设置，导致 RLS 策略检查失败
3. **触发器函数权限不足**：函数可能没有足够的权限绕过 RLS
4. **UPDATE RLS 策略问题**：更新 role 时返回 406 错误，说明 RLS 策略可能阻止了 UPDATE 操作
5. **查询返回 0 行**：PGRST116 错误表示更新操作没有匹配到任何行，或更新后没有返回数据

## 解决方案

### 步骤 1：运行修复脚本

在 Supabase SQL Editor 中运行以下脚本（按顺序）：

1. **`fix_trigger_rls.sql`**：
   ```sql
   -- 这个脚本会：
   -- 1. 重新创建 handle_new_user 函数，确保使用 SECURITY DEFINER 和正确的权限
   -- 2. 修复 RLS 策略，确保触发器能够插入 profile
   -- 3. 添加错误处理，即使插入失败也不会阻止用户创建
   ```

2. **`fix_profiles_update_rls.sql`**：
   ```sql
   -- 这个脚本会：
   -- 1. 修复 profiles 表的 UPDATE RLS 策略
   -- 2. 确保用户能够更新自己的 profile（包括 role 字段）
   -- 3. 解决 406 错误和 PGRST116 错误
   ```

### 步骤 2：验证触发器配置

运行以下 SQL 检查触发器是否正确配置：

```sql
-- 检查触发器是否存在
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth';

-- 检查函数定义
SELECT 
  routine_name,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- 应该看到：
-- security_type = 'DEFINER'（表示使用 SECURITY DEFINER）
```

### 步骤 3：检查 RLS 策略

```sql
-- 查看 profiles 表的 INSERT 策略
SELECT 
  tablename,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND cmd = 'INSERT';

-- 应该有一个策略允许用户插入自己的 profile
```

### 步骤 4：测试触发器

1. 在 Supabase Dashboard 的 Authentication 中手动创建一个测试用户
2. 检查 `profiles` 表是否自动创建了记录：
   ```sql
   SELECT * FROM profiles WHERE email = 'test@example.com';
   ```
3. 如果仍然没有创建，检查 Supabase 日志中的错误信息

## 前端备用方案

前端代码已经更新，包含备用方案：

1. **增加重试次数和等待时间**：从 5 次增加到 10 次，等待时间从 300ms 增加到 500ms
2. **手动创建 profile**：如果触发器在 3 次重试后仍未创建 profile，前端会尝试手动创建
3. **更好的错误提示**：如果所有尝试都失败，会显示更详细的错误信息

## 如果问题仍然存在

### 方案 A：检查 Supabase 日志

1. 在 Supabase Dashboard 中打开 "Logs" 或 "Database Logs"
2. 查找与 `handle_new_user` 或 `profiles` INSERT 相关的错误
3. 常见错误：
   - `permission denied`：RLS 策略问题
   - `violates foreign key constraint`：外键约束问题
   - `duplicate key value`：唯一约束冲突

### 方案 B：临时禁用 RLS（仅用于调试）

```sql
-- 临时禁用 profiles 表的 RLS（仅用于调试）
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 测试触发器是否工作
-- 创建一个测试用户，检查 profile 是否创建

-- 重新启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### 方案 C：使用 Service Role 创建 profile

如果触发器仍然不工作，可以创建一个 API 端点，使用 Service Role Key 来创建 profile：

```typescript
// app/api/create-profile/route.ts
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // 使用 Service Role Key
)

export async function POST(request: Request) {
  const { userId, email } = await request.json()
  
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: userId, email, role: null })
    .select()
    .single()
  
  return Response.json({ data, error })
}
```

## 预防措施

1. **监控触发器执行**：定期检查新注册用户是否都有对应的 profile
2. **添加数据库约束**：确保 `profiles.id` 是 `auth.users.id` 的外键（如果适用）
3. **添加应用层检查**：在用户登录时检查 profile 是否存在，如果不存在则创建

## 相关文件

- `fix_trigger_rls.sql`：修复触发器 RLS 问题的 SQL 脚本
- `fix_handle_new_user_trigger.sql`：修复触发器函数的 SQL 脚本
- `app/components/Auth.tsx`：包含备用创建 profile 逻辑的前端代码

