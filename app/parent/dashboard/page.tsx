'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Medal, Star, Crown, Trophy, Award, Target, LogOut, ChevronDown, Eye } from 'lucide-react'
import { auth, profiles, parent, words } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import WordHistoryModal from '@/app/components/WordHistoryModal'

interface ChildProfile {
  id: string
  email: string
  streak_days: number | null
  last_login_at: string | null
}

interface DashboardData {
  todayReviewed: number
  weeklyStats: Array<{ day: string; count: number }>
  topErrorWords: Array<{
    wordId: number
    word: string
    translation: string
    totalErrors: number
    translationErrors: number
    spellingErrors: number
  }>
  totalMastered: number
}

const DAILY_GOAL = 20

// 勋章等级定义
const ACHIEVEMENTS = [
  { id: 1, name: 'Novice', icon: Medal, threshold: 10, color: '#FFD700' },
  { id: 2, name: 'Explorer', icon: Star, threshold: 50, color: '#FF6B6B' },
  { id: 3, name: 'Master', icon: Crown, threshold: 200, color: '#4ECDC4' },
  { id: 4, name: 'Champion', icon: Trophy, threshold: 500, color: '#95E1D3' },
  { id: 5, name: 'Legend', icon: Award, threshold: 1000, color: '#F38181' },
  { id: 6, name: 'Perfect', icon: Target, threshold: 2000, color: '#AA96DA' },
]

// Skeleton 加载组件
const SkeletonCard = () => (
  <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
    <div className="h-32 bg-gray-200 rounded"></div>
  </div>
)

