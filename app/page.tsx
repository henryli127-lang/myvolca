'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth, profiles, studyLogs, userProgress, articles, supabase } from '@/lib/supabase'
import Auth from './components/Auth'
import Settings from './components/Settings'
import StudentDashboard from './components/StudentDashboard'
import Learning from './components/Learning'
import Challenge from './components/Challenge'
import ReportCard from './components/ReportCard'
import StorySpark from './components/StorySpark'
import Library from './components/Library'
import ArticleView from './components/ArticleView'
import type { User } from '@supabase/supabase-js'

type AppStage = 'dashboard' | 'learning' | 'challenge' | 'report' | 'storyspark' | 'transition' | 'library' | 'article'

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
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
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

  const checkReadingProgress = (userId: string) => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem('reading_progress')
      if (saved) {
        const parsed = JSON.parse(saved)
        // 检查时间戳（24小时内有效）
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          // 情况1：有story且quiz未完成 → 返回进度（恢复文章阅读界面）
          if (parsed.story && !parsed.quizCompleted) {
            console.log('checkReadingProgress: 检测到未完成的story，返回进度')
            return parsed
          }
          // 情况2：有testWords → 返回进度（恢复阅读状态，可能是角色选择或文章生成）
          if (parsed.testWords && Array.isArray(parsed.testWords) && parsed.testWords.length > 0) {
            console.log('checkReadingProgress: 检测到testWords，返回进度')
            return parsed
          }
          // 情况3：只有selectedCharacter但没有story → 返回进度（恢复角色选择界面）
          if (parsed.selectedCharacter && !parsed.story) {
            console.log('checkReadingProgress: 检测到角色选择但未生成story，返回进度')
            return parsed
          }
          // 情况4：有story但quiz已完成 → 清除进度（应该回到dashboard）
          if (parsed.story && parsed.quizCompleted) {
            console.log('checkReadingProgress: story已完成quiz，清除进度')
            localStorage.removeItem('reading_progress')
            return null
          }
        } else {
          // 超过24小时，清除旧进度
          localStorage.removeItem('reading_progress')
        }
      }
    } catch (error) {
      console.error('检查阅读进度失败:', error)
      localStorage.removeItem('reading_progress')
    }
    return null
  }

  const checkReportProgress = (userId: string) => {
    if (typeof window === 'undefined') return null
    try {
      const reportProgressKey = `report_progress_${userId}`
      const saved = localStorage.getItem(reportProgressKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 检查时间戳（24小时内有效）
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          // 验证是否有 testResults 和 testWords
          if (parsed.testResults && parsed.testWords && Array.isArray(parsed.testWords) && parsed.testWords.length > 0) {
            return parsed
          }
        } else {
          // 超过24小时，清除旧进度
          localStorage.removeItem(reportProgressKey)
        }
      }
    } catch (error) {
      console.error('检查成绩单进度失败:', error)
      if (typeof window !== 'undefined' && user) {
        localStorage.removeItem(`report_progress_${userId}`)
      }
    }
    return null
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
      if (!user) {
        // 如果没有用户，确保loading为false（显示登录页）
        return
      }
      if (userProfile) {
        setLoading(false)
        return
      }
      if (isFetchingProfile.current) {
        // 如果正在获取，保持loading状态
        return
      }

      try {
        isFetchingProfile.current = true
        // 确保在开始获取时loading为true（防止短暂显示错误页面）
        setLoading(true)
        setProfileError(false) // 重置错误状态
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
            // 优先检查成绩单进度（测试完成后未查看的成绩单）
            const reportProgress = checkReportProgress(user.id)
            if (reportProgress) {
              // 恢复成绩单状态
              setTestResults(reportProgress.testResults)
              setTestWords(reportProgress.testWords.map((w: any) => ({
                id: w.id || 0,
                word: w.word,
                translation: w.translation,
                translationError: w.translationError,
                spellingError: w.spellingError
              })))
              setAppStage('report')
            } else {
              // 其次检查阅读进度
              const readingProgress = checkReadingProgress(user.id)
              if (readingProgress) {
                // 恢复阅读状态
                // 情况1：有story且quiz未完成 → 跳转到storyspark显示文章
                if (readingProgress.story && !readingProgress.quizCompleted) {
                  console.log('恢复未完成的story，跳转到storyspark显示文章')
                  if (readingProgress.testWords && Array.isArray(readingProgress.testWords) && readingProgress.testWords.length > 0) {
                    setTestWords(readingProgress.testWords.map((w: any) => ({
                      id: w.id || 0,
                      word: w.word,
                      translation: w.translation
                    })))
                  }
                  setAppStage('storyspark')
                }
                // 情况2：有testWords → 跳转到storyspark（StorySpark会自己恢复状态，可能是角色选择或文章生成）
                else if (readingProgress.testWords && Array.isArray(readingProgress.testWords) && readingProgress.testWords.length > 0) {
                  console.log('恢复testWords，跳转到storyspark')
                  setTestWords(readingProgress.testWords.map((w: any) => ({
                    id: w.id || 0,
                    word: w.word,
                    translation: w.translation
                  })))
                  setAppStage('storyspark')
                }
                // 情况3：只有selectedCharacter但没有story → 跳转到storyspark显示角色选择界面
                else if (readingProgress.selectedCharacter && !readingProgress.story) {
                  console.log('恢复角色选择状态，跳转到storyspark显示角色选择')
                  setAppStage('storyspark')
                }
                // 其他情况，回到dashboard
                else {
                  console.log('阅读进度不符合恢复条件，回到dashboard')
                  setAppStage('dashboard')
                }
              } else if (checkTestProgress(user.id)) {
                setAppStage('challenge')
              } else {
                setAppStage('dashboard')
              }
            }
          }
          // 只有在成功获取profile后才结束loading
          setLoading(false)
        } else if (error && error.code !== 'PGRST116') {
          // 只有在真正的错误时才结束loading并显示错误
          setProfileError(true)
          setLoading(false)
        } else {
          // 如果是PGRST116（记录不存在），可能是新用户，等待一下再重试
          // 注意：这里不设置loading=false，保持loading状态，等待重试完成
          console.log('⚠️ 用户资料不存在，可能是新用户，等待重试...')
          setTimeout(async () => {
            if (!userProfile && user && !isFetchingProfile.current) {
              // 重试一次
              isFetchingProfile.current = true
              try {
                const { data: retryProfile, error: retryError } = await profiles.get(user.id)
                if (retryProfile) {
                  setUserProfile(retryProfile)
                  setProfileError(false)
                  // 设置默认路由
                  if (retryProfile.role === 'child') {
                    setAppStage('dashboard')
                  }
                  setLoading(false)
                } else if (retryError && retryError.code !== 'PGRST116') {
                  // 真正的错误
                  setProfileError(true)
                  setLoading(false)
                } else {
                  // 仍然不存在，可能是新用户，显示错误但允许继续
                  setProfileError(true)
                  setLoading(false)
                }
              } catch (retryErr) {
                console.error('重试获取资料异常:', retryErr)
                setProfileError(true)
                setLoading(false)
              } finally {
                isFetchingProfile.current = false
              }
            }
          }, 1000) // 等待1秒后重试
        }
      } catch (err) {
        console.error('获取资料发生异常:', err)
        setProfileError(true)
        setLoading(false) // 异常时结束loading
      } finally {
        isFetchingProfile.current = false
      }
    }

    fetchProfile()
  }, [user, userProfile]) // 依赖项：只有当 user 或 userProfile 变化时才执行

  // ==========================================
  // 其他逻辑
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

