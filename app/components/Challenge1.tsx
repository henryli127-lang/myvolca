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
    testResults: TestResults,
    wordResultsMap: Map<number, WordResult> | undefined
  ) => {
    if (typeof window === 'undefined') return
    
    try {
      // 确保 wordResultsMap 存在且是 Map 类型
      if (!wordResultsMap || !(wordResultsMap instanceof Map)) {
        console.warn('wordResultsMap 无效，使用空 Map')
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
      // 同时清除单词列表缓存，确保下次重新开始时获取新单词
      const wordListKey = `word_list_${user.id}`
      localStorage.removeItem(wordListKey)
      console.log('已清除测试进度和单词列表缓存')
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

  // ...
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
// ✅ 新增：标记测试是否正常完成
const isCompletedRef = useRef(false)
// ✅ 新增：防止回车键连击的锁
// ❌ 删除原来的: const submissionLock = useRef(false)
// ✅ 新增: 记录最后一次提交的时间戳
const lastSubmissionTime = useRef(0)
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

  // 音频播放函数
  const playAudio = async (text: string, lang: 'en' | 'zh' = 'en') => {
    if (!text) return
    setIsSpeaking(true)

    try {
      // 停止之前的播放
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current = null
      }

      console.log('正在请求 TTS:', { text: text.substring(0, 50), lang })
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('TTS API 错误:', response.status, errorText)
        throw new Error(`TTS failed: ${response.status} ${errorText}`)
      }

      let blob = await response.blob()
      if (blob.size === 0) {
        console.error('TTS 返回空音频')
        throw new Error('Empty audio blob')
      }

      // 验证 blob 类型
      console.log('Received audio blob:', { size: blob.size, type: blob.type })
      
      // 读取 blob 的前几个字节，验证是否是有效的音频格式
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const firstBytes = Array.from(uint8Array.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
      console.log('Audio data first bytes:', firstBytes)
      
      // 检查是否是有效的 MP3 格式（MP3 通常以 0xFF 0xFB 或 ID3 标签开头）
      const isValidMP3 = uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0 || // MP3 frame sync
                         (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33) // ID3 tag
      
      if (!isValidMP3) {
        console.warn('Audio data may not be valid MP3, first bytes:', firstBytes)
        // 尝试查找 MP3 帧头
        let mp3StartIndex = -1
        for (let i = 0; i < Math.min(100, uint8Array.length - 1); i++) {
          if (uint8Array[i] === 0xFF && (uint8Array[i + 1] & 0xE0) === 0xE0) {
            mp3StartIndex = i
            break
          }
        }
        if (mp3StartIndex > 0) {
          console.log(`Found MP3 frame at index ${mp3StartIndex}, trimming...`)
          const trimmedBuffer = arrayBuffer.slice(mp3StartIndex)
          blob = new Blob([trimmedBuffer], { type: 'audio/mpeg' })
        }
      }
      
      // 如果 Content-Type 不正确，尝试修复
      let audioBlob = blob
      if (!blob.type || !blob.type.startsWith('audio/')) {
        console.warn('Blob type is not audio, creating new blob with audio/mpeg type')
        audioBlob = new Blob([blob], { type: 'audio/mpeg' })
      }

      const url = URL.createObjectURL(audioBlob)
      const audio = new Audio(url)
      
      // 赋值给 Ref 
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }

      audio.onerror = (e) => {
        console.error('音频播放错误:', e)
        console.error('Audio element error details:', {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState,
          src: audio.src.substring(0, 50)
        })
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }
      
      // 等待音频加载
      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          console.log('Audio can play through')
          resolve(null)
        }
        audio.onerror = (e) => {
          console.error('Audio load error:', e)
          reject(new Error('Audio load failed'))
        }
        // 超时保护
        setTimeout(() => {
          if (audio.readyState < 2) {
            reject(new Error('Audio load timeout'))
          } else {
            resolve(null)
          }
        }, 5000)
      })
      
      await audio.play()
      console.log('音频播放开始')
    } catch (error) {
      console.error('Playback error:', error)
      setIsSpeaking(false)
      if (audioRef.current) {
        audioRef.current = null
      }
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

    // 否则获取测试单词（使用与学习环节相同的30个词）
    const fetchTestWords = async () => {
      // 先尝试从 localStorage 获取单词列表（与学习环节共享）
      const savedListKey = `word_list_${user.id}`
      let wordsList: Word[] = []
      
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(savedListKey)
          if (saved) {
            const parsed = JSON.parse(saved)
            // 检查缓存是否有效（24小时内且包含单词）
            const isValidTime = parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000
            const hasWords = parsed.words && Array.isArray(parsed.words) && parsed.words.length > 0
            
            if (hasWords && isValidTime) {
              wordsList = parsed.words.map((w: any) => ({
                ...w,
                id: Number(w.id),
                is_review: w.is_review || false
              }))
              console.log(`从缓存加载 ${wordsList.length} 个单词`)
            } else {
              // 缓存无效（时间过期或没有单词），清除它
              localStorage.removeItem(savedListKey)
              console.log('单词列表缓存无效，已清除')
            }
          }
        } catch (error) {
          console.error('加载单词列表失败:', error)
          // 出错时清除缓存
          localStorage.removeItem(savedListKey)
        }
      }

      // 根据缓存数量和目标数量决定如何处理
      if (wordsList.length === 0) {
        // 没有缓存，直接获取 testCount 个单词
        console.log(`没有缓存，调用 RPC 获取 ${testCount} 个测试单词`)
        const { data, error } = await words.getWordsForSession(user.id, testCount)
        if (error || !data || data.length === 0) {
          console.error('获取测试单词失败:', error)
          return
        }
        wordsList = data.map((w: any) => ({
          ...w,
          id: Number(w.id),
          is_review: w.is_review || false
        }))
        
        // 如果返回的单词数量超过 testCount，截取前 testCount 个
        if (wordsList.length > testCount) {
          console.warn(`RPC 返回了 ${wordsList.length} 个单词，但目标数量是 ${testCount}，截取前 ${testCount} 个`)
          wordsList = wordsList.slice(0, testCount)
        }
        
        // 保存到缓存
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(savedListKey, JSON.stringify({
              words: wordsList,
              timestamp: Date.now()
            }))
          } catch (error) {
            console.error('保存单词列表失败:', error)
          }
        }
      } else if (wordsList.length < testCount) {
        // 缓存数量少于目标数量，补充缺少的数量
        const needCount = testCount - wordsList.length
        console.log(`缓存有 ${wordsList.length} 个单词，需要补充 ${needCount} 个`)
        
        const { data, error } = await words.getWordsForSession(user.id, needCount)
        if (error || !data || data.length === 0) {
          console.error('获取补充单词失败:', error)
          // 即使补充失败，也使用现有的缓存单词
        } else {
          const additionalWords = data.map((w: any) => ({
            ...w,
            id: Number(w.id),
            is_review: w.is_review || false
          }))
          
          // 合并单词列表（避免重复）
          const existingIds = new Set(wordsList.map((w: Word) => w.id))
          const newWords = additionalWords.filter((w: Word) => !existingIds.has(w.id))
          wordsList = [...wordsList, ...newWords]
          
          // 如果总数超过 testCount，截取前 testCount 个
          if (wordsList.length > testCount) {
            wordsList = wordsList.slice(0, testCount)
          }
          
          // 更新缓存
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(savedListKey, JSON.stringify({
                words: wordsList,
                timestamp: Date.now()
              }))
            } catch (error) {
              console.error('更新单词列表缓存失败:', error)
            }
          }
        }
      } else if (wordsList.length > testCount) {
        // 缓存数量多于目标数量，从缓存中选取 testCount 个
        console.log(`缓存有 ${wordsList.length} 个单词，但目标数量是 ${testCount}，选取前 ${testCount} 个`)
        wordsList = wordsList.slice(0, testCount)
      }

      // 统计复习词和新词数量
      const reviewCount = wordsList.filter(w => w.is_review).length
      const newCount = wordsList.length - reviewCount
      console.log(`测试开始：${reviewCount} 个复习词，${newCount} 个新词`)

      setTestWords(wordsList)
      setResults((prev: TestResults) => ({
        ...prev,
        translationTotal: wordsList.length,
        spellingTotal: wordsList.length,
      }))
    }

    fetchTestWords()
  }, [user.id, hasRestoredProgress, testWords.length, testPhase, currentIndex, testCount]) // ✅ 添加 testCount 作为依赖项

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

 // ✅ 修复版：同步计算状态，不依赖副作用
