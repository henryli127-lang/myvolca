/**
 * 自动截图脚本 - 截取所有主要页面的展示效果
 * 使用方法：
 * 1. 确保应用正在运行（npm run dev）
 * 2. 运行：npx tsx scripts/screenshot-pages.ts
 * 3. 截图将保存在 screenshots/ 目录下
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const VIEWPORT = { width: 1920, height: 1080 };

// 定义需要截图的页面
interface PageConfig {
  name: string;
  url: string;
  waitForSelector?: string;
  waitTime?: number;
  description: string;
}

const pages: PageConfig[] = [
  {
    name: '01-login',
    url: '/',
    waitForSelector: 'text=登录',
    description: '登录页面'
  },
  {
    name: '02-register',
    url: '/',
    waitForSelector: 'text=注册',
    waitTime: 1000,
    description: '注册页面'
  },
  {
    name: '03-dashboard',
    url: '/',
    waitForSelector: '[data-testid="dashboard"]',
    description: '学生仪表板'
  },
  {
    name: '04-learning',
    url: '/',
    waitForSelector: '[data-testid="learning"]',
    description: '学习页面'
  },
  {
    name: '05-challenge',
    url: '/',
    waitForSelector: '[data-testid="challenge"]',
    description: '测试页面'
  },
  {
    name: '06-report',
    url: '/',
    waitForSelector: '[data-testid="report"]',
    description: '成绩单页面'
  },
  {
    name: '07-storyspark',
    url: '/',
    waitForSelector: '[data-testid="storyspark"]',
    description: '故事生成页面'
  },
  {
    name: '08-library',
    url: '/',
    waitForSelector: '[data-testid="library"]',
    description: '图书馆页面'
  },
  {
    name: '09-parent-dashboard',
    url: '/parent/dashboard',
    waitForSelector: 'text=家长',
    description: '家长仪表板'
  },
  {
    name: '10-settings',
    url: '/',
    waitForSelector: '[data-testid="settings"]',
    description: '设置页面'
  }
];

// 创建截图目录
function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    console.log(`✅ 创建截图目录: ${SCREENSHOT_DIR}`);
  }
}

// 截图单个页面
async function screenshotPage(
  browser: Browser,
  config: PageConfig,
  index: number
): Promise<void> {
  const page = await browser.newPage();
  
  try {
    console.log(`\n[${index + 1}/${pages.length}] 正在截图: ${config.description}...`);
    
    // 设置视口大小
    await page.setViewportSize(VIEWPORT);
    
    // 导航到页面
    const fullUrl = `${BASE_URL}${config.url}`;
    console.log(`  访问: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    
    // 等待特定元素或时间
    if (config.waitForSelector) {
      try {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      } catch (e) {
        console.warn(`  ⚠️  未找到选择器: ${config.waitForSelector}`);
      }
    }
    
    if (config.waitTime) {
      await page.waitForTimeout(config.waitTime);
    }
    
    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // 额外等待1秒确保动画完成
    
    // 截图
    const screenshotPath = path.join(SCREENSHOT_DIR, `${config.name}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true, // 截取整个页面
      type: 'png'
    });
    
    console.log(`  ✅ 已保存: ${screenshotPath}`);
    
  } catch (error) {
    console.error(`  ❌ 截图失败: ${error}`);
  } finally {
    await page.close();
  }
}

// 主函数
async function main() {
  console.log('🚀 开始截图流程...');
  console.log(`📁 截图目录: ${SCREENSHOT_DIR}`);
  console.log(`🌐 基础URL: ${BASE_URL}`);
  
  // 创建截图目录
  ensureScreenshotDir();
  
  // 启动浏览器
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // 逐个截图
    for (let i = 0; i < pages.length; i++) {
      await screenshotPage(browser, pages[i], i);
    }
    
    console.log('\n✅ 所有截图完成！');
    console.log(`📁 截图保存在: ${SCREENSHOT_DIR}`);
    
  } catch (error) {
    console.error('❌ 截图过程中出错:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// 运行主函数
main().catch(console.error);
