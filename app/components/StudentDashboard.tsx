'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { profiles, words } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import WordHistoryModal from './WordHistoryModal'

interface StudentDashboardProps {
  user: User
  userProfile: any
  onStartAdventure: () => void
  onOpenLibrary: () => void
  onLogout: () => void
}

export default function StudentDashboard({ user, userProfile, onStartAdventure, onOpenLibrary, onLogout }: StudentDashboardProps) {
  const [streakDays, setStreakDays] = useState(0)
  const [masteredCount, setMasteredCount] = useState(0)
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // 使用 ref 防止重复执行
  const hasLoadedData = useRef(false)

  useEffect(() => {
    // 如果已经加载过数据，直接返回
    if (hasLoadedData.current) {
      console.log('📊 StudentDashboard: 数据已加载，跳过')
      setLoading(false)
      return
    }

    const loadDashboardData = async () => {
      console.log('📊 StudentDashboard: 开始加载数据')
      try {
        // 1. 获取基础数据（先显示出来）
        const streak = userProfile?.streak_days || 0
        setStreakDays(streak)

        // 并行获取掌握单词数，减少等待
        const { count } = await words.getMasteredCount(user.id)
        setMasteredCount(count || 0)

        // 2. 计算欢迎消息
        const lastLogin = userProfile?.last_login_at
        if (lastLogin) {
          const lastLoginDate = new Date(lastLogin)
          const now = new Date()
          const hoursDiff = (now.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60)

          if (hoursDiff < 24) {
            setWelcomeMessage('Keep it up! 🔥')
          } else if (hoursDiff > 72) {
            setWelcomeMessage('Welcome back! Ready to level up? 🐨')
          } else {
            setWelcomeMessage('Ready to continue? 🌟')
          }
        } else {
          setWelcomeMessage('Welcome! Let\'s start your journey! 🚀')
        }

        // 3. 🚀 关键优化：此时 UI 数据已准备好，立即结束 loading，不要等待下面的 DB 更新
        hasLoadedData.current = true
        setLoading(false)
        console.log('📊 StudentDashboard: 数据加载完成')

        // 4. 【后台】更新登录信息（Fire and forget 或非阻塞更新）
        if (userProfile) {
          const lastLogin = userProfile?.last_login_at
          let newStreakDays = streak

          if (lastLogin) {
            const lastLoginDate = new Date(lastLogin)
            const today = new Date()

            // 只比较日期部分，忽略时间
            const lastLoginDay = new Date(lastLoginDate.getFullYear(), lastLoginDate.getMonth(), lastLoginDate.getDate())
            const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

            const daysDiff = Math.floor((todayDay.getTime() - lastLoginDay.getTime()) / (1000 * 60 * 60 * 24))

            if (daysDiff === 0) {
              // 今天已经登录过，不更新天数
              newStreakDays = streak
            } else if (daysDiff === 1) {
              // 昨天登录过，今天登录，连续登录天数 +1
              newStreakDays = streak + 1
            } else {
              // 超过1天没登录，重置为 1
              newStreakDays = 1
            }
          } else {
            // 首次登录
            newStreakDays = 1
          }

          // 判断是否需要更新数据库
          const needsUpdate = !lastLogin ||
            (() => {
              const lastLoginDate = new Date(lastLogin)
              const today = new Date()
              const lastLoginDay = new Date(lastLoginDate.getFullYear(), lastLoginDate.getMonth(), lastLoginDate.getDate())
              const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              return lastLoginDay.getTime() !== todayDay.getTime()
            })()

          if (needsUpdate) {
            // 乐观更新 UI：立即在界面上显示新的天数，不需要等数据库返回
            setStreakDays(newStreakDays)

            // 后台静默更新数据库，不阻塞 UI
            profiles.updateLoginInfo(user.id, newStreakDays)
              .catch(err => console.error('后台更新登录信息失败:', err))
          }
        }
      } catch (error) {
        console.error('加载仪表盘数据失败:', error)
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user.id, userProfile?.streak_days, userProfile?.last_login_at]) // 只依赖具体字段，避免对象引用变化导致重复执行

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full"
        />
      </div>
    )
  }

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
      <div className="absolute bottom-56 right-24 text-yellow-300 text-sm animate-pulse" style={{ animationDelay: '0.8s' }}>✦</div>
      <div className="absolute top-1/2 left-16 text-yellow-400 text-lg animate-pulse" style={{ animationDelay: '0.9s' }}>✦</div>

      {/* 装饰元素 - 可爱云朵 */}
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

      {/* 装饰元素 - 行星 */}
      <motion.div
        className="absolute top-24 right-24 text-4xl"
        animate={{ rotate: [0, 10, 0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        🪐
      </motion.div>
      <motion.div
        className="absolute bottom-32 right-32 text-3xl"
        animate={{ rotate: [0, -10, 0, 10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        🪐
      </motion.div>

      {/* 装饰元素 - 地球 */}
      <motion.div
        className="absolute bottom-40 left-24 text-4xl"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        🌍
      </motion.div>

      {/* 装饰元素 - 火箭 */}
      <motion.div
        className="absolute top-1/2 right-28 text-3xl"
        animate={{ y: [0, -10, 0], rotate: [-15, -15, -15] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        🚀
      </motion.div>

      {/* 顶部按钮区域 */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        {/* 查看单词明细按钮 */}
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsHistoryOpen(true)}
          className="group relative bg-white/90 backdrop-blur-sm text-gray-700 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl border-2 border-white/50"
          title="查看单词明细"
        >
          <span>📅</span>
          <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            查看单词明细
            <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></span>
          </span>
        </motion.button>

        {/* 我的图书馆按钮 */}
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenLibrary}
          className="group relative bg-white/90 backdrop-blur-sm text-gray-700 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl border-2 border-white/50"
          title="我的图书馆"
        >
          <span>📚</span>
          <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            我的图书馆
            <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></span>
          </span>
        </motion.button>

        {/* 退出按钮 */}
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
      <div className="relative z-10 max-w-4xl mx-auto pt-16 px-6">
        {/* 欢迎消息 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-700 mb-2 drop-shadow-sm">
            {welcomeMessage}
          </h1>
        </motion.div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* 连续登录天数 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50"
          >
            <div className="text-center">
              {/* 渐变标题 */}
              <h3 className="text-2xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent" style={{ fontFamily: 'Comic Sans MS, cursive, sans-serif' }}>
                Streak
              </h3>
              <div className="flex items-center justify-center gap-4">
                <span className="text-5xl">🔥</span>
                <span className="text-5xl font-bold text-gray-700">
                  {streakDays} <span className="text-3xl">Days</span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* 已掌握单词数 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50 relative"
          >
            {/* 小星星装饰 */}
            <div className="absolute top-4 right-8 text-yellow-400 text-sm">✦ ✦ ✦</div>
            <div className="text-center">
              {/* 渐变标题 */}
              <h3 className="text-2xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-orange-400 bg-clip-text text-transparent" style={{ fontFamily: 'Comic Sans MS, cursive, sans-serif' }}>
                Words Mastered
              </h3>
              <div className="flex items-center justify-center gap-4">
                <div className="relative">
                  <span className="text-5xl">📖</span>
                  <span className="absolute -top-1 -right-1 text-yellow-400 text-xs">✦</span>
                </div>
                <span className="text-5xl font-bold text-gray-700">
                  {masteredCount}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Start Adventure 按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStartAdventure}
            className="relative group"
          >
            {/* 外发光效果 */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 rounded-full blur opacity-60 group-hover:opacity-80 transition-opacity" />

            {/* 主按钮 */}
            <div
              className="relative px-12 py-5 rounded-full text-2xl font-bold text-white flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 25%, #d299c2 50%, #fef9d7 75%, #a8edea 100%)',
                boxShadow: '0 4px 20px rgba(168, 237, 234, 0.4), inset 0 2px 10px rgba(255,255,255,0.3)',
                fontFamily: 'Comic Sans MS, cursive, sans-serif',
              }}
            >
              <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-sm">
                Start
              </span>
              <span className="text-3xl">🚀</span>
              <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent drop-shadow-sm">
                Adventure
              </span>
            </div>
          </motion.button>
        </motion.div>
      </div>

      {/* 单词明细模态框 */}
      <WordHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        userId={user.id}
        title={`${userProfile?.email?.split('@')[0] || '我的'}的单词本`}
      />
    </div>
  )
}