export default function ParentDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [showChildDropdown, setShowChildDropdown] = useState(false)
  const [learningGoal, setLearningGoal] = useState(20)
  const [testingGoal, setTestingGoal] = useState(30)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  // 检查认证状态（优化：先显示框架，再加载数据）
  useEffect(() => {
    const checkAuth = async () => {
      const { user: currentUser } = await auth.getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
        // 先设置loading为false，显示dashboard框架
        setLoading(false)
        
        // 异步加载profile和children数据（不阻塞UI）
        ;(async () => {
          try {
            const { data: profile } = await profiles.get(currentUser.id)
            if (profile && profile.role === 'parent') {
              setUserProfile(profile)
              // 获取关联的孩子
              const { data: childrenData } = await profiles.getChildren(currentUser.id)
              if (childrenData && childrenData.length > 0) {
                setChildren(childrenData)
                setSelectedChildId(childrenData[0].id)
                setSelectedChild(childrenData[0])
              }
            }
          } catch (error) {
            console.error('加载用户数据失败:', error)
          }
        })()
      } else {
        setLoading(false)
      }
    }
    checkAuth()

    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        window.location.href = '/'
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

// 加载仪表盘数据 (优化：先显示看板，再异步加载数据)
useEffect(() => {
    if (!selectedChildId) return

    // 先初始化空数据，立即显示看板框架
    if (!dashboardData) {
      setDashboardData({
        todayReviewed: 0,
        totalMastered: 0,
        weeklyStats: [],
        topErrorWords: []
      })
      setDataLoading(false) // 先显示看板，不显示加载状态
    }

    // 异步加载数据（不阻塞UI）
    const loadDashboardData = async () => {
      setDataLoading(true)
      try {
        console.log('正在获取孩子数据:', selectedChildId)
        
        // 调用新的全能 RPC 函数
        const { data, error } = await parent.getChildDashboardStats(selectedChildId)

        if (error) {
          console.error('RPC 调用出错:', error)
          return
        }

        if (data) {
          console.log('看板数据加载成功:', data)
          
          // 直接使用 RPC 返回的 JSON 数据
          // 注意：RPC 返回的 key 可能会是驼峰或全小写，取决于数据库。
          // 我们在 SQL 里用了 json_build_object 指定了 key，所以应该是准确的。
          setDashboardData({
            todayReviewed: data.todayReviewed || 0,
            totalMastered: data.totalMastered || 0,
            weeklyStats: data.weeklyStats || [],
            topErrorWords: data.topErrorWords || []
          })
        }
      } catch (error) {
        console.error('加载仪表盘数据失败:', error)
      } finally {
        setDataLoading(false)
      }
    }

    loadDashboardData()
  }, [selectedChildId, selectedChild]) // 移除 userProfile 依赖，允许在userProfile加载前就开始加载数据

  // 处理退出登录
  const handleLogout = async () => {
    await auth.signOut()
    window.location.href = '/'
  }

  // 切换孩子
  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId)
    const child = children.find(c => c.id === childId)
    setSelectedChild(child || null)
    setShowChildDropdown(false)
  }

  // 加载孩子的目标值
  useEffect(() => {
    const loadChildGoals = async () => {
      if (!selectedChildId) return
      try {
        const { data, error } = await profiles.get(selectedChildId)
        if (!error && data) {
          setLearningGoal(data.daily_learning_goal || 20)
          setTestingGoal(data.daily_testing_goal || 30)
        }
      } catch (error) {
        console.error('加载孩子目标失败:', error)
      }
    }
    loadChildGoals()
  }, [selectedChildId])

  // 保存目标值
  const handleSaveGoals = async () => {
    if (!selectedChildId) return
    
    // 验证范围
    if (learningGoal < 5 || learningGoal > 50) {
      setSaveMessage('学习目标必须在 5-50 之间')
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    if (testingGoal < 5 || testingGoal > 100) {
      setSaveMessage('测试目标必须在 5-100 之间')
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSaving(true)
    setSaveMessage(null)
    
    try {
      const { data, error } = await parent.updateChildGoals(selectedChildId, learningGoal, testingGoal)
      if (error) {
        console.error('保存目标失败:', error)
        setSaveMessage('保存失败，请重试')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage('设置已更新 ✨')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (error) {
      console.error('保存目标异常:', error)
      setSaveMessage('保存失败，请重试')
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  // 计算今日进度百分比
  const todayProgress = dashboardData ? (dashboardData.todayReviewed / DAILY_GOAL) * 100 : 0
  const isGoalAchieved = dashboardData ? dashboardData.todayReviewed >= DAILY_GOAL : false

  // 获取已解锁的勋章
  const unlockedAchievements = ACHIEVEMENTS.filter(
    a => dashboardData && dashboardData.totalMastered >= a.threshold
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  // 如果用户未登录，显示提示
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">请先登录家长账号</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  // 如果profile已加载且不是家长，显示提示（但允许在加载前显示框架）
  if (userProfile && userProfile.role !== 'parent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">请先登录家长账号</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  // 如果children已加载且为空，显示提示（但允许在加载前显示框架）
  if (userProfile && children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm">
          <p className="text-gray-600 mb-4">您还没有关联任何孩子</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  const childName = selectedChild?.email?.split('@')[0] || '孩子'
  const parentName = userProfile?.email?.split('@')[0] || '家长'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 font-quicksand">
      {/* 顶部导航栏 */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              欢迎回来，{parentName} 👋
            </h1>
            <p className="text-gray-600">监控孩子的学习进度</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 切换孩子下拉菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowChildDropdown(!showChildDropdown)}
                className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200"
              >
                <span className="text-gray-700 font-medium">
                  {selectedChild?.email?.split('@')[0] || '选择孩子'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showChildDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showChildDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-10">
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => handleChildChange(child.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                        selectedChildId === child.id ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      {child.email.split('@')[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 退出按钮 */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>退出</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* 主要内容区域 - 始终显示看板框架，数据加载时显示加载状态 */}
      <div className="max-w-7xl mx-auto">
        {/* 如果数据正在加载且没有初始数据，显示骨架屏 */}
        {dataLoading && !dashboardData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 模块一：今日概览 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm ${
                isGoalAchieved ? 'ring-2 ring-yellow-400' : ''
              }`}
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">今日概览</h2>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="w-48 h-48 transform -rotate-90">
                    {/* 背景圆 */}
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="16"
                    />
                    {/* 进度圆 */}
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      fill="none"
                      stroke={isGoalAchieved ? '#FFD700' : '#0984E3'}
                      strokeWidth="16"
                      strokeDasharray={`${2 * Math.PI * 80}`}
                      strokeDashoffset={`${2 * Math.PI * 80 * (1 - todayProgress / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-gray-800">
                      {dashboardData?.todayReviewed || 0}
                    </span>
                    <span className="text-gray-500 text-sm">/ {DAILY_GOAL}</span>
                    {isGoalAchieved && (
                      <span className="text-yellow-600 text-sm font-semibold mt-2">
                        ✨ 目标达成！
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 模块二：学习周报 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">学习周报</h2>
              <div className="w-full" style={{ height: '256px', minWidth: '300px' }}>
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={dashboardData?.weeklyStats || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const dayMap: { [key: string]: string } = {
                          'Monday': '周一',
                          'Tuesday': '周二',
                          'Wednesday': '周三',
                          'Thursday': '周四',
                          'Friday': '周五',
                          'Saturday': '周六',
                          'Sunday': '周日',
                        }
                        return dayMap[value] || value
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number | undefined) => {
                        if (value === undefined) return ['0 个单词', '掌握数量']
                        return [`${value} 个单词`, '掌握数量']
                      }}
                      labelFormatter={(label) => {
                        const dayMap: { [key: string]: string } = {
                          'Monday': '周一',
                          'Tuesday': '周二',
                          'Wednesday': '周三',
                          'Thursday': '周四',
                          'Friday': '周五',
                          'Saturday': '周六',
                          'Sunday': '周日',
                        }
                        return dayMap[label] || label
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {(dashboardData?.weeklyStats || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#6C5CE7" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* 模块三：薄弱环节 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">薄弱环节</h2>
              {dashboardData && dashboardData.topErrorWords.length > 0 ? (
                <>
                  <div className="space-y-3 mb-4">
                    {dashboardData.topErrorWords.map((word, index) => (
                      <div
                        key={word.wordId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">{word.word}</div>
                          <div className="text-sm text-gray-600">{word.translation}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-red-600 font-semibold">
                            {word.totalErrors} 次错误
                          </span>
                          <Eye className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">温馨提示：</span>
                      {childName} 在这些单词上遇到了困难。今晚一起花 5 分钟做个小测验吧！💪
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>太棒了！没有需要特别关注的薄弱环节 🎉</p>
                </div>
              )}
            </motion.div>

            {/* 模块四：勋章墙 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">勋章墙</h2>
              <div className="grid grid-cols-3 gap-4">
                {ACHIEVEMENTS.map(achievement => {
                  const isUnlocked = dashboardData
                    ? dashboardData.totalMastered >= achievement.threshold
                    : false
                  const Icon = achievement.icon

                  return (
                    <div
                      key={achievement.id}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${
                        isUnlocked
                          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300'
                          : 'bg-gray-50 border-2 border-dashed border-gray-300'
                      }`}
                    >
                      <Icon
                        className={`w-8 h-8 mb-2 ${
                          isUnlocked ? 'text-yellow-600' : 'text-gray-400'
                        }`}
                      />
                      <span
                        className={`text-xs font-semibold text-center ${
                          isUnlocked ? 'text-gray-800' : 'text-gray-400'
                        }`}
                      >
                        {achievement.name}
                      </span>
                      <span
                        className={`text-xs mt-1 ${
                          isUnlocked ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        {achievement.threshold}+
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  已掌握 <span className="font-bold text-blue-600">{dashboardData?.totalMastered || 0}</span> 个单词
                </p>
              </div>
            </motion.div>

            {/* 模块五：学习设置 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">学习设置</h2>
              
              <div className="space-y-6">
                {/* 每日学习目标 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    每日学习目标 (5-50)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setLearningGoal(Math.max(5, learningGoal - 1))}
                      disabled={learningGoal <= 5}
                      className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 font-bold text-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={learningGoal}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5
                        setLearningGoal(Math.max(5, Math.min(50, val)))
                      }}
                      className="flex-1 px-4 py-2 text-center text-xl font-bold border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => setLearningGoal(Math.min(50, learningGoal + 1))}
                      disabled={learningGoal >= 50}
                      className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 font-bold text-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 每日测试目标 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    每日测试目标 (5-100)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTestingGoal(Math.max(5, testingGoal - 1))}
                      disabled={testingGoal <= 5}
                      className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 font-bold text-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      value={testingGoal}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5
                        setTestingGoal(Math.max(5, Math.min(100, val)))
                      }}
                      className="flex-1 px-4 py-2 text-center text-xl font-bold border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => setTestingGoal(Math.min(100, testingGoal + 1))}
                      disabled={testingGoal >= 100}
                      className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 font-bold text-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 保存按钮和消息 */}
                <div className="space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveGoals}
                    disabled={saving}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {saving ? '保存中...' : '保存设置'}
                  </motion.button>
                  {saveMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-center text-sm font-semibold py-2 rounded-lg ${
                        saveMessage.includes('失败') 
                          ? 'bg-red-50 text-red-600' 
                          : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {saveMessage}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* 模块六：学习历史 - 应该放在这里，作为独立的卡片，和模块五是兄弟关系 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">学习历史</h2>
              
              <div className="flex items-center justify-center h-full py-4">                    
                <button 
                  onClick={() => setIsHistoryOpen(true)}
                  className="w-full py-4 bg-white text-candy-blue border-2 border-candy-blue rounded-xl font-bold hover:bg-candy-blue hover:text-white transition-all flex items-center justify-center gap-2 text-lg shadow-sm hover:shadow-md"
                >
                  📅 查看单词明细
                </button>
              </div>
            </motion.div>

          </div>
        )}
        {/* 数据加载指示器（在右上角显示，当数据正在更新时） */}
        {dataLoading && dashboardData && (
          <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">正在更新数据...</span>
          </div>
        )}
      </div>

      <WordHistoryModal 
  isOpen={isHistoryOpen} 
  onClose={() => setIsHistoryOpen(false)} 
  userId={selectedChildId|| ''} // 传入当前选中的孩子 ID
  title={`${selectedChild?.email?.split('@')[0] || '孩子'}的单词本`} // 💡 建议：Interface里好像没有 name 字段，建议用 email 前缀
/>
    </div>
  )
}

