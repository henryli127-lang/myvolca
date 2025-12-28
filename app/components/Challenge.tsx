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
}

interface ChallengeProps {
  user: User
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

export default function Challenge({ user, onComplete, onLogout }: ChallengeProps) {
  const TEST_PROGRESS_KEY = `test_progress_${user.id}`
  
  // 从 localStorage 恢复测试进度
  const loadTestProgress = () => {
    if (typeof window === 'undefined') return null
    
    try {
      const saved = localStorage.getItem(TEST_PROGRESS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 检查进度是否过期（超过24小时）
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed
        } else {
          // 进度过期，清除
          localStorage.removeItem(TEST_PROGRESS_KEY)
        }
      }
    } catch (error) {
      console.error('加载测试进度失败:', error)
    }
    return null
  }

  // 保存测试进度到 localStorage
  const saveTestProgress = (
    words: Word[],
    index: number,
    phase: TestPhase,
    testResults: typeof results,
    wordResultsMap: Map<number, { translationError: boolean; spellingError: boolean }>
  ) => {
    if (typeof window === 'undefined') return
    
    try {
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
  const [results, setResults] = useState(savedProgress?.results || {
    translationCorrect: 0,
    translationTotal: 0,
    spellingCorrect: 0,
    spellingTotal: 0,
    translationErrors: 0,
    spellingErrors: 0,
  })
  const [wordResults, setWordResults] = useState<Map<number, { translationError: boolean; spellingError: boolean }>>(
    savedProgress?.wordResults 
      ? new Map(savedProgress.wordResults.map((item: any) => [item.id, { translationError: item.translationError, spellingError: item.spellingError }]))
      : new Map()
  )
  const [spellingHint, setSpellingHint] = useState('')
  const [mustTypeCorrect, setMustTypeCorrect] = useState(false)
  const [hasRestoredProgress, setHasRestoredProgress] = useState(!!savedProgress)
  const inputRef = useRef<HTMLInputElement>(null)

  // 生成拼写提示（提前定义，供 useEffect 使用）
  const generateSpellingHint = (word: string): string => {
    const length = word.length
    if (length < 4) {
      return ''
    } else if (length <= 6) {
      return word[0] + '_'.repeat(length - 1)
    } else {
      return word[0] + '_'.repeat(length - 2) + word[length - 1]
    }
  }

  // 获取测试单词（5-10个）或恢复保存的进度
  useEffect(() => {
    // 如果已有保存的进度，使用保存的单词列表
    if (hasRestoredProgress && testWords.length > 0) {
      setResults(prev => ({
        ...prev,
        translationTotal: testWords.length,
        spellingTotal: testWords.length,
      }))
      // 如果是拼写阶段，设置提示
      if (testPhase === 'spelling' && testWords[currentIndex]) {
        const hint = generateSpellingHint(testWords[currentIndex].word)
        setSpellingHint(hint)
      }
      return
    }

    // 否则获取新的测试单词
    const fetchTestWords = async () => {
      const wordsList: Word[] = []
      const maxAttempts = 20
      let attempts = 0

      while (wordsList.length < 5 && attempts < maxAttempts) {
        const { data } = await words.getRandomUnmastered(user.id)
        if (data && !wordsList.find(w => w.id === data.id)) {
          wordsList.push(data as Word)
        }
        attempts++
      }

      setTestWords(wordsList)
      setResults(prev => ({
        ...prev,
        translationTotal: wordsList.length,
        spellingTotal: wordsList.length,
      }))
    }

    fetchTestWords()
  }, [user.id, hasRestoredProgress, testWords.length, testPhase, currentIndex])

  // 检查翻译答案
  const checkTranslation = (input: string, word: Word): boolean => {
    const normalizedInput = input.trim().toLowerCase()
    const normalizedTranslation = word.translation.toLowerCase()
    
    // 检查是否包含完整翻译
    if (normalizedTranslation.includes(normalizedInput) || normalizedInput.includes(normalizedTranslation)) {
      return true
    }
    
    // 检查是否命中 keywords
    if (word.keywords && word.keywords.length > 0) {
      return word.keywords.some(keyword => 
        normalizedInput.includes(keyword.toLowerCase()) || 
        keyword.toLowerCase().includes(normalizedInput)
      )
    }
    
    return false
  }

  // 处理翻译测试提交
  const handleTranslationSubmit = () => {
    if (!testWords[currentIndex]) return

    const correct = checkTranslation(userInput, testWords[currentIndex])
    setIsCorrect(correct)
    // 确保 showAnswer 被设置为 true，并且不会被重置
    setShowAnswer(true)

    const wordId = testWords[currentIndex].id
    let newWordResults: Map<number, { translationError: boolean; spellingError: boolean }>
    let newResults = results
    
    setWordResults(prev => {
      newWordResults = new Map(prev)
      const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
      newWordResults.set(wordId, { ...existing, translationError: !correct })
      return newWordResults
    })

    if (correct) {
      newResults = {
        ...results,
        translationCorrect: results.translationCorrect + 1,
      }
      setResults(newResults)
    } else {
      newResults = {
        ...results,
        translationErrors: results.translationErrors + 1,
      }
      setResults(newResults)
    }

    // 保存进度
    setTimeout(() => {
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults!)
    }, 0)
  }

  // 处理拼写测试提交
  const handleSpellingSubmit = () => {
    if (!testWords[currentIndex]) return

    const correct = userInput.trim().toLowerCase() === testWords[currentIndex].word.toLowerCase()
    const wordId = testWords[currentIndex].id
    
    if (correct) {
      setIsCorrect(true)
      setWordResults(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(wordId) || { translationError: false, spellingError: false }
        newMap.set(wordId, { ...existing, spellingError: false })
        return newMap
      })
      setResults(prev => ({
        ...prev,
        spellingCorrect: prev.spellingCorrect + 1,
      }))
      setMustTypeCorrect(false)
      // 继续下一题
      setTimeout(() => {
        nextQuestion()
      }, 1000)
    } else {
      // 拼写错误：显示正确答案，要求重新拼写
      setIsCorrect(false)
      setShowAnswer(true)
      setMustTypeCorrect(true)
      setWordResults(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(wordId) || { translationError: false, spellingError: false }
        newMap.set(wordId, { ...existing, spellingError: true })
        return newMap
      })
      setResults(prev => ({
        ...prev,
        spellingErrors: prev.spellingErrors + 1,
      }))
      // 清空输入框，让用户重新输入
      setUserInput('')
      // 延迟聚焦，确保 DOM 更新完成
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
  }

