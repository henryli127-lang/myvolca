/** @type {import('next').NextConfig} */
const nextConfig = {
  // 排除 storyspark-ai 文件夹，避免编译旧代码
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/storyspark-ai/**'],
    }
    return config
  },
}

module.exports = nextConfig



