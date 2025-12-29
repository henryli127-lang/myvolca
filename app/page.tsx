'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// 1. 修改导入部分 (约第 6 行)
// 添加 userProgress
import { auth, profiles, studyLogs, userProgress } from '@/lib/supabase'
import Auth from './components/Auth'
import Settings from './components/Settings'
import StudentDashboard from './components/StudentDashboard'
import Learning from './components/Learning'
import Challenge from './components/Challenge'
import ReportCard from './components/ReportCard'
import type { User } from '@supabase/supabase-js'

type AppStage = 'dashboard' | 'learning' | 'challenge' | 'report' | 'transition'

interface TestResults {
  translationCorrect: number
  translationTotal: number
  spellingCorrect: number
  spellingTotal: number
  translationErrors: number
  spellingErrors: number
  testWords: Array<{ 
    id: number
    word: string
    translation: string
    translationError?: boolean
    spellingError?: boolean
  }>
}

interface TestWord {
  id: number
  word: string
  translation: string
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [appStage, setAppStage] = useState<AppStage>('dashboard')
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [testWords, setTestWords] = useState<TestWord[]>([])
  const [sessionKey, setSessionKey] = useState<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const sessionStartTime = useRef<Date>(new Date())
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10分钟

  // 检查是否有未完成的测试进度
  const checkTestProgress = (userId: string) => {
    if (typeof window === 'undefined') return false
    try {
      const testProgressKey = `test_progress_${userId}`
      const savedTest = localStorage.getItem(testProgressKey)
      if (savedTest) {
        const parsed = JSON.parse(savedTest)
        // 检查进度是否过期（超过24小时）
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return true
        } else {
          // 进度过期，清除
          localStorage.removeItem(testProgressKey)
        }
      }
    } catch (error) {
      console.error('检查测试进度失败:', error)
    }
    return false
  }

  // 检查认证状态
  useEffect(() => {
    const checkAuth = async () => {
      const { user: currentUser } = await auth.getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
        const { data: profile } = await profiles.get(currentUser.id)
        if (profile) {
          setUserProfile(profile)
          // 如果是孩子，检查是否有未完成的测试进度
          if (profile.role === 'child') {
            if (checkTestProgress(currentUser.id)) {
              console.log('检测到未完成的测试进度，直接进入测试阶段')
              setAppStage('challenge')
            } else {
              setAppStage('dashboard')
            }
          }
        }
        setLoading(false)
      } else {
        setLoading(false)
      }
    }
    checkAuth()

    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        const { data: profile } = await profiles.get(session.user.id)
        if (profile) {
          setUserProfile(profile)
          if (profile.role === 'child') {
            if (checkTestProgress(session.user.id)) {
              console.log('检测到未完成的测试进度，直接进入测试阶段')
              setAppStage('challenge')
            } else {
              setAppStage('dashboard')
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        setAppStage('dashboard')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 记录学习时长
  const logStudyDuration = async () => {
    if (!user) return

    const endTime = new Date()
    const duration = Math.round((endTime.getTime() - sessionStartTime.current.getTime()) / 1000 / 60)

    if (duration > 0) {
      await studyLogs.create(
        user.id,
        sessionId.current,
        sessionStartTime.current.toISOString(),
        endTime.toISOString(),
        duration
      )
    }
  }

  // 重置无操作定时器
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    
    if (user) {
      inactivityTimerRef.current = setTimeout(async () => {
        console.log('10分钟无操作，自动退出')
        await handleLogout()
      }, INACTIVITY_TIMEOUT)
    }
  }

  const handleLogout = async () => {
    try {
      // 清除无操作定时器
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      
      await logStudyDuration()
      await auth.signOut()
      setUser(null)
      setUserProfile(null)
      setAppStage('dashboard')
      setTestResults(null)
      setTestWords([])
      sessionStartTime.current = new Date()
      sessionId.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } catch (error) {
      console.error('退出登录时出错:', error)
      setUser(null)
      setUserProfile(null)
      setAppStage('dashboard')
    }
  }

  // 监听用户活动（鼠标移动、键盘输入、点击等）
  useEffect(() => {
    if (!user) return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      resetInactivityTimer()
    }

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    resetInactivityTimer()

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
    }
  }, [user])

  // 处理页面切换和关闭
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        logStudyDuration()
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden && user) {
        logStudyDuration()
        sessionStartTime.current = new Date()
        sessionId.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (user) {
        logStudyDuration()
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const handleAuthSuccess = async (authenticatedUser: User) => {
    setUser(authenticatedUser)
    const { data: profile } = await profiles.get(authenticatedUser.id)
    if (profile) {
      setUserProfile(profile)
      if (profile.role === 'child') {
        setAppStage('dashboard')
      }
    }
    setLoading(false)
  }

  const handleStartAdventure = () => {
    // 检查是否有未完成的测试进度
    if (typeof window !== 'undefined' && user) {
      try {
        const testProgressKey = `test_progress_${user.id}`
        const savedTest = localStorage.getItem(testProgressKey)
        if (savedTest) {
          const parsed = JSON.parse(savedTest)
          // 检查进度是否过期（超过24小时）
          if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            console.log('检测到未完成的测试进度，直接进入测试阶段')
            setAppStage('challenge')
            return
          } else {
            // 进度过期，清除
            localStorage.removeItem(testProgressKey)
          }
        }
      } catch (error) {
        console.error('检查测试进度失败:', error)
      }
    }
    
    // 检查是否有未完成的学习进度
    const progressKey = `learning_progress_${user?.id}`
    if (typeof window !== 'undefined' && user) {
      try {
        const saved = localStorage.getItem(progressKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          // 如果进度未完成（count < 20），继续学习
          if (parsed.count && parsed.count < 20) {
            console.log(`检测到未完成的学习进度: ${parsed.count}/20，继续学习`)
          }
        }
      } catch (error) {
        console.error('检查学习进度失败:', error)
      }
    }
    setAppStage('learning')
  }

  const handleLearningComplete = () => {
    // 显示过渡动画
    setAppStage('transition')
    setTimeout(() => {
      setAppStage('challenge')
    }, 2000)
  }
// 2. 修改 handleChallengeComplete 函数 (约 245 行)

const handleChallengeComplete = async (results: TestResults) => {
    // 1. 【优先】立即更新 UI，让用户看到成绩单，不再等待
    try {
      if (!results) {
        console.error('handleChallengeComplete: results 为空')
        return
      }

      // 确保 testWords 存在
      if (!results.testWords || !Array.isArray(results.testWords)) {
        console.error('handleChallengeComplete: testWords 无效', results.testWords)
        results.testWords = []
      }

      // 立即设置状态并跳转
      setTestResults(results)
      setTestWords(results.testWords)
      setSessionKey(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
      
      // 🚀 关键：立即跳转到报告页，不要等数据库
      setAppStage('report')

    } catch (error) {
      console.error('更新 UI 状态失败:', error)
      // 即使出错，也尽量尝试跳转
      setAppStage('report')
    }

    // 2. 【后台】清除缓存
    if (typeof window !== 'undefined' && user) {
      try {
        localStorage.removeItem(`test_progress_${user.id}`)
        localStorage.removeItem(`word_list_${user.id}`)
        localStorage.removeItem(`learning_progress_${user.id}`)
        console.log('缓存已清除')
      } catch (error) {
        console.error('清除缓存失败:', error)
      }
    }

    // 3. 【后台】异步保存数据到数据库 (Fire and Forget)
    // 这里的执行不会阻塞上面的界面跳转
    if (user && results.testWords) {
      console.log('正在后台保存测试结果到数据库...')
      
      // 不使用 await 阻塞整个函数，或者即使使用，UI 也已经渲染完了
      Promise.all(results.testWords.map(async (word) => {
        const transErrorCount = word.translationError ? 1 : 0
        const spellErrorCount = word.spellingError ? 1 : 0
        
        // 只有有错误时才更新，或者根据需求更新复习计数
        if (transErrorCount > 0 || spellErrorCount > 0) {
           await userProgress.updateTestResults(
             word.id, 
             transErrorCount, 
             spellErrorCount
           )
        }
      })).then(() => {
        console.log('✅ 测试结果后台保存完成')
      }).catch((err) => {
        console.error('❌ 保存测试结果失败:', err)
      })
    }
  }

  const handleBackToDashboard = () => {
    // 清除所有缓存和状态
    if (typeof window !== 'undefined' && user) {
      try {
        const testProgressKey = `test_progress_${user.id}`
        localStorage.removeItem(testProgressKey)
        const wordListKey = `word_list_${user.id}`
        localStorage.removeItem(wordListKey)
        const learningProgressKey = `learning_progress_${user.id}`
        localStorage.removeItem(learningProgressKey)
      } catch (error) {
        console.error('清除缓存失败:', error)
      }
    }
    
    // 重置所有状态
    setAppStage('dashboard')
    setTestResults(null)
    setTestWords([])
    
    // 生成新的 session key
    setSessionKey(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  }

  // 如果未认证，显示登录/注册表单
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  // 如果还在加载中或用户资料未加载完成，显示加载动画
  if (loading || !userProfile) {
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

  // 如果不是孩子角色，重定向到家长 dashboard
  if (userProfile.role && userProfile.role !== 'child') {
    if (typeof window !== 'undefined') {
      window.location.href = '/parent/dashboard'
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">正在跳转到家长看板...</p>
          </div>
        </div>
      )
    }
    return null
  }


  return (
    <div className="min-h-screen font-quicksand">
      {/* 设置按钮 */}
      {appStage === 'dashboard' && (
        <div className="absolute top-4 right-4 z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(true)}
            className="bg-white/80 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            ⚙️ 设置
          </motion.button>
        </div>
      )}

      {/* 过渡动画 */}
      <AnimatePresence mode="wait">
        {appStage === 'transition' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, rotate: 180 }}
              className="text-6xl font-bold text-white text-center"
            >
              Challenge Unlocked! ⚔️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主要内容 */}
      <AnimatePresence mode="wait">
        {appStage === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StudentDashboard
              user={user}
              userProfile={userProfile}
              onStartAdventure={handleStartAdventure}
              onLogout={handleLogout}
            />
          </motion.div>
        )}

        {appStage === 'learning' && (
          <motion.div
            key={`learning-${sessionKey}`}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
          >
            <Learning
              user={user}
              targetCount={userProfile?.daily_learning_goal || 20}
              onComplete={handleLearningComplete}
              onLogout={handleLogout}
            />
          </motion.div>
        )}

        {appStage === 'challenge' && (
          <motion.div
            key={`challenge-${sessionKey}`}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
          >
            <Challenge
              user={user}
              testCount={userProfile?.daily_testing_goal || 30}
              onComplete={handleChallengeComplete}
              onLogout={handleLogout}
            />
          </motion.div>
        )}

        {appStage === 'report' && testResults && (
          <motion.div
            key="report"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <ReportCard
              user={user}
              results={testResults}
              testWords={testWords}
              onBack={handleBackToDashboard}
              onLogout={handleLogout}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 设置弹窗 */}
      {showSettings && (
        <Settings
          userId={user.id}
          userProfile={userProfile}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={(profile) => setUserProfile(profile)}
        />
      )}
    </div>
  )
}
