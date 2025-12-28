'use client'

import { motion } from 'framer-motion'
import { Sparkles, Trophy } from 'lucide-react'

interface DashboardProps {
  streakDays: number
  masteredCount: number
  lastLoginAt: string | null
  onStartAdventure: () => void
}

export default function Dashboard({ streakDays, masteredCount, lastLoginAt, onStartAdventure }: DashboardProps) {
  // 计算欢迎消息
  const getWelcomeMessage = () => {
    if (!lastLoginAt) {
      return { text: "Welcome! Let's start your journey! 🌟", emoji: "🌟" }
    }
    
    const lastLogin = new Date(lastLoginAt)
    const now = new Date()
    const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceLogin < 24) {
      return { text: "Keep it up! 🔥", emoji: "🔥" }
    } else if (hoursSinceLogin > 72) {
      return { text: "Welcome back! Ready to level up? 🐨", emoji: "🐨" }
    } else {
      return { text: "Welcome back! Let's continue! 💪", emoji: "💪" }
    }
  }

  const welcome = getWelcomeMessage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-orange-50 p-6 font-quicksand">
      <div className="max-w-4xl mx-auto">
        {/* 欢迎消息 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
            {welcome.text}
          </h1>
        </motion.div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 连续登录天数 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-3xl shadow-xl p-8 border-4 border-candy-orange"
          >
            <div className="flex items-center justify-between mb-4">
              <Sparkles className="w-12 h-12 text-candy-orange" />
              <span className="text-5xl font-bold text-candy-orange">{streakDays}</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-700">连续登录天数</h3>
            <p className="text-sm text-gray-500 mt-2">Keep your streak alive! 🔥</p>
          </motion.div>

          {/* 已掌握单词数 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-3xl shadow-xl p-8 border-4 border-candy-green"
          >
            <div className="flex items-center justify-between mb-4">
              <Trophy className="w-12 h-12 text-candy-green" />
              <span className="text-5xl font-bold text-candy-green">{masteredCount}</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-700">已掌握单词</h3>
            <p className="text-sm text-gray-500 mt-2">You're doing great! ⭐</p>
          </motion.div>
        </div>

        {/* Start Adventure 按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(84, 160, 255, 0.7)',
                '0 0 0 10px rgba(84, 160, 255, 0)',
                '0 0 0 0 rgba(84, 160, 255, 0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            onClick={onStartAdventure}
            className="bg-gradient-to-r from-candy-blue via-candy-green to-candy-orange text-white text-2xl font-bold py-6 px-12 rounded-3xl shadow-2xl transform transition-all hover:shadow-3xl"
            style={{
              fontFamily: 'Quicksand, sans-serif',
            }}
          >
            🚀 Start Adventure
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}

