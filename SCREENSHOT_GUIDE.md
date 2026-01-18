# 页面截图指南

本指南提供了多种方法来截取应用主要页面的展示效果。

## 方法一：使用 Playwright 自动化截图（推荐）

### 前置要求

1. 安装依赖：
```bash
npm install playwright sharp
npx playwright install chromium
```

2. 确保应用正在运行：
```bash
npm run dev
```

3. 配置登录信息（两种方式）：

#### 方式1：环境变量（推荐）
```bash
export CHILD_EMAIL="child@example.com"
export CHILD_PASSWORD="password123"
export PARENT_EMAIL="parent@example.com"
export PARENT_PASSWORD="password123"
```

#### 方式2：修改脚本文件
编辑 `scripts/screenshot-pages.js`，修改 `LOGIN_CONFIG` 部分：
```javascript
const LOGIN_CONFIG = {
  child: {
    email: 'your-child-email@example.com',
    password: 'your-child-password'
  },
  parent: {
    email: 'your-parent-email@example.com',
    password: 'your-parent-password'
  }
};
```

### 使用方法

运行截图脚本：
```bash
npm run screenshot
```

或者直接运行：
```bash
node scripts/screenshot-pages.js
```

### 功能特性

✅ **自动登录**：脚本会自动登录学生和家长账号  
✅ **智能导航**：自动点击按钮导航到不同页面  
✅ **图片合并**：所有截图自动合并成一个长图  
✅ **全页面截图**：截取完整页面内容

### 配置

- 默认 URL: `http://localhost:3000`
- 截图目录: `screenshots/`
- 视口大小: 1920x1080
- 合并图片: `screenshots/all-pages-merged.png`

可以通过环境变量修改：
```bash
BASE_URL=http://localhost:3000 \
CHILD_EMAIL=child@example.com \
CHILD_PASSWORD=password123 \
PARENT_EMAIL=parent@example.com \
PARENT_PASSWORD=password123 \
node scripts/screenshot-pages.js
```

### 截图页面列表

脚本会自动截取以下页面：

1. **01-login.png** - 登录页面（无需登录）
2. **02-register.png** - 注册页面（无需登录）
3. **03-dashboard.png** - 学生仪表板（需要学生登录）
4. **04-learning.png** - 学习页面（需要学生登录）
5. **05-challenge.png** - 测试页面（需要学生登录）
6. **06-report.png** - 成绩单页面（需要学生登录）
7. **07-storyspark.png** - 故事生成页面（需要学生登录）
8. **08-library.png** - 图书馆页面（需要学生登录）
9. **09-parent-dashboard.png** - 家长仪表板（需要家长登录）
10. **10-settings.png** - 设置页面（需要学生登录）

### 输出文件

- **单独截图**：`screenshots/01-login.png` 到 `screenshots/10-settings.png`
- **合并图片**：`screenshots/all-pages-merged.png`（所有页面垂直合并）

## 方法二：手动截图

### 使用浏览器开发者工具

1. 打开 Chrome/Edge 浏览器
2. 按 `F12` 打开开发者工具
3. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
4. 输入 "Capture screenshot" 或 "Capture full size screenshot"
5. 选择保存位置

### 使用浏览器扩展

推荐扩展：
- **Awesome Screenshot** - Chrome/Edge/Firefox
- **Nimbus Screenshot** - Chrome/Edge/Firefox
- **FireShot** - Chrome/Edge/Firefox

### 使用系统截图工具

#### macOS
- `Cmd+Shift+4` - 选择区域截图
- `Cmd+Shift+3` - 全屏截图
- `Cmd+Shift+4` + `Space` - 窗口截图

#### Windows
- `Win+Shift+S` - 截图工具（Windows 10+）
- `Print Screen` - 全屏截图

#### Linux
- `Print Screen` - 全屏截图
- `Shift+Print Screen` - 选择区域截图

## 方法三：使用 Puppeteer（备选）

如果需要更多控制，可以使用 Puppeteer：

```bash
npm install puppeteer
```

然后创建自定义脚本。

## 注意事项

1. **登录信息**：确保配置的登录账号有效，否则无法截图需要登录的页面
2. **数据准备**：确保数据库中有测试数据，以便页面显示完整内容
3. **响应式设计**：可以修改脚本中的 `VIEWPORT` 来截取不同尺寸的截图
4. **等待时间**：如果页面加载较慢，可以增加 `waitTime` 配置
5. **图片合并**：需要安装 `sharp` 库才能合并图片，如果未安装会跳过合并步骤
6. **登录状态**：脚本使用浏览器上下文保持登录状态，学生和家长账号会自动切换

## 自定义截图

如果需要自定义截图配置，可以修改 `scripts/screenshot-pages.js` 中的 `pages` 数组：

```javascript
const pages = [
  {
    name: 'custom-page',
    url: '/custom-path',
    waitForSelector: '.custom-selector',
    waitTime: 2000,
    description: '自定义页面'
  }
];
```

## 截图后处理

截图保存在 `screenshots/` 目录下，可以：
- 使用图片编辑工具调整大小
- 压缩图片以减小文件大小
- 转换为其他格式（如 WebP、JPEG）

## 故障排除

### 问题：Playwright 无法启动浏览器
**解决方案**：
```bash
npx playwright install chromium
```

### 问题：登录失败
**解决方案**：
1. 检查登录账号和密码是否正确
2. 确认账号在数据库中存在
3. 检查网络连接和应用是否正常运行

### 问题：页面加载超时
**解决方案**：增加 `waitTime` 或检查网络连接

### 问题：找不到元素
**解决方案**：检查 `waitForSelector` 是否正确，或移除该配置

### 问题：截图空白
**解决方案**：确保应用正在运行，URL 正确

### 问题：图片合并失败
**解决方案**：
```bash
npm install sharp
```

### 问题：某些页面无法访问
**解决方案**：
1. 检查是否需要先完成前置操作（如测试后才能看到成绩单）
2. 确认登录状态是否正确
3. 检查页面路由是否正确
