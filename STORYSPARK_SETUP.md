# StorySpark AI 集成说明

## 功能概述

StorySpark AI 是一个趣味阅读模块，在孩子完成测试后，可以根据新学的单词生成个性化的故事。

## 配置步骤

### 1. 环境变量配置

在项目根目录创建 `.env.local` 文件（如果不存在），并添加以下内容：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**获取 Gemini API Key：**
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 登录你的 Google 账号
3. 创建新的 API Key
4. 将 API Key 复制到 `.env.local` 文件中

### 2. 功能使用流程

1. **完成测试**：孩子在完成单词测试后，会看到成绩单页面
2. **点击"趣味阅读"**：在成绩单页面点击"📚 趣味阅读"按钮
3. **选择角色和场景**：
   - 选择角色：Labubu, Mickey Mouse, Queen Elsa, Buzz Lightyear
   - 选择场景：Mysterious Island, Cyber City, Enchanted Forest, Mars Base
4. **生成故事**：点击"✨ 生成故事"按钮，AI 会生成包含新学单词的故事
5. **阅读和测验**：
   - 阅读生成的故事（200-300字）
   - 完成阅读理解测验（3-5道选择题）
   - 查看得分和反馈

## 技术实现

### 文件结构

- `app/components/StorySpark.tsx` - 主组件，统一样式
- `app/api/storyspark/route.ts` - API 路由，处理 Gemini API 调用
- `app/types/storyspark.ts` - TypeScript 类型定义
- `app/components/ReportCard.tsx` - 已添加"趣味阅读"链接

### 样式统一

StorySpark 组件已统一使用主应用的浅色主题风格：
- 使用相同的颜色系统（candy-blue, candy-green, candy-orange）
- 使用相同的字体（Quicksand）
- 使用相同的动画效果（framer-motion）
- 使用相同的圆角和阴影样式

### API 集成

- 使用 Next.js API Routes 处理 Gemini API 调用
- API Key 存储在服务器端，不会暴露给客户端
- 自动将新学单词传递给 AI，确保故事中包含这些单词

## 注意事项

1. **API Key 安全**：确保 `.env.local` 文件已添加到 `.gitignore`，不要将 API Key 提交到版本控制
2. **API 限制**：Gemini API 有使用限制，请参考 Google 的文档了解配额
3. **网络要求**：需要稳定的网络连接来调用 Gemini API
4. **单词数量**：建议至少 3-5 个单词，AI 才能生成更好的故事

## 故障排除

### 问题：无法生成故事

1. 检查 `.env.local` 文件是否存在且包含正确的 `GEMINI_API_KEY`
2. 检查 API Key 是否有效
3. 查看浏览器控制台和服务器日志中的错误信息

### 问题：故事中没有包含新学单词

- 确保 `testWords` 数组不为空
- 检查 API 路由是否正确接收单词数据
- 查看服务器日志中的 prompt 内容

## 未来改进

- [ ] 添加故事保存功能
- [ ] 添加故事历史记录
- [ ] 优化加载状态显示
- [ ] 添加重试机制
- [ ] 支持更多角色和场景
