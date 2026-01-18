/**
 * 截图配置示例文件
 * 复制此文件为 .screenshot-config.js 并填入实际的登录信息
 */

module.exports = {
  // 学生账号配置
  child: {
    email: 'child@example.com',
    password: 'your-child-password'
  },
  // 家长账号配置
  parent: {
    email: 'parent@example.com',
    password: 'your-parent-password'
  },
  // 应用地址
  baseUrl: 'http://localhost:3000'
};