  // 下一题
  const nextQuestion = () => {
    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setUserInput('')
      setShowAnswer(false)
      setIsCorrect(false)
      setMustTypeCorrect(false)
    } else {
      // 翻译阶段完成，进入拼写阶段
      if (testPhase === 'translation') {
        setTestPhase('spelling')
        setCurrentIndex(0)
        setUserInput('')
        setShowAnswer(false)
        setIsCorrect(false)
        const hint = generateSpellingHint(testWords[0].word)
        setSpellingHint(hint)
      } else {
        // 测试完成，传递单词结果
        onComplete({
          ...results,
          testWords: testWords.map(w => {
            const wordResult = wordResults.get(w.id) || { translationError: false, spellingError: false }
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

  // 拼写阶段：检查是否必须输入正确答案（强制纠错）
  useEffect(() => {
    // 只有在需要强制纠错、已显示答案、且用户有输入时才检查
    if (testPhase === 'spelling' && mustTypeCorrect && showAnswer && !isCorrect && userInput.trim().length > 0) {
      const currentWord = testWords[currentIndex]
      if (currentWord && userInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
        // 学生已经正确拼写，更新结果并继续
        setMustTypeCorrect(false)
        setIsCorrect(true)
        let newWordResults: Map<number, { translationError: boolean; spellingError: boolean }>
        let newResults = results
        
        setWordResults(prev => {
          newWordResults = new Map(prev)
          const existing = newWordResults.get(currentWord.id) || { translationError: false, spellingError: false }
          newWordResults.set(currentWord.id, { ...existing, spellingError: false })
          return newWordResults
        })
        newResults = {
          ...results,
          spellingCorrect: results.spellingCorrect + 1,
          spellingErrors: Math.max(0, results.spellingErrors - 1), // 纠正后减少错误计数
        }
        setResults(newResults)
        
        // 保存进度
        saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults!)
        
        setTimeout(() => {
          nextQuestion()
        }, 1500)
      }
    }
  }, [userInput, mustTypeCorrect, showAnswer, testPhase, testWords, currentIndex, isCorrect])

  // 更新拼写提示
  useEffect(() => {
    if (testPhase === 'spelling' && testWords[currentIndex]) {
      const hint = generateSpellingHint(testWords[currentIndex].word)
      setSpellingHint(hint)
    }
  }, [testPhase, currentIndex, testWords])

  // 在组件卸载或退出时保存测试进度
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (testWords.length > 0) {
        saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (testWords.length > 0) {
        saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [testWords, currentIndex, testPhase, results, wordResults])

  // 创建一个包装的退出函数，在退出前保存进度
  const handleLogoutWithSave = async () => {
    if (testWords.length > 0) {
      saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
    }
    await onLogout()
  }


  if (testWords.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        {/* 退出按钮 */}
        <div className="absolute top-4 right-4 z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogoutWithSave}
            className="bg-white/80 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <span>🚪</span>
            <span className="font-semibold">退出</span>
          </motion.button>
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-candy-blue border-t-transparent rounded-full"
        />
      </div>
    )
  }

  const currentWord = testWords[currentIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20 p-6 font-quicksand">
      {/* 退出按钮 */}
      <div className="absolute top-4 right-4 z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLogout}
          className="bg-white/80 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <span>🚪</span>
          <span className="font-semibold">退出</span>
        </motion.button>
      </div>
      <div className="max-w-4xl mx-auto">
        {/* 进度指示 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold text-gray-700">
              {testPhase === 'translation' ? '📝 翻译测试' : '✍️ 拼写测试'}
            </span>
            <span className="text-lg font-semibold text-gray-700">
              {currentIndex + 1} / {testWords.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / testWords.length) * 100}%` }}
              className="bg-gradient-to-r from-candy-blue to-candy-green h-4 rounded-full"
            />
          </div>
        </div>

        {/* 测试卡片 */}
        <motion.div
          key={`${testPhase}-${currentIndex}-${testWords[currentIndex]?.id}`}
          initial={{ opacity: 0, x: 50 }}
          animate={showAnswer && !isCorrect && testPhase === 'translation' ? {
            x: [0, -10, 10, -10, 10, 0],
          } : {
            opacity: 1,
            x: 0,
          }}
          transition={showAnswer && !isCorrect && testPhase === 'translation' ? {
            duration: 0.5,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1],
          } : {
            duration: 0.3,
          }}
          exit={{ opacity: 0, x: -50 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-8 min-h-[400px] flex flex-col items-center justify-center"
        >
          {testPhase === 'translation' ? (
            // 翻译测试
            <>
              <h2 className="text-6xl font-bold text-gray-800 mb-8 text-center">
                {currentWord.word}
              </h2>
              <div className="w-full max-w-md">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !showAnswer) {
                      handleTranslationSubmit()
                    }
                  }}
                  placeholder="请输入中文翻译..."
                  className="w-full px-6 py-4 text-xl border-4 border-candy-blue rounded-2xl focus:outline-none focus:border-candy-green transition-all"
                  disabled={showAnswer}
                />
                {showAnswer ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`mt-4 p-4 rounded-2xl ${
                      isCorrect ? 'bg-candy-green/20 border-2 border-candy-green' : 'bg-red-100 border-2 border-red-400'
                    }`}
                  >
                    <p className={`text-lg font-semibold ${isCorrect ? 'text-candy-green' : 'text-red-600'}`}>
                      {isCorrect ? '✅ 正确！' : '❌ 错误'}
                    </p>
                    {!isCorrect && (
                      <p className="text-gray-700 mt-2 font-bold">正确答案：<span className="underline">{currentWord.translation}</span></p>
                    )}
                  </motion.div>
                ) : null}
              </div>
            </>
          ) : (
            // 拼写测试
            <>
              <h2 className="text-5xl font-bold text-gray-800 mb-4 text-center">
                {currentWord.translation}
              </h2>
              <p className="text-gray-500 mb-8">请拼写这个单词的英文</p>
              <div className="w-full max-w-md">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      if (!showAnswer) {
                        // 第一次提交
                        handleSpellingSubmit()
                      } else if (mustTypeCorrect && userInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
                        // 强制纠错时，如果输入正确，自动继续（由 useEffect 处理）
                        // 这里不需要额外操作
                      }
                    }
                  }}
                  placeholder={mustTypeCorrect && showAnswer ? '请完整拼写正确答案...' : (spellingHint || '请输入英文单词...')}
                  className={`w-full px-6 py-4 text-xl border-4 rounded-2xl focus:outline-none transition-all ${
                    showAnswer && !isCorrect
                      ? 'border-red-400 bg-red-50'
                      : 'border-candy-blue focus:border-candy-green'
                  }`}
                  disabled={false}
                />
                {showAnswer && !isCorrect && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 p-4 rounded-2xl bg-red-100 border-2 border-red-400"
                  >
                    <p className="text-red-600 font-semibold mb-2">❌ 拼写错误</p>
                    <p className="text-red-700 font-bold text-xl mb-2">正确答案：<span className="underline">{currentWord.word}</span></p>
                    {mustTypeCorrect && (
                      <p className="text-gray-700 mt-2 text-sm font-semibold">
                        ⚠️ 请在上方输入框中完整拼写正确答案后才能继续
                      </p>
                    )}
                  </motion.div>
                )}
                {isCorrect && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 p-4 rounded-2xl bg-candy-green/20 border-2 border-candy-green"
                  >
                    <p className="text-candy-green font-semibold text-lg">✅ 正确！</p>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* 操作按钮 */}
        <div className="flex justify-center gap-4">
          {testPhase === 'translation' && showAnswer && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={nextQuestion}
              className="bg-candy-blue text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform transition-all text-lg"
            >
              下一题 →
            </motion.button>
          )}
          {testPhase === 'spelling' && (
            <>
              {!showAnswer && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSpellingSubmit}
                  disabled={!userInput.trim()}
                  className="bg-candy-green text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  提交
                </motion.button>
              )}
              {showAnswer && !isCorrect && mustTypeCorrect && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <p className="text-gray-600 mb-2 text-sm font-semibold">
                    {userInput.trim().toLowerCase() === currentWord.word.toLowerCase() 
                      ? '✅ 拼写正确！即将进入下一题...' 
                      : '⚠️ 请在上方输入框中完整拼写正确答案'}
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

