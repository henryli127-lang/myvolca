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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-candy-blue border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20 p-6 font-quicksand">
      {/* 顶部按钮区域 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        {/* 查看单词明细按钮 */}
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsHistoryOpen(true)}
          className="group relative bg-white/80 backdrop-blur-sm text-gray-700 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl"
          title="查看单词明细"
        >
          <span>📅</span>
          {/* Tooltip */}
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
          className="group relative bg-white/80 backdrop-blur-sm text-gray-700 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl"
          title="我的图书馆"
        >
          <span>📚</span>
          {/* Tooltip */}
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
          className="group relative bg-white/80 backdrop-blur-sm text-gray-700 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl"
          title="退出"
        >
          <span>🚪</span>
          {/* Tooltip */}
          <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            退出
            <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></span>
          </span>
        </motion.button>
      </div>
      <div className="max-w-4xl mx-auto">
        {/* 欢迎消息 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
            {welcomeMessage}
          </h1>
        </motion.div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 连续登录天数 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl shadow-xl p-8 border-4 border-candy-orange"
          >
            <div className="text-center">
              <div className="text-6xl font-bold text-candy-orange mb-2">
                {streakDays}
              </div>
              <div className="text-xl text-gray-700 font-semibold">
                🔥 连续登录天数
              </div>
            </div>
          </motion.div>

          {/* 已掌握单词数 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl shadow-xl p-8 border-4 border-candy-green"
          >
            <div className="text-center">
              <div className="text-6xl font-bold text-candy-green mb-2">
                {masteredCount}
              </div>
              <div className="text-xl text-gray-700 font-semibold">
                📚 已掌握单词
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
            className="bg-gradient-to-r from-candy-blue to-candy-green text-white text-2xl font-bold py-6 px-12 rounded-3xl shadow-2xl transform transition-all hover:shadow-3xl"
            style={{
              fontFamily: 'Quicksand, sans-serif',
            }}
          >
            🚀 Start Adventure
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