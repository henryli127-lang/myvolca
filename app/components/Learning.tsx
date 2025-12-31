'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { words, userProgress } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// 音量图标组件
const VolumeIcon = ({ size = 32, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
)

interface Word {
  id: number
  word: string
  translation: string
  pos?: string
  mnemonic?: string
  sentence_en?: string
  sentence_cn?: string
  keywords?: string[]
  is_review?: boolean
}

interface LearningProps {
  user: User
  targetCount: number
  onComplete: () => void
  onLogout: () => void
}

export default function Learning({ user, targetCount, onComplete, onLogout }: LearningProps) {
  const [word, setWord] = useState<Word | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const TARGET_WORDS = targetCount
  const LEARNING_PROGRESS_KEY = `learning_progress_${user.id}`
  // ✅ 添加这一行，解决 "audioRef is not defined" 报错
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastPlayedWordRef = useRef<string | null>(null) // 跟踪上次播放的单词，防止重复播放
  // 从 localStorage 恢复学习进度
// 从 localStorage 恢复学习进度 (修改版：支持恢复完整单词列表)
const loadProgress = () => {
    if (typeof window === 'undefined') return { count: 0, wordIds: [], words: [] }
    
    try {
      const saved = localStorage.getItem(LEARNING_PROGRESS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          count: parsed.count || 0,
          wordIds: parsed.wordIds || [],
          words: parsed.words || [] // ✅ 新增：恢复完整的单词对象数组
        }
      }
    } catch (error) {
      console.error('加载学习进度失败:', error)
    }
    return { count: 0, wordIds: [], words: [] }
  }

  // 保存学习进度到 localStorage (修改版：保存完整单词列表)
  const saveProgress = (count: number, words: Word[]) => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
        count,
        wordIds: words.map(w => w.id), // 为了兼容旧逻辑，保留 ID 列表
        words: words, // ✅ 新增：保存完整的单词对象
        timestamp: Date.now()
      }))
    } catch (error) {
      console.error('保存学习进度失败:', error)
    }
  }



  // 清除学习进度
  const clearProgress = () => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(LEARNING_PROGRESS_KEY)
    } catch (error) {
      console.error('清除学习进度失败:', error)
    }
  }

  const initialProgress = loadProgress()
  const [learnedCount, setLearnedCount] = useState(initialProgress.count)
  const learnedWordIdsRef = useRef<Set<number>>(new Set(initialProgress.wordIds))
  // ✅ 新增：用于存储本轮已学习的所有单词完整信息
  const learnedWordsRef = useRef<Word[]>(initialProgress.words || [])
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null)

  // 检查语音 API 支持
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true)
      speechSynthesisRef.current = window.speechSynthesis
      
      const loadVoices = () => {
        if (speechSynthesisRef.current) {
          speechSynthesisRef.current.getVoices()
        }
      }
      loadVoices()
      if (speechSynthesisRef.current.onvoiceschanged !== undefined) {
        speechSynthesisRef.current.onvoiceschanged = loadVoices
      }
    }

    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel()
      }
    }
  }, [])

  // 从缓存中获取下一个单词
  const getNextWordFromCache = useCallback(() => {
    const wordListKey = `word_list_${user.id}`
    const saved = localStorage.getItem(wordListKey)
    
    if (!saved) {
      return null
    }
    
    try {
      const parsed = JSON.parse(saved)
      if (!parsed.words || !Array.isArray(parsed.words)) {
        return null
      }
      
      // 找到第一个未学习的单词
      const unlearnedWord = parsed.words.find((w: Word) => 
        !learnedWordIdsRef.current.has(Number(w.id))
      )
      
      if (unlearnedWord) {
        // ✅ 确保所有字段都被保留，特别是 sentence_en 和 sentence_cn
        const word: Word = {
          id: Number(unlearnedWord.id),
          word: unlearnedWord.word,
          translation: unlearnedWord.translation,
          pos: unlearnedWord.pos,
          mnemonic: unlearnedWord.mnemonic,
          sentence_en: unlearnedWord.sentence_en,
          sentence_cn: unlearnedWord.sentence_cn,
          keywords: unlearnedWord.keywords,
          is_review: unlearnedWord.is_review || false
        }
        return word
      }
      
      return null
    } catch (error) {
      console.error('解析缓存单词列表失败:', error)
      return null
    }
  }, [user.id])

  // 初始化：加载或获取单词列表
  useEffect(() => {
    const initializeWords = async () => {
      const wordListKey = `word_list_${user.id}`
      const saved = localStorage.getItem(wordListKey)
      
      // 检查是否有缓存
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.words && Array.isArray(parsed.words) && parsed.words.length > 0) {
            // 有缓存，检查是否有未完成的单词
            const unlearnedCount = parsed.words.filter((w: Word) => 
              !learnedWordIdsRef.current.has(Number(w.id))
            ).length
            
            if (unlearnedCount > 0) {
              // 有未完成的单词，使用缓存
              console.log(`从缓存恢复学习，还有 ${unlearnedCount} 个单词未学习`)
              const nextWord = getNextWordFromCache()
              if (nextWord) {
                // ✅ 确保单词对象包含所有字段
                const wordData: Word = {
                  id: Number(nextWord.id),
                  word: nextWord.word,
                  translation: nextWord.translation,
                  pos: nextWord.pos,
                  mnemonic: nextWord.mnemonic,
                  sentence_en: nextWord.sentence_en,
                  sentence_cn: nextWord.sentence_cn,
                  keywords: nextWord.keywords,
                  is_review: nextWord.is_review || false
                }
                setWord(wordData)
                setLoading(false)
                return
              }
            } else {
              // 缓存中的单词都已学习，需要获取新的
              console.log('缓存中的单词都已学习，获取新单词')
              localStorage.removeItem(wordListKey)
            }
          }
        } catch (error) {
          console.error('解析缓存失败:', error)
          localStorage.removeItem(wordListKey)
        }
      }
      
      // 没有缓存或缓存无效，计算需要获取的单词数量
      const remainingCount = TARGET_WORDS - learnedCount
      if (remainingCount <= 0) {
        console.log('已完成所有学习目标')
        setLoading(false)
        return
      }
      
      // 一次性获取所需数量的新单词
      console.log(`开始新的学习会话，获取 ${remainingCount} 个新单词`)
      setLoading(true)
      
      const { data, error } = await words.getNewWordsBatch(user.id, remainingCount)
      
      if (error || !data || data.length === 0) {
        console.error('获取学习单词失败:', error)
        setLoading(false)
        return
      }
      
      // 保存到缓存（确保所有字段都被保留）
      const wordsToCache = data.map((w: any) => {
        const word: Word = {
          id: Number(w.id),
          word: w.word,
          translation: w.translation,
          pos: w.pos,
          mnemonic: w.mnemonic,
          sentence_en: w.sentence_en,
          sentence_cn: w.sentence_cn,
          keywords: w.keywords,
          is_review: w.is_review || false
        }
        return word
      })
      
      
      localStorage.setItem(wordListKey, JSON.stringify({
        words: wordsToCache,
        timestamp: Date.now()
      }))
      
      // 显示第一个单词
      if (wordsToCache.length > 0) {
        setWord(wordsToCache[0])
      }
      
      setLoading(false)
    }
    
    initializeWords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 获取下一个单词（从缓存中）
  const fetchNextWord = useCallback(() => {
    const nextWord = getNextWordFromCache()
    if (nextWord) {
      setWord(nextWord as Word)
      setIsFlipped(false)
    } else {
      console.warn('缓存中没有更多未学习的单词')
    }
  }, [getNextWordFromCache])

  // 语音朗读函数
  /*const playAudio = useCallback((text: string) => {
    if (!speechSupported || !speechSynthesisRef.current) return

    try {
      speechSynthesisRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      
      const voices = speechSynthesisRef.current.getVoices()
      const nzVoice = voices.find(voice => voice.lang === 'en-NZ')
      const gbVoice = voices.find(voice => voice.lang === 'en-GB')
      const usVoice = voices.find(voice => voice.lang === 'en-US')
      
      if (nzVoice) {
        utterance.voice = nzVoice
        utterance.lang = 'en-NZ'
      } else if (gbVoice) {
        utterance.voice = gbVoice
        utterance.lang = 'en-GB'
      } else if (usVoice) {
        utterance.voice = usVoice
        utterance.lang = 'en-US'
      } else {
        utterance.lang = 'en'
      }

      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 1.0

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      speechSynthesisRef.current.speak(utterance)
    } catch (error) {
      console.error('播放语音时出错:', error)
      setIsSpeaking(false)
    }
  }, [speechSupported])*/

  // 自动播放
  //useEffect(() => {
    //if (word && !isFlipped && speechSupported) {
      //const timer = setTimeout(() => {
        //playAudio(word.word)
      //}, 500)
      //return () => {
        //clearTimeout(timer)
        //if (speechSynthesisRef.current) {
          //speechSynthesisRef.current.cancel()
        //}
      //}
    //}
  //}, [word, isFlipped, speechSupported, playAudio])


  const playAudio = useCallback(async (text: string, lang: 'en' | 'zh' = 'en') => {
    if (!text) {
      console.warn('playAudio: 文本为空，无法播放')
      return
    }
    
    console.log('playAudio 被调用:', { text: text.substring(0, 50), lang })
    
    // ✅ 如果正在播放，直接返回，防止重复播放
    // 检查 audioRef.current 是否存在且正在播放（更可靠）
    if (audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0) {
      console.log('音频正在播放，忽略重复调用')
      return
    }
    
    // 使用 ref 检查 isSpeaking，避免依赖状态
    // 注意：这里不检查 isSpeaking 状态，因为状态更新是异步的，可能导致竞态条件
    // 只检查 audioRef.current 的播放状态
    
    setIsSpeaking(true)

    try {
      // ✅ 停止之前的播放（如果存在）
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current = null
      }

      console.log('正在请求 TTS:', { text: text.substring(0, 50), lang })
      //const response = await fetch('/api/tts', {
        //method: 'POST',
        //headers: { 'Content-Type': 'application/json' },
        //body: JSON.stringify({ text, lang }),
        const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`, {
            method: 'GET',
            // GET 请求不需要 body 和 Content-Type
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
      
      // ✅ 赋值给 Ref 
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
        // ✅ 音频播放完成后，重置跟踪，允许下次播放
        if (lastPlayedWordRef.current === text) {
          lastPlayedWordRef.current = null
        }
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
        // ✅ 音频播放出错时，也重置跟踪
        if (lastPlayedWordRef.current === text) {
          lastPlayedWordRef.current = null
        }
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
      // ✅ 播放出错时，重置跟踪
      if (lastPlayedWordRef.current === text) {
        lastPlayedWordRef.current = null
      }
    }
  }, []) // 移除 isSpeaking 依赖，避免循环触发
  
  // 自动播放：只在单词变化且卡片未翻转时播放
  useEffect(() => {
    // 只在有单词、卡片未翻转、且单词字符串存在时执行
    if (!word || isFlipped || !word.word) {
      // 单词变化或卡片翻转时，重置跟踪
      lastPlayedWordRef.current = null
      return
    }
    
    const currentWordText = word.word // 保存当前单词文本
    
    // ✅ 如果这个单词已经播放过，不再重复播放
    if (lastPlayedWordRef.current === currentWordText) {
      return
    }
    
    // ✅ 如果正在播放其他音频，不自动播放（使用 ref 检查，避免依赖状态）
    if (audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0) {
      return
    }
    
    // 标记为已播放，防止重复触发（在设置定时器之前就标记）
    lastPlayedWordRef.current = currentWordText
    
    const timer = setTimeout(() => {
      // 再次检查，确保在延迟期间没有开始播放其他音频，且单词没有变化
      if ((!audioRef.current || audioRef.current.paused) && 
          lastPlayedWordRef.current === currentWordText &&
          word && word.word === currentWordText) {
        console.log('自动播放单词:', currentWordText)
        playAudio(currentWordText, 'en')
      } else {
        // 如果条件不满足，重置标记，允许下次播放
        if (lastPlayedWordRef.current === currentWordText) {
          lastPlayedWordRef.current = null
        }
      }
    }, 500)
    
    return () => {
      clearTimeout(timer)
      // 如果组件卸载或单词变化，且定时器还没执行，重置标记
      if (lastPlayedWordRef.current === currentWordText) {
        lastPlayedWordRef.current = null
      }
    }
  }, [word?.word, isFlipped]) // 只依赖 word.word 和 isFlipped，不依赖 playAudio


  const handleCardClick = () => {
    setIsFlipped(!isFlipped)
  }

  const handleGotIt = async () => {
    if (!word || !user) return

    try {
      const { data: existingProgress } = await userProgress.checkProgress(user.id, word.id)
      const isNewWord = !existingProgress
      const currentReviewCount = existingProgress?.review_count || 0

      await userProgress.upsertProgress(
        user.id,
        word.id,
        isNewWord,
        currentReviewCount
      )

      // 1. 更新状态
      learnedWordIdsRef.current.add(word.id)
      // ✅ 新增：把当前学完的这个单词加入列表
      learnedWordsRef.current = [...learnedWordsRef.current, word]
      
      const newCount = learnedCount + 1
      setLearnedCount(newCount)

      // ✅ 修改：保存进度时传入完整的单词列表
      saveProgress(newCount, learnedWordsRef.current)

      // 2. 检查是否完成
      if (newCount >= TARGET_WORDS) {
        // ✅ 关键修复：将刚才学完的所有单词保存到 word_list 缓存
        // 这样 Challenge 组件启动时，就会直接读取这份名单，而不会去数据库重新瞎抓
        localStorage.setItem(`word_list_${user.id}`, JSON.stringify({
          words: learnedWordsRef.current, // 传递这 20 个特定的词
          timestamp: Date.now()
        }))

        // 清除学习进度（learning_progress 可以清了，但 word_list 留给测试用）
        clearProgress()
        
        setShowTransition(true)
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        // 否则获取下一个单词（从缓存中）
        fetchNextWord()
      }
    } catch (error) {
      console.error('更新学习进度失败:', error)
    }
  }

  const handleNotSure = () => {
    fetchNextWord()
  }

  if (loading || !word) {
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

  // 创建一个包装的退出函数，在退出前保存进度
  const handleLogoutWithSave = () => {
    // 确保当前进度已保存（如果用户在学习过程中退出）
    if (learnedCount > 0 && learnedWordIdsRef.current.size > 0) {
        saveProgress(learnedCount, learnedWordsRef.current)
    }
    onLogout()
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
      <div className="max-w-4xl mx-auto">
        {/* 进度条 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold text-gray-700">
              学习进度: {learnedCount} / {TARGET_WORDS}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round((learnedCount / TARGET_WORDS) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(learnedCount / TARGET_WORDS) * 100}%` }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-r from-candy-blue via-candy-green to-candy-orange h-4 rounded-full"
            />
          </div>
        </div>

        {/* 单词卡片 */}
        <div className="flex-1 flex items-center justify-center mb-8">
          <div className="w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative perspective-1000"
            >
              <motion.div
                className="relative w-full h-96 transform-style-preserve-3d cursor-pointer"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
                onClick={handleCardClick}
              >
                {/* 正面 - 英文单词 */}
                <div className="absolute inset-0 backface-hidden rounded-3xl bg-gradient-to-br from-candy-blue via-candy-green to-candy-orange shadow-2xl flex flex-col items-center justify-center p-8 border-4 border-white">
                  {/* Review 标签 */}
                  {word.is_review && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg"
                    >
                      🔄 Review
                    </motion.div>
                  )}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <motion.h2
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-7xl font-bold text-white drop-shadow-lg text-center"
                    >
                      {word.word}
                    </motion.h2>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        playAudio(word.word, 'en')
                      }}
                      className={`p-3 rounded-full transition-all ${
                        isSpeaking
                          ? 'bg-white/30 text-white animate-pulse'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                      aria-label="朗读单词"
                    >
                      <VolumeIcon size={32} className={isSpeaking ? 'animate-pulse' : ''} />
                    </motion.button>
                  </div>
                  {/* 新词显示完整例句，复习词不显示 */}
                  {word.sentence_en && !word.is_review && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white/30 backdrop-blur-sm rounded-2xl p-5 border-2 border-white/50 max-w-2xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white font-semibold text-sm">📝 例句</p>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (word.sentence_en) {
                              playAudio(word.sentence_en, 'en')
                            }
                          }}
                          className={`p-2 rounded-full transition-all ${
                            isSpeaking
                              ? 'bg-white/30 text-white animate-pulse'
                              : 'bg-white/20 hover:bg-white/30 text-white'
                          }`}
                          aria-label="朗读例句"
                        >
                          <VolumeIcon size={20} className={isSpeaking ? 'animate-pulse' : ''} />
                        </motion.button>
                      </div>
                      <p className="text-white text-base leading-relaxed italic">
                        {word.sentence_en}
                      </p>
                    </motion.div>
                  )}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-white/90 text-lg mt-6"
                  >
                    👆 点击卡片查看详情
                  </motion.p>
                </div>

                {/* 背面 - 翻译、词性、记忆技巧和例句 */}
                <div className="absolute inset-0 backface-hidden rounded-3xl bg-gradient-to-br from-candy-orange via-candy-green to-candy-blue shadow-2xl flex flex-col p-8 border-4 border-white overflow-y-auto" style={{ transform: 'rotateY(180deg)' }}>
                  <div className="flex-1">
                    <div className="text-center mb-6">
                      <h3 className="text-5xl font-bold text-white drop-shadow-lg mb-3">
                        {word.translation}
                      </h3>
                      {word.pos && (
                        <span className="inline-block px-5 py-2 bg-white/30 backdrop-blur-sm text-white rounded-full text-sm font-semibold">
                          {word.pos}
                        </span>
                      )}
                    </div>

                    {word.mnemonic && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-6 bg-white/30 backdrop-blur-sm rounded-2xl p-5 border-2 border-white/50"
                      >
                        <p className="text-white font-semibold text-sm mb-2">💡 记忆技巧</p>
                        <p className="text-white text-base leading-relaxed">
                          {word.mnemonic}
                        </p>
                      </motion.div>
                    )}

                    {word.sentence_cn && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/30 backdrop-blur-sm rounded-2xl p-5 border-2 border-white/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-white font-semibold text-sm">📝 中文例句</p>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              if (word.sentence_cn) {
                                playAudio(word.sentence_cn, 'zh')
                              }
                            }}
                            className={`p-2 rounded-full transition-all ${
                              isSpeaking
                                ? 'bg-white/30 text-white animate-pulse'
                                : 'bg-white/20 hover:bg-white/30 text-white'
                            }`}
                            aria-label="朗读中文例句"
                          >
                            <VolumeIcon size={20} className={isSpeaking ? 'animate-pulse' : ''} />
                          </motion.button>
                        </div>
                        <p className="text-white text-base leading-relaxed">
                          {word.sentence_cn}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGotIt}
            className="bg-candy-green text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform transition-all text-lg"
          >
            ✅ Got it
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNotSure}
            className="bg-candy-orange text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform transition-all text-lg"
          >
            ❓ Not sure
          </motion.button>
        </div>
      </div>

      {/* 完成过渡动画 */}
      <AnimatePresence>
        {showTransition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-6xl font-bold text-white text-center"
            >
              Challenge Unlocked! ⚔️
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

