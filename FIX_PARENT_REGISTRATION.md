# 修复家长注册角色设置问题

## 问题描述

创建家长账号时，虽然显示注册成功，但：
1. 新用户的 `role` 被设置为 `'child'`（应该是 `'parent'`）
2. 对应的孩子记录的 `parent_id` 没有更新

## 原因分析

1. **触发器设置了默认 role**：`handle_new_user` 触发器可能在创建 profile 时设置了默认的 `role` 为 `'child'`
2. **数据库约束阻止更新**：`check_role_update` 触发器阻止了从 `'child'` 更新到 `'parent'`

## 解决方案

### 步骤 1：修复触发器，确保不设置默认 role

在 Supabase SQL Editor 中运行 `fix_handle_new_user_trigger.sql`：

```sql
-- 这个脚本会：
-- 1. 重新创建 handle_new_user 函数，明确设置 role 为 NULL
-- 2. 移除 role 字段的默认值（如果存在）
-- 3. 确保触发器正确配置
```

### 步骤 2：修改角色更新触发器，允许注册阶段更新

在 Supabase SQL Editor 中运行 `fix_role_update_trigger.sql`：

```sql
-- 这个脚本会：
-- 1. 修改 check_role_update 函数，允许在注册后的5分钟内更新 role
-- 2. 这样可以在注册阶段纠正触发器设置的错误角色
```

### 步骤 3：代码已更新

前端代码已经更新：
- `lib/supabase.ts`：`updateRole` 函数添加了 `force` 参数，允许强制更新
- `app/components/Auth.tsx`：家长注册时，如果检测到 role 已被设置为 `'child'`，会使用强制更新

## 验证步骤

1. **检查触发器配置**：
   ```sql
   -- 查看 handle_new_user 函数
   SELECT routine_definition 
   FROM information_schema.routines 
   WHERE routine_name = 'handle_new_user';
   
   -- 应该看到 role 被明确设置为 NULL
   ```

2. **检查 role 字段默认值**：
   ```sql
   SELECT column_default 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'role';
   
   -- 应该返回 NULL（没有默认值）
   ```

3. **测试家长注册**：
   - 使用一个已存在的孩子邮箱注册家长账号
   - 检查新创建的 profile：
     - `role` 应该是 `'parent'`（不是 `'child'`）
     - 孩子的 `parent_id` 应该被更新为家长的 `id`

## 如果问题仍然存在

如果运行上述脚本后问题仍然存在，请检查：

1. **触发器执行顺序**：确保 `handle_new_user` 触发器在创建 profile 时确实将 `role` 设置为 `NULL`
2. **数据库约束**：检查是否有其他约束或触发器影响了 `role` 字段
3. **RLS 策略**：确保 RLS 策略允许用户更新自己的 profile

## 手动修复已存在的错误数据

如果已经有错误的家长账号（role 被设置为 'child'），可以手动修复：

```sql
-- 注意：这需要管理员权限或使用 Service Role Key
-- 1. 找到需要修复的家长账号
SELECT id, email, role, created_at 
FROM profiles 
WHERE role = 'child' 
  AND created_at > NOW() - INTERVAL '1 hour'  -- 最近1小时创建的
ORDER BY created_at DESC;

-- 2. 手动更新（替换 'parent-id' 为实际的家长 UUID）
UPDATE profiles 
SET role = 'parent' 
WHERE id = 'parent-id' 
  AND created_at > NOW() - INTERVAL '5 minutes';  -- 只更新5分钟内的

-- 3. 更新孩子的 parent_id（替换 'child-id' 和 'parent-id'）
UPDATE profiles 
SET parent_id = 'parent-id' 
WHERE id = 'child-id' 
  AND role = 'child';
```

## 注意事项

- 修改触发器后，新注册的用户应该能正常工作
- 已存在的错误数据需要手动修复（见上方）
- 建议在测试环境中先验证修复效果

