# 我的图书馆功能设置说明

## 数据库表结构

在 Supabase Dashboard 中创建 `articles` 表：

```sql
-- 创建 articles 表
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT NOT NULL,
  image_url TEXT,
  quiz JSONB,
  character JSONB,
  setting JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);

-- 启用 RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看自己的文章
CREATE POLICY "Users can view own articles"
ON articles
FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id::text);

-- 创建 RLS 策略：用户只能插入自己的文章
CREATE POLICY "Users can insert own articles"
ON articles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id::text);

-- 创建 RLS 策略：用户只能更新自己的文章
CREATE POLICY "Users can update own articles"
ON articles
FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

-- 创建 RLS 策略：用户只能删除自己的文章
CREATE POLICY "Users can delete own articles"
ON articles
FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id::text);
```

## 阿里云 OSS 配置

在 `.env.local` 文件中添加以下环境变量：

```
ALIYUN_OSS_REGION=oss-cn-hangzhou  # 你的OSS区域
ALIYUN_OSS_ACCESS_KEY_ID=your_access_key_id
ALIYUN_OSS_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_OSS_BUCKET=your_bucket_name
ALIYUN_OSS_ENDPOINT=https://your_bucket_name.oss-cn-hangzhou.aliyuncs.com  # 可选，会自动生成
```

## 功能说明

1. **自动保存**：当用户生成故事后，文章会自动保存到图书馆
2. **图片上传**：文章图片会自动上传到阿里云OSS
3. **HTML格式**：文章以HTML格式保存，便于后续查看
4. **我的图书馆**：学生首页右上角有"我的图书馆"链接
5. **文章列表**：图书馆页面展示所有保存的文章，包括图片和标题
6. **文章浏览**：点击文章可以查看完整内容，格式与阅读页面一致

## 注意事项

- 确保OSS Bucket设置为公共读或配置了正确的访问策略
- 图片上传失败不会影响文章保存，文章仍会保存但image_url可能为空
- 文章保存是异步的，不会阻塞用户界面
