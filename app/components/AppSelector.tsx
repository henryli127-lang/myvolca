'use client'

import { motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'

interface AppSelectorProps {
    user: User
    userProfile: any
    onSelectVocabulary: () => void
    onSelectMath: () => void
    onLogout: () => void
}

export default function AppSelector({
    user,
    userProfile,
    onSelectVocabulary,
    onSelectMath,
    onLogout,
}: AppSelectorProps) {
    const userName = userProfile?.email?.split('@')[0] || 'Explorer'

    return (
        <div className="min-h-screen relative overflow-hidden font-quicksand">
            {/* 渐变背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200" />

            {/* 彩色 Blob 装饰 */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-pink-300/50 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute top-1/4 right-0 w-80 h-80 bg-purple-300/40 rounded-full blur-3xl translate-x-1/3" />
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-blue-300/40 rounded-full blur-3xl translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-56 h-56 bg-orange-300/50 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />

            {/* 装饰元素 - 星星 */}
            <div className="absolute top-20 left-32 text-yellow-400 text-2xl animate-pulse">⭐</div>
            <div className="absolute top-16 left-48 text-yellow-300 text-lg animate-pulse" style={{ animationDelay: '0.5s' }}>✦</div>
            <div className="absolute top-28 left-40 text-yellow-400 text-sm animate-pulse" style={{ animationDelay: '0.3s' }}>✦</div>
            <div className="absolute top-40 right-48 text-yellow-400 text-xl animate-pulse" style={{ animationDelay: '0.7s' }}>⭐</div>
            <div className="absolute top-32 right-32 text-yellow-300 text-sm animate-pulse" style={{ animationDelay: '0.2s' }}>✦</div>
            <div className="absolute bottom-48 left-24 text-yellow-400 text-lg animate-pulse" style={{ animationDelay: '0.4s' }}>⭐</div>
            <div className="absolute bottom-40 right-40 text-yellow-400 text-2xl animate-pulse" style={{ animationDelay: '0.6s' }}>⭐</div>

            {/* 装饰元素 - 云朵 */}
            <motion.div
                className="absolute bottom-1/3 left-20 text-4xl"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
                ☁️
            </motion.div>
            <motion.div
                className="absolute top-1/3 right-20 text-4xl"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            >
                ☁️
            </motion.div>

            {/* 退出按钮 */}
            <div className="absolute top-4 right-4 z-50">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onLogout}
                    className="group relative bg-white/90 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-base font-semibold border-2 border-white/50 gap-1"
                    title="退出"
                >
                    <span>🚪</span>
                    <span>退出</span>
                </motion.button>
            </div>

            {/* 主内容区域 */}
            <div className="relative z-10 max-w-5xl mx-auto pt-16 px-6">
                {/* 欢迎消息 */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-700 mb-2 drop-shadow-sm">
                        Welcome, {userName}! 🌟
                    </h1>
                    <p className="text-xl text-gray-600 mt-4">
                        What would you like to learn today?
                    </p>
                </motion.div>

                {/* 选择卡片区域 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* 单词记忆卡片 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSelectVocabulary}
                        className="cursor-pointer"
                    >
                        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50 hover:shadow-2xl transition-all relative overflow-hidden">
                            {/* 装饰背景 */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                            <div className="relative z-10">
                                {/* 图标 */}
                                <div className="text-6xl mb-6 text-center">
                                    📚
                                </div>

                                {/* 标题 */}
                                <h2 className="text-2xl font-extrabold text-center mb-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                                    单词记忆
                                </h2>

                                {/* 描述 */}
                                <p className="text-gray-600 text-center text-sm leading-relaxed">
                                    学习新单词，趣味阅读，挑战词汇测试！
                                </p>

                                {/* 功能标签 */}
                                <div className="flex flex-wrap justify-center gap-2 mt-4">
                                    <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">学习单词</span>
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">趣味阅读</span>
                                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">词汇测试</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* 数学家教卡片 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        whileHover={{ scale: 1.03, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onSelectMath}
                        className="cursor-pointer"
                    >
                        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50 hover:shadow-2xl transition-all relative overflow-hidden">
                            {/* 装饰背景 */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-400/20 to-orange-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                            <div className="relative z-10">
                                {/* 图标 */}
                                <div className="text-6xl mb-6 text-center">
                                    🧮
                                </div>

                                {/* 标题 */}
                                <h2 className="text-2xl font-extrabold text-center mb-3 bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                                    数学家教
                                </h2>

                                {/* 描述 */}
                                <p className="text-gray-600 text-center text-sm leading-relaxed">
                                    上传数学题目，AI 一步步引导你思考！
                                </p>

                                {/* 功能标签 */}
                                <div className="flex flex-wrap justify-center gap-2 mt-4">
                                    <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-medium">拍照上传</span>
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">AI 辅导</span>
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">步骤讲解</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* 底部提示 */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center mt-12 text-gray-500 text-sm"
                >
                    点击任意卡片开始学习之旅 ✨
                </motion.div>
            </div>
        </div>
    )
}
