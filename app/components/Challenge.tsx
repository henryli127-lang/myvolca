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
  translationOptions?: string[]
  translationCorrectIndex?: number
  spellingOptions?: string[]
  spellingCorrectIndex?: number
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
  
  // ✅ 使用 useRef 缓存 savedProgress，确保只在首次渲染时加载一次
  const savedProgressRef = useRef<SavedProgress | null | undefined>(undefined)
  
  // 从 localStorage 恢复测试进度（惰性加载，只执行一次）
  const loadTestProgress = (): SavedProgress | null => {
    // 如果已经加载过，直接返回缓存的值
    if (savedProgressRef.current !== undefined) {
      return savedProgressRef.current
    }
    
    if (typeof window === 'undefined') {
      savedProgressRef.current = null
      return null
    }
    
    console.log('🎯 Challenge: 开始加载测试进度...')
    try {
      const saved = localStorage.getItem(TEST_PROGRESS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as SavedProgress
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          console.log('🎯 Challenge: 成功恢复测试进度', { 
            wordsCount: parsed.testWords?.length,
            phase: parsed.testPhase,
            currentIndex: parsed.currentIndex
          })
          savedProgressRef.current = parsed
          return parsed
        } else {
          console.log('🎯 Challenge: 测试进度已过期，清除')
          localStorage.removeItem(TEST_PROGRESS_KEY)
        }
      }
    } catch (error) {
      console.error('加载测试进度失败:', error)
    }
    savedProgressRef.current = null
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
      // ✅ 同时清除缓存的 ref
      savedProgressRef.current = null
      console.log('🎯 Challenge: 测试进度已清除')
    } catch (error) {
      console.error('清除测试进度失败:', error)
    }
  }

  // ✅ 使用惰性初始化，确保 loadTestProgress 只执行一次
  const [testWords, setTestWords] = useState<Word[]>(() => {
    const progress = loadTestProgress()
    return progress?.testWords || []
  })
  const [currentIndex, setCurrentIndex] = useState(() => {
    const progress = loadTestProgress()
    return progress?.currentIndex || 0
  })
  const [testPhase, setTestPhase] = useState<TestPhase>(() => {
    const progress = loadTestProgress()
    return progress?.testPhase || 'translation'
  })
  const [userInput, setUserInput] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [results, setResults] = useState<TestResults>(() => {
    const progress = loadTestProgress()
    return progress?.results || {
      translationCorrect: 0,
      translationTotal: 0,
      spellingCorrect: 0,
      spellingTotal: 0,
      translationErrors: 0,
      spellingErrors: 0,
    }
  })
  const [wordResults, setWordResults] = useState<Map<number, WordResult>>(() => {
    const progress = loadTestProgress()
    if (progress?.wordResults) {
      return new Map(progress.wordResults.map((item) => [item.id, { translationError: item.translationError, spellingError: item.spellingError }]))
    }
    return new Map()
  })
  const [spellingHint, setSpellingHint] = useState('')
  const [mustTypeCorrect, setMustTypeCorrect] = useState(false)
  const [hasRestoredProgress, setHasRestoredProgress] = useState(() => {
    const progress = loadTestProgress()
    return !!progress
  })
  const [showStartMessage, setShowStartMessage] = useState(true)
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(-1)
  const [loadingOptions, setLoadingOptions] = useState(false)
  
  // 添加组件挂载日志
  console.log('🎯 Challenge: 组件渲染', { hasRestoredProgress, testWordsCount: testWords.length, testPhase })

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
    console.log('🎯 Challenge: 初始化 useEffect 执行', { 
      hasRestoredProgress, 
      testWordsLength: testWords.length,
      currentIndex,
      testPhase
    })
    
    if (hasRestoredProgress && testWords.length > 0) {
      console.log('🎯 Challenge: 使用恢复的进度')
      
      // ✅ 关键修复：检查是否已经完成了所有测试
      // 如果是拼写阶段且 currentIndex >= testWords.length，说明测试已完成但未正确处理
      if (testPhase === 'spelling' && currentIndex >= testWords.length) {
        console.log('🎯 Challenge: 检测到测试已完成，直接触发完成逻辑', { currentIndex, testWordsLength: testWords.length })
        
        // 防止重复调用
        if (!isCompletedRef.current) {
          isCompletedRef.current = true
          clearTestProgress()
          
          // 构建完成结果
          const allTestWords = testWords.map(w => {
            const wordResult = wordResults.get(w.id) || { translationError: false, spellingError: false }
            return {
              id: w.id,
              word: w.word,
              translation: w.translation,
              translationError: wordResult.translationError,
              spellingError: wordResult.spellingError,
            }
          })
          
          // 延迟触发完成回调
          setTimeout(() => {
            onComplete({
              ...results,
              translationTotal: testWords.length,
              spellingTotal: testWords.length,
              testWords: allTestWords
            })
          }, 100)
        }
        return
      }
      
      // ✅ 修复：确保 currentIndex 在有效范围内
      if (currentIndex >= testWords.length) {
        console.log('🎯 Challenge: currentIndex 超出范围，重置到最后一个', { currentIndex, testWordsLength: testWords.length })
        setCurrentIndex(testWords.length - 1)
      }
      
      // 确保 totals 正确（只在 totals 不匹配时更新，避免无限循环）
      setResults(prev => {
        if (prev.translationTotal === testWords.length && prev.spellingTotal === testWords.length) {
          return prev // 如果已经匹配，返回原对象，避免不必要的更新
        }
        return {
          ...prev,
          translationTotal: testWords.length,
          spellingTotal: testWords.length,
        }
      })
      
      // 使用安全的索引
      const safeIndex = Math.min(currentIndex, testWords.length - 1)
      if (testPhase === 'spelling' && testWords[safeIndex]) {
        setSpellingHint(generateSpellingHint(testWords[safeIndex].word))
      }
      return
    }
    
    console.log('🎯 Challenge: 开始获取新单词')

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
        
        // 4. 生成选择题选项
        setLoadingOptions(true)
        try {
          const response = await fetch('/api/test-options', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              words: finalWords.map(w => ({
                word: w.word,
                translation: w.translation
              }))
            }),
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.options && Array.isArray(data.options)) {
              // 将选项合并到单词中
              interface OptionData {
                word: string
                translation: string
                translationOptions: string[]
                translationCorrectIndex: number
                spellingOptions: string[]
                spellingCorrectIndex: number
              }
              const optionsMap = new Map<string, OptionData>(
                data.options.map((opt: OptionData) => [opt.word, opt])
              )
              finalWords = finalWords.map(w => {
                const options = optionsMap.get(w.word)
                if (options) {
                  return {
                    ...w,
                    translationOptions: options.translationOptions,
                    translationCorrectIndex: options.translationCorrectIndex,
                    spellingOptions: options.spellingOptions,
                    spellingCorrectIndex: options.spellingCorrectIndex
                  }
                }
                return w
              })
            }
          }
        } catch (error) {
          console.error('生成选择题选项失败:', error)
        } finally {
          setLoadingOptions(false)
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
  // 添加防抖保护，避免重复调用
  const nextQuestionRef = useRef<number | null>(null)
  const nextQuestion = (
    latestResults?: TestResults, 
    latestWordResults?: Map<number, WordResult>
  ) => {
    // 防抖：如果上次调用在500ms内，跳过
    const now = Date.now()
    if (nextQuestionRef.current && now - nextQuestionRef.current < 500) {
      console.warn('⚠️ nextQuestion 调用过于频繁，跳过')
      return
    }
    nextQuestionRef.current = now

    setSelectedOptionIndex(-1) // 重置选择
    // 优先使用传入的最新数据，否则降级使用 state (处理普通点击翻页的情况)
    const currentResults = latestResults || results
    const currentWordResults = latestWordResults || wordResults

    if (!testWords || testWords.length === 0) {
      console.warn('⚠️ testWords 为空，无法继续')
      return
    }

    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setShowAnswer(false)
      setIsCorrect(false)
      setSelectedOptionIndex(-1)
    } else {
      if (testPhase === 'translation') {
        setTestPhase('spelling')
        setCurrentIndex(0)
        setShowAnswer(false)
        setIsCorrect(false)
        setSelectedOptionIndex(-1)
        if (testWords[0]) setSpellingHint(generateSpellingHint(testWords[0].word))
      } else {
        // 完成测试
        if (isCompletedRef.current) {
          console.warn('⚠️ 测试已完成，跳过重复调用')
          return
        }
        isCompletedRef.current = true
        clearTestProgress()
        
        // 确保所有测试的单词都被包含
        const allTestWords = testWords.map(w => {
          const wordResult = currentWordResults.get(w.id) || { translationError: false, spellingError: false }
          return {
            id: w.id,
            word: w.word,
            translation: w.translation,
            translationError: wordResult.translationError,
            spellingError: wordResult.spellingError,
          }
        })
        
        console.log('📝 测试完成，准备传递结果:', {
          testWordsCount: testWords.length,
          allTestWordsCount: allTestWords.length,
          wordIds: allTestWords.map(w => w.id),
          wordNames: allTestWords.map(w => w.word)
        })
        
        // 使用 setTimeout 确保状态更新完成后再调用 onComplete
        setTimeout(() => {
          onComplete({
            ...currentResults, // ✅ 使用最新的 results
            testWords: allTestWords
          })
        }, 100)
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
    
    // 检查是否选择了选项
    if (selectedOptionIndex === -1) {
      // 未选择直接判定为错误
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

    const currentWord = testWords[currentIndex]
    const correct = currentWord.translationCorrectIndex !== undefined && 
                    selectedOptionIndex === currentWord.translationCorrectIndex
    const wordId = currentWord.id
  
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
    
    // 检查是否选择了选项
    if (selectedOptionIndex === -1) {
      // 未选择直接判定为错误
      const wordId = testWords[currentIndex].id
      const newWordResults = new Map(wordResults)
      const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
      newWordResults.set(wordId, { ...existing, spellingError: true })
      
      const newResults = { ...results }
      newResults.spellingErrors += 1
      
      setIsCorrect(false)
      setShowAnswer(true)
      setWordResults(newWordResults)
      setResults(newResults)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
      return
    }
    
    lastSubmissionTime.current = Date.now()

    const currentWord = testWords[currentIndex]
    const correct = currentWord.spellingCorrectIndex !== undefined && 
                    selectedOptionIndex === currentWord.spellingCorrectIndex
    const wordId = currentWord.id
    
    const newWordResults = new Map(wordResults)
    const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
    const newResults = { ...results }

    if (correct) {
      setIsCorrect(true)
      setShowAnswer(true)  // ✅ 修复：显示结果，等待用户点击"下一题"
      // 保持之前的拼写错误记录
      newWordResults.set(wordId, { ...existing, spellingError: existing.spellingError })
      newResults.spellingCorrect += 1

      setWordResults(newWordResults)
      setResults(newResults)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
      // ✅ 移除自动进入下一题的逻辑，改为和翻译测试一样，需要用户点击"下一题"按钮

    } else {
      setIsCorrect(false)
      setShowAnswer(true)
      newWordResults.set(wordId, { ...existing, spellingError: true })
      newResults.spellingErrors += 1

      setWordResults(newWordResults)
      setResults(newResults)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
      
      playAudio(currentWord.word, 'en')
    }
  }

  // 选择题不再需要强制纠错逻辑

  useEffect(() => {
    if (testPhase === 'spelling' && testWords && testWords.length > 0 && testWords[currentIndex]) {
      const hint = generateSpellingHint(testWords[currentIndex].word)
      // 只有当 hint 真的变化时才更新状态
      setSpellingHint(prev => prev !== hint ? hint : prev)
    }
  }, [testPhase, currentIndex, testWords.length, testWords[currentIndex]?.word]) // 依赖具体的单词，而不是整个数组

  // 使用 ref 存储最新值，避免 useEffect 依赖对象导致无限循环
  // 直接在每次渲染时更新 ref，不使用 useEffect（ref 更新不会触发重新渲染）
  const testWordsRef = useRef(testWords)
  const currentIndexRef = useRef(currentIndex)
  const testPhaseRef = useRef(testPhase)
  const resultsRef = useRef(results)
  const wordResultsRef = useRef(wordResults)

  // 每次渲染时更新 ref（这是安全的，因为 ref 更新不会触发重新渲染）
  testWordsRef.current = testWords
  currentIndexRef.current = currentIndex
  testPhaseRef.current = testPhase
  resultsRef.current = results
  wordResultsRef.current = wordResults

  // 退出保存（使用 ref 避免无限循环）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (testWordsRef.current.length > 0 && !isCompletedRef.current) {
        saveTestProgress(
          testWordsRef.current, 
          currentIndexRef.current, 
          testPhaseRef.current, 
          resultsRef.current, 
          wordResultsRef.current
        )
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // 移除清理函数中的保存，避免无限循环
      // 只在页面卸载时保存（beforeunload 事件）
    }
  }, []) // 空依赖数组，只在组件挂载/卸载时运行

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
  
  // ✅ 修复：确保 currentIndex 在有效范围内
  const safeCurrentIndex = Math.min(currentIndex, testWords.length - 1)
  const currentWord = testWords[safeCurrentIndex]
  
  console.log('🎯 Challenge: 渲染检查', { 
    currentIndex, 
    safeCurrentIndex,
    testWordsLength: testWords.length, 
    hasCurrentWord: !!currentWord,
    testPhase 
  })

  // ✅ 修复：如果 currentIndex 超出范围，重置到 0 并检查是否应该完成
  if (!currentWord) {
    console.error('🎯 Challenge: currentWord 为空，currentIndex 可能超出范围', { currentIndex, testWordsLength: testWords.length })
    // 如果已经完成所有单词，触发完成逻辑
    if (testPhase === 'spelling' && currentIndex >= testWords.length) {
      console.log('🎯 Challenge: 检测到测试已完成但未正确处理')
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        <div className="text-center">
          <p className="text-xl text-gray-700 mb-4">加载中...</p>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 border-4 border-candy-blue border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    )
  }

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
              <div className="w-full max-w-2xl">
                {loadingOptions ? (
                  <div className="flex items-center justify-center py-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-4 border-candy-blue border-t-transparent rounded-full" />
                    <span className="ml-4 text-gray-600">正在生成选项...</span>
                  </div>
                ) : currentWord.translationOptions ? (
                  <div className="space-y-3">
                    {currentWord.translationOptions.map((option, index) => {
                      const isSelected = selectedOptionIndex === index
                      const isCorrectOption = index === currentWord.translationCorrectIndex
                      const showResult = showAnswer
                      
                      let buttonClass = 'w-full text-left px-6 py-4 text-lg border-2 rounded-xl transition-all font-medium'
                      if (showResult) {
                        if (isCorrectOption) {
                          buttonClass += ' bg-green-100 border-green-500 text-green-700'
                        } else if (isSelected && !isCorrectOption) {
                          buttonClass += ' bg-red-100 border-red-500 text-red-700'
                        } else {
                          buttonClass += ' bg-gray-50 border-gray-200 text-gray-400'
                        }
                      } else {
                        if (isSelected) {
                          buttonClass += ' bg-candy-blue/20 border-candy-blue text-candy-blue shadow-md'
                        } else {
                          buttonClass += ' bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-candy-blue/50'
                        }
                      }
                      
                      return (
                        <motion.button
                          key={index}
                          whileHover={!showResult ? { scale: 1.02 } : {}}
                          whileTap={!showResult ? { scale: 0.98 } : {}}
                          onClick={() => {
                            if (!showAnswer) {
                              setSelectedOptionIndex(index)
                            }
                          }}
                          disabled={showAnswer}
                          className={buttonClass}
                        >
                          <div className="flex items-center">
                            <span className={`
                              w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm mr-4 flex-shrink-0 font-bold
                              ${showResult && isCorrectOption ? 'border-green-500 bg-green-500 text-white' : ''}
                              ${showResult && isSelected && !isCorrectOption ? 'border-red-500 bg-red-500 text-white' : ''}
                              ${!showResult && isSelected ? 'border-candy-blue bg-candy-blue text-white' : 'border-gray-300 bg-white text-gray-700'}
                            `}>
                              {String.fromCharCode(65 + index)}
                            </span>
                            {option}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">选项加载中...</p>
                )}
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
              <p className="text-gray-500 mb-8">请选择这个单词的英文拼写</p>
              <div className="w-full max-w-2xl">
                {loadingOptions ? (
                  <div className="flex items-center justify-center py-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-4 border-candy-blue border-t-transparent rounded-full" />
                    <span className="ml-4 text-gray-600">正在生成选项...</span>
                  </div>
                ) : currentWord.spellingOptions ? (
                  <div className="space-y-3">
                    {currentWord.spellingOptions.map((option, index) => {
                      const isSelected = selectedOptionIndex === index
                      const isCorrectOption = index === currentWord.spellingCorrectIndex
                      const showResult = showAnswer
                      
                      let buttonClass = 'w-full text-left px-6 py-4 text-lg border-2 rounded-xl transition-all font-medium'
                      if (showResult) {
                        if (isCorrectOption) {
                          buttonClass += ' bg-green-100 border-green-500 text-green-700'
                        } else if (isSelected && !isCorrectOption) {
                          buttonClass += ' bg-red-100 border-red-500 text-red-700'
                        } else {
                          buttonClass += ' bg-gray-50 border-gray-200 text-gray-400'
                        }
                      } else {
                        if (isSelected) {
                          buttonClass += ' bg-candy-green/20 border-candy-green text-candy-green shadow-md'
                        } else {
                          buttonClass += ' bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-candy-green/50'
                        }
                      }
                      
                      return (
                        <motion.button
                          key={index}
                          whileHover={!showResult ? { scale: 1.02 } : {}}
                          whileTap={!showResult ? { scale: 0.98 } : {}}
                          onClick={() => {
                            if (!showAnswer) {
                              setSelectedOptionIndex(index)
                            }
                          }}
                          disabled={showAnswer}
                          className={buttonClass}
                        >
                          <div className="flex items-center">
                            <span className={`
                              w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm mr-4 flex-shrink-0 font-bold
                              ${showResult && isCorrectOption ? 'border-green-500 bg-green-500 text-white' : ''}
                              ${showResult && isSelected && !isCorrectOption ? 'border-red-500 bg-red-500 text-white' : ''}
                              ${!showResult && isSelected ? 'border-candy-green bg-candy-green text-white' : 'border-gray-300 bg-white text-gray-700'}
                            `}>
                              {String.fromCharCode(65 + index)}
                            </span>
                            {option}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">选项加载中...</p>
                )}
                {showAnswer && !isCorrect && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-4 rounded-2xl bg-red-100 border-2 border-red-400">
                    <p className="text-red-600 font-semibold mb-2">❌ 拼写错误</p>
                    <p className="text-red-700 font-bold text-xl mb-2">正确答案：<span className="underline">{currentWord.word}</span></p>
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
          {testPhase === 'translation' && (
            <>
              {!showAnswer && (
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={handleTranslationSubmit} 
                  disabled={selectedOptionIndex === -1} 
                  className="bg-candy-blue text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-lg disabled:opacity-50"
                >
                  提交
                </motion.button>
              )}
              {showAnswer && (
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={() => nextQuestion()} 
                  className="bg-candy-blue text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-lg"
                >
                  下一题 →
                </motion.button>
              )}
            </>
          )}
          {testPhase === 'spelling' && (
            <>
              {!showAnswer && (
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={handleSpellingSubmit} 
                  disabled={selectedOptionIndex === -1} 
                  className="bg-candy-green text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-lg disabled:opacity-50"
                >
                  提交
                </motion.button>
              )}
              {showAnswer && (
                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={() => nextQuestion()} 
                  className="bg-candy-green text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-lg"
                >
                  下一题 →
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}