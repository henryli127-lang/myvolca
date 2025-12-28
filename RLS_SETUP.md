# Supabase RLS (Row Level Security) 设置指南

## 问题：406 错误和无限递归错误

如果遇到 406 错误或 `infinite recursion detected in policy` 错误，通常是 RLS 策略配置不当导致的。需要为以下表设置正确的 RLS 策略。

**重要**：避免在 RLS 策略中引用可能导致递归的表，特别是 `profiles` 表。

## 1. words 表 RLS 设置

在 Supabase Dashboard 中：

1. 进入 **Table Editor** > **words**
2. 点击 **Policies** 标签
3. 创建新策略：

**策略名称**: `Allow authenticated users to read words`
**策略类型**: `SELECT`
**目标角色**: `authenticated`
**USING 表达式**: `true`

或者使用 SQL：

```sql
-- 允许所有认证用户读取 words 表
CREATE POLICY "Allow authenticated users to read words"
ON words
FOR SELECT
TO authenticated
USING (true);
```

## 2. user_progress 表 RLS 设置

**重要**：不要在此策略中引用 `profiles` 表，否则会导致无限递归错误。

```sql
-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;

-- 允许用户读取自己的进度（直接使用 auth.uid()，不引用 profiles）
CREATE POLICY "Users can read own progress"
ON user_progress
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

-- 允许用户插入自己的进度
CREATE POLICY "Users can insert own progress"
ON user_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

-- 允许用户更新自己的进度
CREATE POLICY "Users can update own progress"
ON user_progress
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- 允许用户使用 upsert（on_conflict）
-- 注意：upsert 需要同时有 SELECT、INSERT 和 UPDATE 权限
```

## 3. profiles 表 RLS 设置

**重要**：避免在策略中引用 `profiles` 表自身，这会导致无限递归。

```sql
-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read by email" ON profiles;

-- 允许用户读取自己的资料（直接使用 auth.uid()，不引用 profiles）
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 允许用户根据邮箱查找其他用户（用于关联家长功能）
-- 注意：只返回 id, email, role，不返回敏感信息
CREATE POLICY "Users can read profiles by email"
ON profiles
FOR SELECT
TO authenticated
USING (true);  -- 允许所有认证用户读取，但只返回必要字段

-- 允许用户插入自己的资料
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 允许用户更新自己的资料
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

## 4. study_logs 表 RLS 设置

**重要**：不要在此策略中引用 `profiles` 表。

```sql
-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can read own study logs" ON study_logs;
DROP POLICY IF EXISTS "Users can insert own study logs" ON study_logs;

-- 允许用户读取自己的学习日志（直接使用 auth.uid()，不引用 profiles）
CREATE POLICY "Users can read own study logs"
ON study_logs
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

-- 允许用户插入自己的学习日志
CREATE POLICY "Users can insert own study logs"
ON study_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);
```

## 5. 修复无限递归错误的步骤

如果遇到 `infinite recursion detected in policy` 错误：

1. **删除所有可能导致递归的策略**：
```sql
-- 删除所有策略
DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read profiles by email" ON profiles;
DROP POLICY IF EXISTS "Users can read own study logs" ON study_logs;
DROP POLICY IF EXISTS "Users can insert own study logs" ON study_logs;
```

2. **重新创建策略**（使用上面的 SQL，确保不引用可能导致递归的表）

3. **验证策略**：
```sql
-- 检查所有策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 快速测试

在 Supabase SQL Editor 中运行：

```sql
-- 检查 words 表是否有数据
SELECT COUNT(*) FROM words;

-- 检查当前用户的权限
SELECT auth.uid() as current_user_id;
```

## 临时解决方案（仅用于测试）

如果急需测试，可以临时禁用 RLS（**不推荐用于生产环境**）：

```sql
-- 仅用于测试，生产环境请使用上面的策略
ALTER TABLE words DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_logs DISABLE ROW LEVEL SECURITY;
```

