# Supabase 设置说明

## 邮箱确认设置

当前应用**需要邮箱确认**。请确保在 Supabase Dashboard 中启用了邮箱确认功能：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Authentication** > **Settings**
4. 找到 **Email Auth** 部分
5. 确保 **"Enable email confirmations"** 选项已启用
6. 保存设置

这样，用户注册后会收到确认邮件，点击邮件中的链接后才能登录。

## 环境变量设置

在 `.env.local` 中添加以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=你的Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase Anon Key
```

## 用户注册流程

1. 用户填写邮箱和密码注册
2. 系统发送确认邮件到用户邮箱
3. 用户点击邮件中的确认链接
4. 确认后，用户可以使用邮箱和密码登录

