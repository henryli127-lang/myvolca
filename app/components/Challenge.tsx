'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { words, userProgress } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Word {
  id: number
  word: string
  translation: string
  keywords?: string[]
  is_review?: boolean
}

interface TestResults {
  translationCorrect: number
  translationTotal: number
  spellingCorrect: number
  spellingTotal: number
  translationErrors: number
  spellingErrors: number
}

interface WordResult {
  translationError: boolean
  spellingError: boolean
}

interface SavedProgress {
  testWords: Word[]
  currentIndex: number
  testPhase: TestPhase
  results: TestResults
  wordResults: Array<{ id: number; translationError: boolean; spellingError: boolean }>
  timestamp: number
}

interface ChallengeProps {
  user: User
  testCount: number
  onComplete: (results: {
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
  }) => void
  onLogout: () => void
}

type TestType = 'translation' | 'spelling'
type TestPhase = 'translation' | 'spelling' | 'complete'

export default function Challenge({ user, testCount, onComplete, onLogout }: ChallengeProps) {
  const TEST_PROGRESS_KEY = `test_progress_${user.id}`
  
  // 从 localStorage 恢复测试进度
  const loadTestProgress = (): SavedProgress | null => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem(TEST_PROGRESS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as SavedProgress
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed
        } else {
          localStorage.removeItem(TEST_PROGRESS_KEY)
        }
      }
    } catch (error) {
      console.error('加载测试进度失败:', error)
    }
    return null
  }

  // 保存测试进度
  const saveTestProgress = (
    words: Word[],
    index: number,
    phase: TestPhase,
    testResults: TestResults,
    wordResultsMap: Map<number, WordResult> | undefined
  ) => {
    if (typeof window === 'undefined') return
    try {
      if (!wordResultsMap || !(wordResultsMap instanceof Map)) {
        wordResultsMap = new Map()
      }
      const wordResultsArray = Array.from(wordResultsMap.entries()).map(([id, errors]) => ({
        id,
        ...errors
      }))
      localStorage.setItem(TEST_PROGRESS_KEY, JSON.stringify({
        testWords: words,
        currentIndex: index,
        testPhase: phase,
        results: testResults,
        wordResults: wordResultsArray,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.error('保存测试进度失败:', error)
    }
  }

  // 清除测试进度
  const clearTestProgress = () => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(TEST_PROGRESS_KEY)
      const wordListKey = `word_list_${user.id}`
      localStorage.removeItem(wordListKey)
    } catch (error) {
      console.error('清除测试进度失败:', error)
    }
  }

  const savedProgress = loadTestProgress()
  const [testWords, setTestWords] = useState<Word[]>(savedProgress?.testWords || [])
  const [currentIndex, setCurrentIndex] = useState(savedProgress?.currentIndex || 0)
  const [testPhase, setTestPhase] = useState<TestPhase>(savedProgress?.testPhase || 'translation')
  const [userInput, setUserInput] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [results, setResults] = useState<TestResults>(savedProgress?.results || {
    translationCorrect: 0,
    translationTotal: 0,
    spellingCorrect: 0,
    spellingTotal: 0,
    translationErrors: 0,
    spellingErrors: 0,
  })
  const [wordResults, setWordResults] = useState<Map<number, WordResult>>(
    savedProgress?.wordResults 
      ? new Map(savedProgress.wordResults.map((item) => [item.id, { translationError: item.translationError, spellingError: item.spellingError }]))
      : new Map()
  )
  const [spellingHint, setSpellingHint] = useState('')
  const [mustTypeCorrect, setMustTypeCorrect] = useState(false)
  const [hasRestoredProgress, setHasRestoredProgress] = useState(!!savedProgress)
  const [showStartMessage, setShowStartMessage] = useState(true)

  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isCompletedRef = useRef(false)
  const lastSubmissionTime = useRef(0)

  const generateSpellingHint = (word: string): string => {
    const length = word.length
    if (length < 4) return ''
    else if (length <= 6) return word[0] + '_'.repeat(length - 1)
    else return word[0] + '_'.repeat(length - 2) + word[length - 1]
  }

  // 修改：playAudio 改为 GET 请求
  const playAudio = async (text: string, lang: 'en' | 'zh' = 'en') => {
    if (!text) return
    setIsSpeaking(true)
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current = null
      }
      
      const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`, {
        method: 'GET',
      })

      if (!response.ok) throw new Error('TTS failed')
      const blob = await response.blob()
      if (blob.size === 0) throw new Error('Empty audio blob')

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }
      
      await audio.play()
    } catch (error) {
      console.error('Playback error:', error)
      setIsSpeaking(false)
    }
  }

  // 初始化单词数据
  useEffect(() => {
    if (hasRestoredProgress && testWords.length > 0) {
      // 确保 totals 正确
      setResults(prev => ({
        ...prev,
        translationTotal: testWords.length,
        spellingTotal: testWords.length,
      }))
      if (testPhase === 'spelling' && testWords[currentIndex]) {
        setSpellingHint(generateSpellingHint(testWords[currentIndex].word))
      }
      return
    }

    const fetchTestWords = async () => {
      const savedListKey = `word_list_${user.id}`
      let wordsList: Word[] = []
      
      // 1. 先读取缓存
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(savedListKey)
          if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed.words && Array.isArray(parsed.words) && parsed.words.length > 0) {
              wordsList = parsed.words.map((w: any) => ({
                ...w,
                id: Number(w.id),
                is_review: w.is_review || false
              }))
            }
          }
        } catch (error) { console.error(error) }
      }

      // 2. 根据缓存数量决定是否补充
      if (wordsList.length < testCount) {
        // 缓存数量不足，RPC 获取缺少的数量并补充
        const needCount = testCount - wordsList.length
        const { data } = await words.getWordsForSession(user.id, needCount)
        if (data && data.length > 0) {
          const newWords = data.map((w: any) => ({
            ...w, 
            id: Number(w.id), 
            is_review: w.is_review || false 
          }))
          // 合并缓存和新增的单词
          wordsList = [...wordsList, ...newWords]
          // 更新缓存
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(savedListKey, JSON.stringify({
                words: wordsList,
                timestamp: Date.now()
              }))
            } catch (error) {
              console.error('更新缓存失败:', error)
            }
          }
        } else if (wordsList.length === 0) {
          // 如果缓存为空且 RPC 也没有返回数据，尝试获取完整数量
          const { data: fullData } = await words.getWordsForSession(user.id, testCount)
          if (fullData && fullData.length > 0) {
            wordsList = fullData.map((w: any) => ({
              ...w, 
              id: Number(w.id), 
              is_review: w.is_review || false 
            }))
            // 更新缓存
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(savedListKey, JSON.stringify({
                  words: wordsList,
                  timestamp: Date.now()
                }))
              } catch (error) {
                console.error('更新缓存失败:', error)
              }
            }
          }
        }
      }

      // 3. 处理最终单词列表
      if (wordsList.length > 0) {
        let finalWords: Word[]
        if (wordsList.length > testCount) {
          // 缓存数量 > testCount：从缓存中选取前 testCount 个
          finalWords = wordsList.slice(0, testCount)
        } else {
          // 缓存数量 = testCount 或 < testCount（已补充）：直接使用
          finalWords = wordsList
        }
        
        setTestWords(finalWords)
        setResults(prev => ({
          ...prev,
          translationTotal: finalWords.length,
          spellingTotal: finalWords.length,
        }))
      }
    }

    fetchTestWords()
  }, [user.id, hasRestoredProgress, testCount])

  // ✅ 核心修复：nextQuestion 接受可选参数，优先使用传入的最新结果
  const nextQuestion = (
    latestResults?: TestResults, 
    latestWordResults?: Map<number, WordResult>
  ) => {
    // 优先使用传入的最新数据，否则降级使用 state (处理普通点击翻页的情况)
    const currentResults = latestResults || results
    const currentWordResults = latestWordResults || wordResults

    if (!testWords || testWords.length === 0) return

    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setUserInput('')
      setShowAnswer(false)
      setIsCorrect(false)
      setMustTypeCorrect(false)
      // 稍微延迟聚焦，防止视觉跳变
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      if (testPhase === 'translation') {
        setTestPhase('spelling')
        setCurrentIndex(0)
        setUserInput('')
        setShowAnswer(false)
        setIsCorrect(false)
        if (testWords[0]) setSpellingHint(generateSpellingHint(testWords[0].word))
      } else {
        // 完成测试
        isCompletedRef.current = true
        clearTestProgress()
        
        onComplete({
          ...currentResults, // ✅ 使用最新的 results
          testWords: testWords.map(w => {
            const wordResult = currentWordResults.get(w.id) || { translationError: false, spellingError: false }
            return {
              id: w.id,
              word: w.word,
              translation: w.translation,
              translationError: wordResult.translationError,
              spellingError: wordResult.spellingError,
            }
          })
        })
      }
    }
  }

  const checkTranslation = (input: string, word: Word): boolean => {
    const normalizedInput = input.trim().toLowerCase()
    const normalizedTranslation = word.translation.toLowerCase()
    if (normalizedTranslation.includes(normalizedInput) || normalizedInput.includes(normalizedTranslation)) return true
    if (word.keywords && word.keywords.length > 0) {
      return word.keywords.some(k => normalizedInput.includes(k.toLowerCase()) || k.toLowerCase().includes(normalizedInput))
    }
    return false
  }

  const handleTranslationSubmit = () => {
    if (!testWords[currentIndex]) return
    
    // 检查输入是否为空
    if (!userInput.trim()) {
      // 空输入直接判定为错误
      const wordId = testWords[currentIndex].id
      const newWordResults = new Map(wordResults)
      const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
      newWordResults.set(wordId, { ...existing, translationError: true })
      
      const newResults = { ...results }
      newResults.translationErrors += 1
      
      setIsCorrect(false)
      setShowAnswer(true)
      setWordResults(newWordResults)
      setResults(newResults)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
      return
    }
    
    lastSubmissionTime.current = Date.now()

    const correct = checkTranslation(userInput, testWords[currentIndex])
    const wordId = testWords[currentIndex].id
  
    const newWordResults = new Map(wordResults)
    const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
    newWordResults.set(wordId, { ...existing, translationError: !correct })
  
    const newResults = { ...results }
    if (correct) newResults.translationCorrect += 1
    else newResults.translationErrors += 1
  
    setIsCorrect(correct)
    setShowAnswer(true)
    setWordResults(newWordResults)
    setResults(newResults)
    saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
  }

  const handleSpellingSubmit = () => {
    if (!testWords[currentIndex]) return
    lastSubmissionTime.current = Date.now()

    const correct = userInput.trim().toLowerCase() === testWords[currentIndex].word.toLowerCase()
    const wordId = testWords[currentIndex].id
    
    const newWordResults = new Map(wordResults)
    const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
    const newResults = { ...results }

    if (correct) {
      setIsCorrect(true)
      setMustTypeCorrect(false)
      // 保持之前的拼写错误记录
      newWordResults.set(wordId, { ...existing, spellingError: existing.spellingError })
      newResults.spellingCorrect += 1

      setWordResults(newWordResults)
      setResults(newResults)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)

      // ✅ 修复：传递最新的结果给 nextQuestion
      setTimeout(() => {
        nextQuestion(newResults, newWordResults)
      }, 1000)

    } else {
      setIsCorrect(false)
      setShowAnswer(true)
      setMustTypeCorrect(true)
      newWordResults.set(wordId, { ...existing, spellingError: true })
      newResults.spellingErrors += 1

      setWordResults(newWordResults)
      setResults(newResults)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
      
      playAudio(testWords[currentIndex].word, 'en')
      setUserInput('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // 强制纠错逻辑
  useEffect(() => {
    if (testPhase === 'spelling' && mustTypeCorrect && showAnswer && !isCorrect && userInput.trim().length > 0) {
      const currentWord = testWords[currentIndex]
      if (currentWord && userInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
        setMustTypeCorrect(false)
        setIsCorrect(true)
        
        const newWordResults = new Map(wordResults)
        const existing = newWordResults.get(currentWord.id) || { translationError: false, spellingError: false }
        
        const newResults = { ...results }
        
        // 逻辑：如果之前算错了(Error增加过)，现在拼对了，虽然不洗白Error，但要给Correct+1吗？
        // 原逻辑：spellingCorrect + spellingErrors = currentIndex + 1
        // 如果之前 Error+1 了，这里我们不应该再加 Correct，否则总数会溢出
        // 除非我们想统计"最终拼对数"，但 ReportCard 已经改用 realCorrect 逻辑了
        // 为了保持数据一致性，这里我们只更新 UI 状态让它过
        // 但如果您的逻辑是"只要最后拼对了就算Correct"，请保留下面的逻辑：
        
        const currentTotal = results.spellingCorrect + results.spellingErrors
        const expectedTotal = currentIndex + 1 
        if (currentTotal < expectedTotal) {
           newResults.spellingCorrect += 1
        }
        
        newWordResults.set(currentWord.id, { ...existing, spellingError: existing.spellingError })
        
        setWordResults(newWordResults)
        setResults(newResults)
        saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
        
        // ✅ 核心修复：这里也必须传递最新的结果
        setTimeout(() => {
          nextQuestion(newResults, newWordResults)
        }, 1500)
      }
    }
  }, [userInput, mustTypeCorrect, showAnswer, testPhase, testWords, currentIndex, isCorrect, wordResults, results])

  useEffect(() => {
    if (testPhase === 'spelling' && testWords[currentIndex]) {
      setSpellingHint(generateSpellingHint(testWords[currentIndex].word))
    }
  }, [testPhase, currentIndex, testWords])

  // 退出保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (testWords.length > 0 && !isCompletedRef.current) {
        saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      if (testWords.length > 0 && !isCompletedRef.current) {
        saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [testWords, currentIndex, testPhase, results, wordResults])

  const handleLogoutWithSave = async () => {
    if (testWords.length > 0) {
      saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
    }
    await onLogout()
  }

  // 开始提示
  useEffect(() => {
    if (testWords.length > 0 && currentIndex === 0 && testPhase === 'translation' && showStartMessage) {
      const timer = setTimeout(() => setShowStartMessage(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [testWords.length, currentIndex, testPhase, showStartMessage])

  if (testWords.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
         <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 border-4 border-candy-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  const reviewCount = testWords.filter(w => w.is_review).length
  const newCount = testWords.length - reviewCount
  const currentWord = testWords[currentIndex]

  if (!currentWord) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20 p-6 font-quicksand">
      <div className="absolute top-4 right-4 z-10">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleLogoutWithSave} className="bg-white/80 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
          <span>🚪</span><span className="font-semibold">退出</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {showStartMessage && currentIndex === 0 && testPhase === 'translation' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: -20 }} className="bg-white rounded-3xl p-8 shadow-2xl max-w-md text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Ready to Test! 🚀</h2>
              <p className="text-lg text-gray-700 mb-2">You have <span className="font-bold text-yellow-600">{reviewCount}</span> review words</p>
              <p className="text-lg text-gray-700 mb-4">and <span className="font-bold text-blue-600">{newCount}</span> new words today.</p>
              <p className="text-xl font-semibold text-candy-green">Let's go! 🚀</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold text-gray-700">{testPhase === 'translation' ? '📝 翻译测试' : '✍️ 拼写测试'}</span>
            <span className="text-lg font-semibold text-gray-700">{currentIndex + 1} / {testWords.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 relative mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: `${((currentIndex + 1) / testWords.length) * 100}%` }} className="bg-gradient-to-r from-candy-blue to-candy-green h-4 rounded-full" />
          </div>
          <div className="text-center text-sm text-gray-600 font-medium">
            已测试: <span className="font-bold text-candy-blue">{currentIndex + 1}</span> / 总计: <span className="font-bold text-candy-green">{testWords.length}</span>
          </div>
        </div>

        <motion.div
          key={`${testPhase}-${currentIndex}`}
          initial={{ opacity: 0, x: 50 }}
          animate={showAnswer && !isCorrect && testPhase === 'translation' ? { x: [0, -10, 10, -10, 10, 0], opacity: 1 } : { opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          exit={{ opacity: 0, x: -50 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-8 min-h-[400px] flex flex-col items-center justify-center"
        >
          {testPhase === 'translation' ? (
            <>
              <h2 className="text-6xl font-bold text-gray-800 mb-8 text-center">{currentWord.word}</h2>
              <div className="w-full max-w-md">
                <input
                  type="text"
                  value={userInput}
                  autoFocus
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!showAnswer) handleTranslationSubmit()
                      else if (Date.now() - lastSubmissionTime.current > 500) nextQuestion() // 这里读 state 没关系，因为是用户手动触发，肯定已经是新渲染周期
                    }
                  }}
                  placeholder="请输入中文翻译..."
                  className="w-full px-6 py-4 text-xl border-4 border-candy-blue rounded-2xl focus:outline-none focus:border-candy-green transition-all"
                  disabled={showAnswer}
                />
                {showAnswer && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 p-4 rounded-2xl ${isCorrect ? 'bg-candy-green/20 border-2 border-candy-green' : 'bg-red-100 border-2 border-red-400'}`}>
                    <p className={`text-lg font-semibold ${isCorrect ? 'text-candy-green' : 'text-red-600'}`}>{isCorrect ? '✅ 正确！' : '❌ 错误'}</p>
                    {!isCorrect && <p className="text-gray-700 mt-2 font-bold">正确答案：<span className="underline">{currentWord.translation}</span></p>}
                  </motion.div>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-5xl font-bold text-gray-800 mb-4 text-center">{currentWord.translation}</h2>
              <p className="text-gray-500 mb-8">请拼写这个单词的英文</p>
              <div className="w-full max-w-md">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (Date.now() - lastSubmissionTime.current < 500) return
                      if (!showAnswer && !isCorrect) handleSpellingSubmit()
                    }
                  }}
                  placeholder={mustTypeCorrect && showAnswer ? '请完整拼写正确答案...' : (spellingHint || '请输入英文单词...')}
                  className={`w-full px-6 py-4 text-xl border-4 rounded-2xl focus:outline-none transition-all ${showAnswer && !isCorrect ? 'border-red-400 bg-red-50' : 'border-candy-blue focus:border-candy-green'}`}
                />
                {showAnswer && !isCorrect && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-4 rounded-2xl bg-red-100 border-2 border-red-400">
                    <p className="text-red-600 font-semibold mb-2">❌ 拼写错误</p>
                    <p className="text-red-700 font-bold text-xl mb-2">正确答案：<span className="underline">{currentWord.word}</span></p>
                    {mustTypeCorrect && <p className="text-gray-700 mt-2 text-sm font-semibold">⚠️ 请在上方输入框中完整拼写正确答案后才能继续</p>}
                  </motion.div>
                )}
                {isCorrect && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-4 rounded-2xl bg-candy-green/20 border-2 border-candy-green">
                    <p className="text-candy-green font-semibold text-lg">✅ 正确！</p>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </motion.div>

        <div className="flex justify-center gap-4">
          {testPhase === 'translation' && showAnswer && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => nextQuestion()} className="bg-candy-blue text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-lg">
              下一题 →
            </motion.button>
          )}
          {testPhase === 'spelling' && !showAnswer && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSpellingSubmit} disabled={!userInput.trim()} className="bg-candy-green text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-lg disabled:opacity-50">
              提交
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}