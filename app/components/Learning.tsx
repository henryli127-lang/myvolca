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
  keywords?: string[]
}

interface LearningProps {
  user: User
  onComplete: () => void
  onLogout: () => void
}

export default function Learning({ user, onComplete, onLogout }: LearningProps) {
  const [word, setWord] = useState<Word | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const TARGET_WORDS = 20
  const LEARNING_PROGRESS_KEY = `learning_progress_${user.id}`
  
  // 从 localStorage 恢复学习进度
  const loadProgress = () => {
    if (typeof window === 'undefined') return { count: 0, wordIds: [] }
    
    try {
      const saved = localStorage.getItem(LEARNING_PROGRESS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          count: parsed.count || 0,
          wordIds: parsed.wordIds || []
        }
      }
    } catch (error) {
      console.error('加载学习进度失败:', error)
    }
    return { count: 0, wordIds: [] }
  }

  // 保存学习进度到 localStorage
  const saveProgress = (count: number, wordIds: number[]) => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify({
        count,
        wordIds,
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

  // 获取随机单词（排除已学习的单词）
  const fetchRandomWord = useCallback(async () => {
    setLoading(true)
    setIsFlipped(false)
    
    let attempts = 0
    const maxAttempts = 50
    
    while (attempts < maxAttempts) {
      const { data, error } = await words.getRandomUnmastered(user.id)
      
      if (error || !data) {
        console.error('获取单词失败:', error)
        setLoading(false)
        return
      }
      
      // 使用 ref 同步检查这个单词是否已经学习过
      if (!learnedWordIdsRef.current.has(data.id)) {
        // 如果这个单词还没有学习过，使用它
        setWord(data as Word)
        setLoading(false)
        return
      }
      
      attempts++
    }
    
    // 如果尝试多次都找不到新单词，说明单词不够了
    console.warn('无法找到更多未学习的单词')
    setLoading(false)
  }, [user.id])

  // 初始化：如果已有进度，恢复进度；否则获取新单词
  useEffect(() => {
    // 如果已有学习进度，恢复进度并获取下一个单词
    if (learnedCount > 0 && learnedWordIdsRef.current.size > 0) {
      console.log(`恢复学习进度: ${learnedCount}/${TARGET_WORDS}，已学习单词数: ${learnedWordIdsRef.current.size}`)
    }
    fetchRandomWord()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 语音朗读函数
  const playAudio = useCallback((text: string) => {
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
  }, [speechSupported])

  // 自动播放
  useEffect(() => {
    if (word && !isFlipped && speechSupported) {
      const timer = setTimeout(() => {
        playAudio(word.word)
      }, 500)
      return () => {
        clearTimeout(timer)
        if (speechSynthesisRef.current) {
          speechSynthesisRef.current.cancel()
        }
      }
    }
  }, [word, isFlipped, speechSupported, playAudio])

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

      // 标记这个单词为已学习（使用 ref 同步更新）
      learnedWordIdsRef.current.add(word.id)
      const newCount = learnedCount + 1
      setLearnedCount(newCount)

      // 保存进度到 localStorage
      saveProgress(newCount, Array.from(learnedWordIdsRef.current))

      // 如果已经学习了 20 个单词，显示过渡动画并完成
      if (newCount >= TARGET_WORDS) {
        // 清除学习进度（已完成）
        clearProgress()
        setShowTransition(true)
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        // 否则获取下一个单词
        await fetchRandomWord()
      }
    } catch (error) {
      console.error('更新学习进度失败:', error)
    }
  }

  const handleNotSure = async () => {
    await fetchRandomWord()
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
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <motion.h2
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-7xl font-bold text-white drop-shadow-lg text-center"
                    >
                      {word.word}
                    </motion.h2>
                    {speechSupported && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          playAudio(word.word)
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
                    )}
                  </div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
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

                    {word.sentence_en && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/30 backdrop-blur-sm rounded-2xl p-5 border-2 border-white/50"
                      >
                        <p className="text-white font-semibold text-sm mb-2">📝 例句</p>
                        <p className="text-white text-base leading-relaxed italic">
                          {word.sentence_en}
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

