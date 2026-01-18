/**
 * 自动截图脚本 - 截取所有主要页面的展示效果（JavaScript版本）
 * 使用方法：
 * 1. 安装依赖：npm install playwright sharp
 * 2. 安装浏览器：npx playwright install chromium
 * 3. 确保应用正在运行（npm run dev）
 * 4. 配置登录信息（见下方配置）
 * 5. 运行：node scripts/screenshot-pages.js
 * 6. 截图将保存在 screenshots/ 目录下，并合并成一个图片文件
 */

const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const VIEWPORT = { width: 1920, height: 1080 };

// 登录配置（请修改为实际的测试账号）
const LOGIN_CONFIG = {
  child: {
    email: process.env.CHILD_EMAIL || 'child@example.com',
    password: process.env.CHILD_PASSWORD || 'password123'
  },
  parent: {
    email: process.env.PARENT_EMAIL || 'parent@example.com',
    password: process.env.PARENT_PASSWORD || 'password123'
  }
};

// 定义需要截图的页面
const pages = [
  {
    name: '01-login',
    url: '/',
    waitForSelector: 'text=登录',
    description: '登录页面',
    requiresAuth: false
  },
  {
    name: '02-register',
    url: '/',
    waitForSelector: 'text=注册',
    waitTime: 1000,
    description: '注册页面',
    requiresAuth: false
  },
  {
    name: '03-dashboard',
    url: '/',
    waitForSelector: 'text=欢迎',
    description: '学生仪表板',
    requiresAuth: true,
    userType: 'child'
  },
  {
    name: '04-learning',
    url: '/',
    waitForSelector: 'text=学习',
    description: '学习页面',
    requiresAuth: true,
    userType: 'child',
    navigateAction: async (page) => {
      // 点击学习按钮
      const learningBtn = await page.$('text=学习');
      if (learningBtn) {
        await learningBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  },
  {
    name: '05-challenge',
    url: '/',
    waitForSelector: 'text=测试',
    description: '测试页面',
    requiresAuth: true,
    userType: 'child',
    navigateAction: async (page) => {
      // 点击测试按钮
      const challengeBtn = await page.$('text=测试');
      if (challengeBtn) {
        await challengeBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  },
  {
    name: '06-report',
    url: '/',
    waitForSelector: 'text=成绩单',
    description: '成绩单页面',
    requiresAuth: true,
    userType: 'child',
    navigateAction: async (page) => {
      // 需要先完成测试才能看到成绩单，这里可能需要特殊处理
      await page.waitForTimeout(1000);
    }
  },
  {
    name: '07-storyspark',
    url: '/',
    waitForSelector: 'text=故事',
    description: '故事生成页面',
    requiresAuth: true,
    userType: 'child',
    navigateAction: async (page) => {
      // 点击故事按钮
      const storyBtn = await page.$('text=故事');
      if (storyBtn) {
        await storyBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  },
  {
    name: '08-library',
    url: '/',
    waitForSelector: 'text=图书馆',
    description: '图书馆页面',
    requiresAuth: true,
    userType: 'child',
    navigateAction: async (page) => {
      // 点击图书馆按钮
      const libraryBtn = await page.$('text=图书馆');
      if (libraryBtn) {
        await libraryBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  },
  {
    name: '09-parent-dashboard',
    url: '/parent/dashboard',
    waitForSelector: 'text=家长',
    description: '家长仪表板',
    requiresAuth: true,
    userType: 'parent'
  },
  {
    name: '10-settings',
    url: '/',
    waitForSelector: 'text=设置',
    description: '设置页面',
    requiresAuth: true,
    userType: 'child',
    navigateAction: async (page) => {
      // 点击设置按钮
      const settingsBtn = await page.$('text=设置');
      if (settingsBtn) {
        await settingsBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  }
];

// 创建截图目录
function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    console.log(`✅ 创建截图目录: ${SCREENSHOT_DIR}`);
  }
}

// 登录函数
async function login(page, userType) {
  const config = LOGIN_CONFIG[userType];
  console.log(`\n🔐 正在登录${userType === 'child' ? '学生' : '家长'}账号: ${config.email}`);
  
  try {
    // 导航到登录页面
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // 查找并填写邮箱输入框
    const emailInput = await page.$('input[type="email"]');
    if (!emailInput) {
      // 尝试其他选择器
      const emailSelectors = [
        'input[placeholder*="邮箱"]',
        'input[placeholder*="email"]',
        'input[name="email"]'
      ];
      for (const selector of emailSelectors) {
        const input = await page.$(selector);
        if (input) {
          await input.fill(config.email);
          break;
        }
      }
    } else {
      await emailInput.fill(config.email);
    }
    
    // 查找并填写密码输入框
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.fill(config.password);
    }
    
    // 点击登录按钮
    const loginButton = await page.$('button:has-text("登录")');
    if (loginButton) {
      await loginButton.click();
    } else {
      // 尝试提交表单
      await page.keyboard.press('Enter');
    }
    
    // 等待登录完成（检查是否跳转到仪表板）
    try {
      await page.waitForURL(url => !url.includes('login') || url === BASE_URL, { timeout: 10000 });
      await page.waitForTimeout(2000); // 等待页面加载
      console.log(`  ✅ 登录成功`);
      return true;
    } catch (e) {
      console.warn(`  ⚠️  登录可能失败，继续尝试...`);
      await page.waitForTimeout(2000);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ 登录失败: ${error.message}`);
    return false;
  }
}

// 合并所有截图为一个图片
async function mergeScreenshots() {
  console.log('\n🖼️  开始合并截图...');
  
  try {
    // 读取所有截图文件
    const files = fs.readdirSync(SCREENSHOT_DIR)
      .filter(file => file.endsWith('.png') && file.match(/^\d{2}-/))
      .sort()
      .map(file => path.join(SCREENSHOT_DIR, file));
    
    if (files.length === 0) {
      console.warn('  ⚠️  没有找到截图文件');
      return;
    }
    
    console.log(`  找到 ${files.length} 张截图`);
    
    // 获取所有图片的元数据
    const images = [];
    let totalHeight = 0;
    let maxWidth = 0;
    
    for (const file of files) {
      const metadata = await sharp(file).metadata();
      images.push({
        file,
        width: metadata.width,
        height: metadata.height
      });
      totalHeight += metadata.height;
      maxWidth = Math.max(maxWidth, metadata.width);
    }
    
    // 创建合并后的图片（垂直排列）
    const mergedImage = sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    });
    
    // 合并所有图片
    const composite = [];
    let currentY = 0;
    
    for (const img of images) {
      composite.push({
        input: img.file,
        top: currentY,
        left: 0
      });
      currentY += img.height;
    }
    
    const outputPath = path.join(SCREENSHOT_DIR, 'all-pages-merged.png');
    await mergedImage
      .composite(composite)
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ 合并完成: ${outputPath}`);
    console.log(`  📐 尺寸: ${maxWidth}x${totalHeight}px`);
    
  } catch (error) {
    console.error(`  ❌ 合并失败: ${error.message}`);
    console.error(`  提示: 请确保已安装 sharp: npm install sharp`);
  }
}

// 截图单个页面
async function screenshotPage(browser, config, index, context) {
  const page = await context.newPage();
  
  try {
    console.log(`\n[${index + 1}/${pages.length}] 正在截图: ${config.description}...`);
    
    // 设置视口大小
    await page.setViewportSize(VIEWPORT);
    
    // 如果需要登录且当前未登录
    if (config.requiresAuth && config.userType) {
      // 检查是否已登录（通过检查localStorage或页面元素）
      const isLoggedIn = await page.evaluate(() => {
        return localStorage.getItem('supabase.auth.token') !== null || 
               document.body.textContent.includes('欢迎');
      });
      
      if (!isLoggedIn) {
        console.log(`  需要登录，正在登录${config.userType === 'child' ? '学生' : '家长'}账号...`);
        await login(page, config.userType);
      }
    }
    
    // 导航到页面
    const fullUrl = `${BASE_URL}${config.url}`;
    console.log(`  访问: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    
    // 执行导航操作（如果需要）
    if (config.navigateAction) {
      console.log(`  执行导航操作...`);
      await config.navigateAction(page);
    }
    
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
    await page.waitForTimeout(2000); // 额外等待2秒确保动画完成
    
    // 截图
    const screenshotPath = path.join(SCREENSHOT_DIR, `${config.name}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true, // 截取整个页面
      type: 'png'
    });
    
    console.log(`  ✅ 已保存: ${screenshotPath}`);
    
  } catch (error) {
    console.error(`  ❌ 截图失败: ${error.message}`);
  } finally {
    await page.close();
  }
}

// 主函数
async function main() {
  console.log('🚀 开始截图流程...');
  console.log(`📁 截图目录: ${SCREENSHOT_DIR}`);
  console.log(`🌐 基础URL: ${BASE_URL}`);
  console.log(`👤 学生账号: ${LOGIN_CONFIG.child.email}`);
  console.log(`👨‍👩‍👧 家长账号: ${LOGIN_CONFIG.parent.email}`);
  
  // 创建截图目录
  ensureScreenshotDir();
  
  // 启动浏览器（使用持久化上下文以保持登录状态）
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // 创建浏览器上下文（共享cookies和localStorage）
  const context = await browser.newContext({
    viewport: VIEWPORT
  });
  
  try {
    // 逐个截图
    for (let i = 0; i < pages.length; i++) {
      await screenshotPage(browser, pages[i], i, context);
    }
    
    console.log('\n✅ 所有截图完成！');
    console.log(`📁 截图保存在: ${SCREENSHOT_DIR}`);
    
    // 合并所有截图
    await mergeScreenshots();
    
  } catch (error) {
    console.error('❌ 截图过程中出错:', error);
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
  }
}

// 运行主函数
main().catch(console.error);