// ... (保留上面的代码)
// ... 替换原有的 handleLogout 函数 ...
const handleLogout = async (force: boolean = false) => {
  console.log(`执行登出流程 (强制: ${force})...`)
  
  // 1. 立即清除无操作定时器
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = null
  }

  // 2. 强制保存学习记录 (串行等待)
  // 只要不是强制退出且用户存在，就尝试保存，不进行 Session 预检查，不设置超时跳过
  if (!force && user && !profileError) {
    try {
      console.log('正在保存学习记录...')
      // ✅ 关键：直接 await，死等数据库响应。
      // 这确保了在 Token 被清除前，写入请求一定已经完成了。
      await logStudyDuration()
      console.log('✅ 学习记录保存步骤结束')
    } catch (error) {
      // 即使报错（如断网），也只打印日志，然后继续执行下面的登出，防止用户退不出来
      console.error('保存学习记录时出错:', error)
    }
  }

  // 3. 执行登出 (清理 Session)
  try { 
    console.log('正在执行 Supabase 登出...')
    await auth.signOut() 
  } catch(e) {
    console.error('Supabase 登出出错:', e)
  }

  // 4. 清理本地状态 (UI 重置)
  if (typeof window !== 'undefined' && user) {
      try {
          localStorage.removeItem(`test_progress_${user.id}`)
          localStorage.removeItem(`word_list_${user.id}`)
          localStorage.removeItem(`learning_progress_${user.id}`)
          localStorage.removeItem(`report_progress_${user.id}`)
      } catch (e) { }
  }

  // 5. 重置 React 状态
  setUser(null)
  setUserProfile(null)
  setProfileError(false)
  setAppStage('dashboard')
  setLoading(false)
  isFetchingProfile.current = false
  
  // 重置会话 ID，为下一次登录做准备
  sessionStartTime.current = new Date()
  sessionId.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}  // 注意：已移除自动登出逻辑，用户不会被自动logout
  // 用户必须手动点击退出按钮才会登出

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
      
      // 保存成绩单状态到 localStorage，以便退出后再次登录能恢复
      if (typeof window !== 'undefined' && user) {
        try {
          const reportProgressKey = `report_progress_${user.id}`
          localStorage.setItem(reportProgressKey, JSON.stringify({
            testResults: results,
            testWords: results.testWords,
            timestamp: Date.now()
          }))
        } catch (error) {
          console.error('保存成绩单进度失败:', error)
        }
      }
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
        // 根据是否有错误决定status：如果有错误则保持'learning'，如果没有错误则标记为'mastered'
        const status = (transErrorCount === 0 && spellErrorCount === 0) ? 'mastered' : 'learning'
        // 更新所有单词的测试结果（包括没有错误的单词）
        await userProgress.updateTestResults(word.id, transErrorCount, spellErrorCount, status)
      })).catch((err) => console.error('❌ 保存测试结果失败:', err))
    }
  }

  const handleBackToDashboard = () => {
    // 注意：返回仪表板时不清除进度，以便用户可以继续学习/测试/阅读
    // 进度会在完成学习/测试时自动清除
    setAppStage('dashboard')
    setTestResults(null)
    setSelectedArticleId(null)
    // 不清除 testWords，因为可能还有阅读进度需要恢复
    // setTestWords([])
    setSessionKey(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
    
    // 清除成绩单进度，因为用户已经查看过了
    if (typeof window !== 'undefined' && user) {
      try {
        localStorage.removeItem(`report_progress_${user.id}`)
      } catch (error) {
        console.error('清除成绩单进度失败:', error)
      }
    }
  }

  // 保存文章到图书馆
  const handleSaveArticle = async (article: {
    title: string
    content: string
    htmlContent: string
    imageUrl?: string
    quiz?: any
    character?: any
    setting?: any
  }) => {
    if (!user) return
    
    try {
      const { error } = await articles.save(user.id, article)
      if (error) {
        console.error('保存文章到图书馆失败:', error)
      } else {
        console.log('文章已保存到图书馆')
      }
    } catch (err) {
      console.error('保存文章异常:', err)
    }
  }

  // 打开图书馆
  const handleOpenLibrary = () => {
    setAppStage('library')
    setSelectedArticleId(null)
  }

  // 查看文章
  const handleViewArticle = (articleId: string) => {
    setSelectedArticleId(articleId)
    setAppStage('article')
  }

  // 返回图书馆
  const handleBackToLibrary = () => {
    setAppStage('library')
    setSelectedArticleId(null)
  }

  // 监听 StorySpark 打开事件
  useEffect(() => {
    const handleOpenStorySpark = (event: CustomEvent) => {
      const { testWords: words } = event.detail
      if (words && words.length > 0) {
        setTestWords(words)
        setAppStage('storyspark')
      }
    }

    window.addEventListener('openStorySpark', handleOpenStorySpark as EventListener)
    return () => {
      window.removeEventListener('openStorySpark', handleOpenStorySpark as EventListener)
    }
  }, [])

  // ==========================================
  // 渲染层
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-candy-blue border-t-transparent rounded-full"
        />
        <p className="ml-4 text-candy-blue font-bold">Loading...</p>
      </div>
    )
  }

  // 只有在loading为false且确实有错误时才显示错误页面
  // 如果还在loading，应该显示loading页面，而不是错误页面
  if (!loading && user && (!userProfile || profileError)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-600 mb-2">无法加载用户资料</h2>
        <p className="text-gray-600 mb-6">请检查网络连接或刷新页面。</p>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition"
          >
            刷新
          </button>
          <button 
            onClick={() => handleLogout(true)}
            className="px-6 py-2 bg-gray-500 text-white rounded-full shadow hover:bg-gray-600 transition"
          >
            退出
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  if (userProfile?.role && userProfile.role !== 'child') {
    if (typeof window !== 'undefined') {
      window.location.href = '/parent/dashboard'
      return <div className="min-h-screen flex items-center justify-center">跳转中...</div>
    }
  }

  return (
    <div className="min-h-screen font-quicksand">
      {/* 设置按钮已移除，现在由StudentDashboard组件内的三个图标替代 */}
      
      <AnimatePresence mode="wait">
        {appStage === 'transition' && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div className="text-6xl font-bold text-white text-center">
              Challenge Unlocked! ⚔️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {appStage === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StudentDashboard
              user={user}
              userProfile={userProfile}
              onStartAdventure={handleStartAdventure}
              onOpenLibrary={handleOpenLibrary}
              onLogout={() => handleLogout()}
            />
          </motion.div>
        )}

        {appStage === 'learning' && (
          <motion.div key={`learning-${sessionKey}`} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
            <Learning
              user={user}
              targetCount={userProfile?.daily_learning_goal || 20}
              onComplete={handleLearningComplete}
              onLogout={() => handleLogout()}
            />
          </motion.div>
        )}

        {appStage === 'challenge' && (
          <motion.div key={`challenge-${sessionKey}`} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
            <Challenge
              user={user}
              testCount={userProfile?.daily_testing_goal || 30}
              onComplete={handleChallengeComplete}
              onLogout={() => handleLogout()}
            />
          </motion.div>
        )}

        {appStage === 'report' && testResults && (
          <motion.div key="report" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <ReportCard
              user={user}
              results={testResults}
              testWords={testWords}
              onBack={handleBackToDashboard}
              onLogout={() => handleLogout()}
            />
          </motion.div>
        )}

        {appStage === 'storyspark' && (
          <motion.div key="storyspark" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <StorySpark
              testWords={testWords.length > 0 ? testWords : []}
              userId={user?.id}
              onBack={handleBackToDashboard}
              onLogout={() => handleLogout()}
              onSaveArticle={handleSaveArticle}
            />
          </motion.div>
        )}

        {appStage === 'library' && user && (
          <motion.div key="library" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <Library
              user={user}
              onBack={handleBackToDashboard}
              onViewArticle={handleViewArticle}
              onLogout={() => handleLogout()}
            />
          </motion.div>
        )}

        {appStage === 'article' && user && selectedArticleId && (
          <motion.div key="article" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <ArticleView
              user={user}
              articleId={selectedArticleId}
              onBack={handleBackToLibrary}
              onLogout={() => handleLogout()}
            />
          </motion.div>
        )}
      </AnimatePresence>

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