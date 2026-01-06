'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth, profiles, studyLogs, userProgress, supabase } from '@/lib/supabase'
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
  const [profileError, setProfileError] = useState(false)
  
  // 使用 ref 来追踪“正在获取”状态，避免 React 渲染周期的干扰
  const isFetchingProfile = useRef(false)

  const [showSettings, setShowSettings] = useState(false)
  const [appStage, setAppStage] = useState<AppStage>('dashboard')
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [testWords, setTestWords] = useState<TestWord[]>([])
  const [sessionKey, setSessionKey] = useState<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const sessionStartTime = useRef<Date>(new Date())
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000 

  const checkTestProgress = (userId: string) => {
    if (typeof window === 'undefined') return false
    try {
      const testProgressKey = `test_progress_${userId}`
      const savedTest = localStorage.getItem(testProgressKey)
      if (savedTest) {
        const parsed = JSON.parse(savedTest)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return true
        } else {
          localStorage.removeItem(testProgressKey)
        }
      }
    } catch (error) {
      console.error('检查测试进度失败:', error)
    }
    return false
  }

  // ==========================================
  // 1. 认证监听 (只负责设置 User)
  // ==========================================
  useEffect(() => {
    let mounted = true

    // 初始化检查
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        // 注意：这里不设 loading false，等待 Profile 获取完再设
      } else {
        setLoading(false) // 没有用户，直接结束 loading 显示登录页
      }
    })

    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      console.log('Auth状态变更:', event)

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        // 同样不在这里设 loading false，交给下面的 Effect
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        setAppStage('dashboard')
        setLoading(false)
        isFetchingProfile.current = false
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ==========================================
  // 2. 资料获取 (监听 User 变化，带防重锁)
  // ==========================================
  useEffect(() => {
    const fetchProfile = async () => {
      // 各种卫语句：如果没有用户，或者已经有资料，或者正在获取，都直接退出
      if (!user) return
      if (userProfile) {
        setLoading(false)
        return
      }
      if (isFetchingProfile.current) return

      try {
        isFetchingProfile.current = true
        console.log('🚀 开始获取用户资料...')
        
        // 直接请求，移除所有人为超时限制
        const { data: profile, error } = await profiles.get(user.id)

        if (error) {
           console.error('获取资料出错:', error)
           // PGRST116 只是代表没找到记录（可能是新用户数据还没写入），不是系统错误
           if (error.code !== 'PGRST116') {
             setProfileError(true)
           }
        }

        if (profile) {
          console.log('✅ 成功获取资料:', profile.role)
          setUserProfile(profile)
          setProfileError(false)

          // 路由跳转逻辑
          if (profile.role === 'child') {
            if (checkTestProgress(user.id)) {
              setAppStage('challenge')
            } else {
              setAppStage('dashboard')
            }
          }
        }
      } catch (err) {
        console.error('获取资料发生异常:', err)
        setProfileError(true)
      } finally {
        isFetchingProfile.current = false
        setLoading(false) // 无论成功失败，都结束 Loading
      }
    }

    fetchProfile()
  }, [user, userProfile]) // 依赖项：只有当 user 或 userProfile 变化时才执行

  // ==========================================
  // 其他逻辑保持不变
  // ==========================================

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

  const handleLogout = async (force: boolean = false) => {
    console.log(`执行登出流程 (强制: ${force})...`)
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // 尝试记录日志和登出，给予短超时，避免卡死
    if (!force && user && !profileError) {
        try {
            const tasks = [auth.signOut()]
            if (!profileError) tasks.push(logStudyDuration())
            
            // 2秒超时
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000))
            await Promise.race([Promise.all(tasks), timeoutPromise])
        } catch (e) {
            console.warn('登出/日志记录超时或失败:', e)
        }
    } else {
        // 强制模式或已出错，只尝试登出，不记录日志
        try { auth.signOut() } catch(e) {}
    }

    // 强制清理本地状态
    if (typeof window !== 'undefined' && user) {
        try {
            localStorage.removeItem(`test_progress_${user.id}`)
            localStorage.removeItem(`word_list_${user.id}`)
            localStorage.removeItem(`learning_progress_${user.id}`)
        } catch (e) { }
    }

    setUser(null)
    setUserProfile(null)
    setProfileError(false)
    setAppStage('dashboard')
    setLoading(false)
    isFetchingProfile.current = false
    
    sessionStartTime.current = new Date()
    sessionId.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 监听活动
  useEffect(() => {
    if (!user) return
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    const handleActivity = () => resetInactivityTimer()
    events.forEach(event => document.addEventListener(event, handleActivity, true))
    resetInactivityTimer()
    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity, true))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [user])

  // 页面切换
  useEffect(() => {
    const handleBeforeUnload = () => { if(user) logStudyDuration() }
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
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const handleAuthSuccess = (authenticatedUser: User) => {
    // 这里不需要手动调 fetchUserProfile，因为 setUser 会触发上面的 useEffect
    setUser(authenticatedUser)
  }

  const handleStartAdventure = () => {
    if (typeof window !== 'undefined' && user) {
      try {
        const testProgressKey = `test_progress_${user.id}`
        const savedTest = localStorage.getItem(testProgressKey)
        if (savedTest) {
          const parsed = JSON.parse(savedTest)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            setAppStage('challenge')
            return
          } else {
            localStorage.removeItem(testProgressKey)
          }
        }
      } catch (error) {
        console.error('检查测试进度失败:', error)
      }
    }
    setAppStage('learning')
  }

  const handleLearningComplete = () => {
    setAppStage('transition')
    setTimeout(() => {
      setAppStage('challenge')
    }, 2000)
  }

  const handleChallengeComplete = async (results: TestResults) => {
    try {
      if (!results || !results.testWords) return
      setTestResults(results)
      setTestWords(results.testWords)
      setSessionKey(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
      setAppStage('report')
    } catch (error) {
      console.error('更新 UI 状态失败:', error)
      setAppStage('report')
    }

    if (typeof window !== 'undefined' && user) {
      try {
        localStorage.removeItem(`test_progress_${user.id}`)
        localStorage.removeItem(`word_list_${user.id}`)
        localStorage.removeItem(`learning_progress_${user.id}`)
      } catch (error) { console.error('清除缓存失败:', error) }
    }

    if (user && results.testWords) {
      Promise.all(results.testWords.map(async (word) => {
        const transErrorCount = word.translationError ? 1 : 0
        const spellErrorCount = word.spellingError ? 1 : 0
        if (transErrorCount > 0 || spellErrorCount > 0) {
           await userProgress.updateTestResults(word.id, transErrorCount, spellErrorCount)
        }
      })).catch((err) => console.error('❌ 保存测试结果失败:', err))
    }
  }

  const handleBackToDashboard = () => {
    if (typeof window !== 'undefined' && user) {
      try {
        localStorage.removeItem(`test_progress_${user.id}`)
        localStorage.removeItem(`word_list_${user.id}`)
        localStorage.removeItem(`learning_progress_${user.id}`)
      } catch (error) { console.error('清除缓存失败:', error) }
    }
    setAppStage('dashboard')
    setTestResults(null)
    setTestWords([])
    setSessionKey(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  }

  // ==========================================