const handleTranslationSubmit = () => {
    if (!testWords[currentIndex]) return
    // ✅ 记录提交时间
    lastSubmissionTime.current = Date.now()
  // ✅ 新增：上锁，防止接下来的回车键误触“下一题”
 // submissionLock.current = true
  //setTimeout(() => {
  //  submissionLock.current = false
  //}, 500) // 0.5秒冷却时间
    const correct = checkTranslation(userInput, testWords[currentIndex])
    const wordId = testWords[currentIndex].id
  
    // 1. 先计算出新的状态值 (同步计算)
    const newWordResults = new Map(wordResults)
    const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
    // 如果答错，标记错误；如果答对，清除错误标记(可选，这里保留错误记录)
    newWordResults.set(wordId, { ...existing, translationError: !correct })
  
    let newResults = { ...results }
    if (correct) {
      newResults.translationCorrect += 1
    } else {
      newResults.translationErrors += 1
    }
  
    // 2. 更新 React 状态
    setIsCorrect(correct)
    setShowAnswer(true) // 确保这里设为 true
    setWordResults(newWordResults)
    setResults(newResults)
  
    // 3. 保存进度 (直接使用计算好的变量，安全)
    saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)
  }
    // 保存进度
    //setTimeout(() => {
      // 注意：这里只保存进度，不跳转
    //  saveTestProgress(testWords, currentIndex, testPhase, newResults, updatedWordResults!)
    //}, 0)
    
    // ❌ 检查：确保这里没有任何 setTimeout(() => nextQuestion(), ...) 的代码
  //}

  // 处理拼写测试提交
  // 处理拼写测试提交 (修复版：答错立即保存，防止刷新作弊)
  const handleSpellingSubmit = () => {
    if (!testWords[currentIndex]) return
    lastSubmissionTime.current = Date.now()

    const correct = userInput.trim().toLowerCase() === testWords[currentIndex].word.toLowerCase()
    const wordId = testWords[currentIndex].id
    
    // 1. 同步计算新的 WordResults
    const newWordResults = new Map(wordResults)
    const existing = newWordResults.get(wordId) || { translationError: false, spellingError: false }
    
    // 2. 同步计算新的 Results
    let newResults = { ...results }

    if (correct) {
      // --- 答对逻辑 ---
      setIsCorrect(true)
      setMustTypeCorrect(false)
      
      // 保持之前的错误记录 (如果之前错过，这里依然是 true)
      newWordResults.set(wordId, { ...existing, spellingError: existing.spellingError })
      
      newResults.spellingCorrect = results.spellingCorrect + 1

      // 更新状态
      setWordResults(newWordResults)
      setResults(newResults)
      
      // ✅ 立即保存 (答对了也要存，防止意外)
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)

      setTimeout(() => {
        nextQuestion()
      }, 1000)

    } else {
      // --- 答错逻辑 ---
      setIsCorrect(false)
      setShowAnswer(true)
      setMustTypeCorrect(true)
      
      // 标记为拼写错误
      newWordResults.set(wordId, { ...existing, spellingError: true })
      
      // 增加错误计数
      newResults.spellingErrors = results.spellingErrors + 1

      // 更新状态
      setWordResults(newWordResults)
      setResults(newResults)
      
      // ✅ 关键修复：答错的瞬间立即保存！
      // 这样即使刷新页面，系统也记得这题"已经错过一次了"
      saveTestProgress(testWords, currentIndex, testPhase, newResults, newWordResults)

      // ✅ 拼写错误时自动播放单词发音
      playAudio(testWords[currentIndex].word, 'en')

      // UI 处理
      setUserInput('')
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
  }

  // 下一题
  const nextQuestion = () => {
    // 确保 testWords 存在且有效
    if (!testWords || testWords.length === 0) {
      console.error('testWords 为空，无法继续')
      return
    }

    if (currentIndex < testWords.length - 1) {
      setCurrentIndex((prev: number) => prev + 1)
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
        // 确保 testWords[0] 存在且有 word 字段
        if (testWords[0] && testWords[0].word) {
          const hint = generateSpellingHint(testWords[0].word)
          setSpellingHint(hint)
        }
      } else {
        // 测试完成，清除进度并传递单词结果
        // ✅ 新增：标记为已完成，防止卸载时再次保存
  isCompletedRef.current = true
        clearTestProgress()
        try {
          onComplete({
            ...results,
            testWords: testWords
              .filter(w => w && w.id && w.word && w.translation) // 过滤掉无效的单词
              .map(w => {
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
        } catch (error) {
          console.error('调用 onComplete 时出错:', error)
          // 即使出错也尝试调用，但使用空数组
          onComplete({
            ...results,
            testWords: []
          })
        }
      }
    }
  }

  // 拼写阶段：检查是否必须输入正确答案（强制纠错）
// 拼写阶段：检查是否必须输入正确答案（强制纠错）
useEffect(() => {
    // 只有在需要强制纠错、已显示答案、且用户有输入时才检查
    if (testPhase === 'spelling' && mustTypeCorrect && showAnswer && !isCorrect && userInput.trim().length > 0) {
      const currentWord = testWords[currentIndex]
      if (currentWord && userInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
        // 学生已经正确拼写
        setMustTypeCorrect(false)
        setIsCorrect(true)
        
        // 1. 同步计算新的 WordResults 状态
        const newWordResults = new Map(wordResults)
        const existing = newWordResults.get(currentWord.id) || { translationError: false, spellingError: false }
        
        // ✅ 关键修复：当用户重新输入正确答案时，这个单词应该被统计为"正确"
        // 但是 spellingErrors 不应该减少（因为确实错过一次）
        // 所以需要增加 spellingCorrect，但保持 spellingErrors 不变
        const newResults = { ...results }
        
        // 检查这个单词是否已经被统计过（避免重复统计）
        // 计算当前已统计的单词数
        const currentTotal = results.spellingCorrect + results.spellingErrors
        const expectedTotal = currentIndex + 1 // 当前应该处理的单词数（包括当前单词）
        
        // 如果统计数少于应该处理的单词数，说明这个单词还没有被统计
        // 现在用户答对了（虽然第一次答错了），应该增加 spellingCorrect
        if (currentTotal < expectedTotal) {
          // 这个单词还没有被统计为正确，现在答对了，增加 spellingCorrect
          newResults.spellingCorrect = results.spellingCorrect + 1
        }
        
        // 保持之前的错误记录 (spellingError: true)，不要洗白
        newWordResults.set(currentWord.id, { ...existing, spellingError: existing.spellingError })
        
        // 更新状态
        setWordResults(newWordResults)
        setResults(newResults)
        
        // ✅ 3. 保存进度 (传入当前的 results 即可)
        saveTestProgress(testWords, currentIndex, testPhase, results, newWordResults)
        
        setTimeout(() => {
          nextQuestion()
        }, 1500)
      }
    }
  }, [userInput, mustTypeCorrect, showAnswer, testPhase, testWords, currentIndex, isCorrect, wordResults, results])
 // 更新拼写提示
  useEffect(() => {
    if (testPhase === 'spelling' && testWords[currentIndex]) {
      const hint = generateSpellingHint(testWords[currentIndex].word)
      setSpellingHint(hint)
    }
  }, [testPhase, currentIndex, testWords])

  // 在组件卸载或退出时保存测试进度
// 在组件卸载或退出时保存测试进度
useEffect(() => {
    const handleBeforeUnload = () => {
      // ✅ 修改：只有未完成时才保存
      if (testWords.length > 0 && !isCompletedRef.current) {
        saveTestProgress(testWords, currentIndex, testPhase, results, wordResults)
      }
    }
  
    window.addEventListener('beforeunload', handleBeforeUnload)
  
    return () => {
      // ✅ 修改：组件卸载时，只有在“未完成”状态下才保存
      if (testWords.length > 0 && !isCompletedRef.current) {
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

  // 显示测试开始提示（仅在第一次显示）
  // 注意：这个 useEffect 必须在所有早期返回之前，确保 hooks 调用顺序一致
  useEffect(() => {
    if (testWords.length > 0 && currentIndex === 0 && testPhase === 'translation' && showStartMessage) {
      const timer = setTimeout(() => {
        setShowStartMessage(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [testWords.length, currentIndex, testPhase, showStartMessage])

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

  // 统计复习词和新词数量（用于显示提示信息）
  const reviewCount = testWords.filter(w => w.is_review).length
  const newCount = testWords.length - reviewCount

  const currentWord: Word | undefined = testWords[currentIndex]

  if (!currentWord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        <div className="text-center">
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20 p-6 font-quicksand">
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

      {/* 测试开始提示 */}
      <AnimatePresence>
        {showStartMessage && testWords.length > 0 && currentIndex === 0 && testPhase === 'translation' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: -20 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-md text-center"
            >
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Ready to Test! 🚀</h2>
              <p className="text-lg text-gray-700 mb-2">
                You have <span className="font-bold text-yellow-600">{reviewCount}</span> review words
              </p>
              <p className="text-lg text-gray-700 mb-4">
                and <span className="font-bold text-blue-600">{newCount}</span> new words today.
              </p>
              <p className="text-xl font-semibold text-candy-green">Let's go! 🚀</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <div className="w-full bg-gray-200 rounded-full h-4 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / testWords.length) * 100}%` }}
              className="bg-gradient-to-r from-candy-blue to-candy-green h-4 rounded-full"
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-sm font-medium text-gray-600">
              {currentIndex + 1} / {testWords.length}
            </span>
          </div>
        </div>

        {/* 测试卡片 */}
        <motion.div
          key={`${testPhase}-${currentIndex}-${testWords[currentIndex]?.id}`}
          initial={{ opacity: 0, x: 50 }}
          animate={showAnswer && !isCorrect && testPhase === 'translation' ? {
            x: [0, -10, 10, -10, 10, 0],
            opacity: 1, // ✅ 关键修复：强制保持不透明
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
                  autoFocus
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault() // 防止某些浏览器的默认提交行为
                      
                      if (!showAnswer) {
                        // 还没显示答案时 -> 提交
                        handleTranslationSubmit()
                      } else {
                        // 已经显示答案了 -> 按回车直接去下一题 (这也是很好的体验)
                        // ✅ 修改：只有在没上锁的情况下，才允许去下一题
                        // 已经显示答案了 -> 检查冷却时间
                        const now = Date.now()
                        // ✅ 只有距离上次提交超过 500ms，才允许去下一题
                        if (now - lastSubmissionTime.current > 500) {
                          nextQuestion()
                        }
                      }
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault() // 防止某些浏览器的默认提交行为
                            // ✅ 1. 检查时间锁 (防止机器级连击)
      const now = Date.now()
      if (now - lastSubmissionTime.current < 500) return

      // ✅ 2. 核心修复：增加 !isCorrect 判断
      // 如果已经答对(正在等待跳转)，或者已经显示答案，就不允许再提交了
      if (!showAnswer && !isCorrect) {
        handleSpellingSubmit()
      } else if (mustTypeCorrect && userInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
        // 强制纠错时的逻辑 (保持不变)
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

