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
  const [profileError, setProfileError] = useState(false) // 记录资料获取失败

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

  // 1. Loading 超时保护 (看门狗)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        if (loading) {
          console.warn('⚠️ 认证检查超时 (8s)，强制结束 Loading 状态');
          setLoading(false);
          // 如果超时时有用户但无资料，标记为错误
          if (user && !userProfile) {
             setProfileError(true);
          }
        }
      }, 8000); 
    }
    return () => {
      if (timer) clearTimeout(timer);
    }
  }, [loading, user, userProfile]);

  // 2. 获取用户资料的独立函数
  const fetchUserProfile = async (currentUser: User) => {
    try {
      setProfileError(false);
      // 给 fetch 加一个简单的超时，防止永久挂起
      const fetchPromise = profiles.get(currentUser.id);
      const timeoutPromise = new Promise<{data:any, error:any}>((resolve) => 
        setTimeout(() => resolve({data: null, error: 'TIMEOUT'}), 5000)
      );
      
      const { data: profile, error } = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (error || !profile) {
        console.warn('获取用户资料失败或超时:', error);
        setProfileError(true);
        return null;
      }
      
      setUserProfile(profile);
      return profile;
    } catch (err) {
      console.error('获取用户资料异常:', err);
      setProfileError(true);
      return null;
    }
  };

  // 3. 认证初始化与监听
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (mounted && session?.user) {
          setUser(session.user);
          const profile = await fetchUserProfile(session.user);
          
          if (mounted && profile) {
            if (profile.role === 'child') {
              if (checkTestProgress(session.user.id)) {
                setAppStage('challenge');
              } else {
                setAppStage('dashboard');
              }
            }
          }
        }
      } catch (err) {
        console.error('认证初始化异常:', err);
        if (mounted) {
           await handleLogout(true); // 出错时强制登出
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('Auth状态变更:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        if (!userProfile) {
           await fetchUserProfile(session.user);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setAppStage('dashboard');
        setProfileError(false);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, []); 

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

  // 🚀 核心修复：强健的登出函数 (支持超时强制退出)
  const handleLogout = async (force: boolean = false) => {
    console.log(`执行登出流程 (强制模式: ${force})...`);
    
    // 1. 立即清除本地计时器
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // 2. 尝试记录日志 (2秒超时)
    // 如果是强制退出或资料已报错，直接跳过，防止卡死
    if (!force && !profileError && user) {
        try {
            const logPromise = logStudyDuration();
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));
            await Promise.race([logPromise, timeoutPromise]);
        } catch (e) {
            console.warn('记录日志超时，忽略');
        }
    }

    // 3. 尝试 Supabase 登出 (2秒超时)
    try {
        const signOutPromise = auth.signOut();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('SignOut Timeout'), 2000));
        await Promise.race([signOutPromise, timeoutPromise]);
    } catch (error) {
        console.error('Supabase 登出超时或失败，继续执行本地清理:', error);
    } finally {
        // 4. 🚨 无论如何，强制清除本地状态
        console.log('强制清除本地状态');
        if (typeof window !== 'undefined' && user) {
            try {
                localStorage.removeItem(`test_progress_${user.id}`)
                localStorage.removeItem(`word_list_${user.id}`)
                localStorage.removeItem(`learning_progress_${user.id}`)
            } catch (e) { console.error(e) }
        }

        setUser(null)
        setUserProfile(null)
        setProfileError(false)
        setAppStage('dashboard')
        setLoading(false)
        
        // 确保重置 Session ID
        sessionStartTime.current = new Date()
        sessionId.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

  // 监听用户活动
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

  // 处理页面切换
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

  const handleAuthSuccess = async (authenticatedUser: User) => {
    setUser(authenticatedUser)
    await fetchUserProfile(authenticatedUser);
    setLoading(false)
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

  // ============================================
  // 渲染逻辑
  // ============================================

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

  // 错误界面
  if (user && (!userProfile || profileError)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-600 mb-2">无法加载用户资料</h2>
        <p className="text-gray-600 mb-6">数据库连接似乎不稳定。</p>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition"
          >
            重试
          </button>
          <button 
            onClick={() => handleLogout(true)} // 传递 true 强制退出
            className="px-6 py-2 bg-gray-500 text-white rounded-full shadow hover:bg-gray-600 transition hover:scale-105 active:scale-95"
          >
            强制退出
          </button>
        </div>
      </div>
    )
  }

  // 未登录
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  // 家长端跳转
  if (userProfile?.role && userProfile.role !== 'child') {
    if (typeof window !== 'undefined') {
      window.location.href = '/parent/dashboard'
      return <div className="min-h-screen flex items-center justify-center">跳转中...</div>
    }
  }

  return (
    <div className="min-h-screen font-quicksand">
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