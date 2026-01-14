'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { articles } from '@/lib/supabase'
import { Volume2, VolumeX } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface ArticleViewProps {
  user: User
  articleId: string
  onBack: () => void
  onLogout: () => void
}

interface Article {
  id: string
  title: string
  content: string
  html_content: string
  image_url: string | null
  quiz?: any[]
  created_at: string
}

export default function ArticleView({ user, articleId, onBack, onLogout }: ArticleViewProps) {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState<{ word: string; translation: string; x: number; y: number } | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0) // 播放速度，默认1.0（正常速度）

  useEffect(() => {
    const loadArticle = async () => {
      try {
        const { data, error } = await articles.getById(articleId, user.id)
        if (error) {
          console.error('获取文章失败:', error)
          setError('无法加载文章')
        } else {
          setArticle(data)
        }
      } catch (err) {
        console.error('加载文章异常:', err)
        setError('加载文章时发生错误')
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [articleId, user.id])

  // 查询单词翻译（使用在线翻译服务）
  const lookupWordTranslation = useCallback(async (word: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/translate?word=${encodeURIComponent(word)}&lang=zh`)
      if (response.ok) {
        const data = await response.json()
        return data.translation || null
      }
      return null
    } catch (error) {
      console.error('查询单词翻译失败:', error)
      return null
    }
  }, [])

  // 处理文本，使单词可点击
  const processTextWithHighlights = useCallback((text: string) => {
    if (!text) return null
    
    // 使用正则表达式匹配所有单词
    const wordRegex = /\b\w+\b/g
    const parts: Array<{ text: string; isWord: boolean }> = []
    let lastIndex = 0
    let match
    
    while ((match = wordRegex.exec(text)) !== null) {
      // 添加单词前的非单词字符
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), isWord: false })
      }
      // 添加单词
      parts.push({ text: match[0], isWord: true })
      lastIndex = match.index + match[0].length
    }
    
    // 添加剩余的文本
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isWord: false })
    }
    
    // 如果没有匹配到单词，直接返回原文本
    if (parts.length === 0) {
      return <span>{text}</span>
    }
    
    return parts.map((part, index) => {
      if (!part.isWord) {
        return <span key={index}>{part.text}</span>
      }
      
      return (
        <span
          key={`word-${index}-${part.text}`}
          onClick={async (e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            const translation = await lookupWordTranslation(part.text)
            
            // 计算弹窗位置，确保在视口内
            const x = Math.min(
              Math.max(rect.left + rect.width / 2, 150),
              window.innerWidth - 150
            )
            const y = Math.max(rect.top - 10, 50)
            
            // 即使翻译为null也显示弹窗，提示用户未找到翻译
            setSelectedWord({
              word: part.text,
              translation: translation || '暂无翻译',
              x,
              y
            })
          }}
          className="cursor-pointer rounded px-1 transition-colors inline-block hover:bg-gray-100"
          title="点击查看翻译"
        >
          {part.text}
        </span>
      )
    })
  }, [lookupWordTranslation])

  // 播放音频
  const playAudio = useCallback(async () => {
    if (!article) return

    // 如果正在播放，暂停
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    // 如果已加载但暂停，继续播放
    if (audioRef.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
      audioRef.current.play()
      setIsPlaying(true)
      return
    }

    // 停止之前的播放
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }

    setIsLoading(true)
    setIsPlaying(false)

    try {
      const fullText = `${article.title}. ${article.content}`
      
      const response = await fetch(
        `/api/tts?text=${encodeURIComponent(fullText)}&lang=en`,
        { method: 'GET' }
      )

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`)
      }

      const blob = await response.blob()
      if (blob.size === 0) {
        throw new Error('Empty audio blob')
      }

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      
      // 设置播放速度
      audio.playbackRate = playbackRate
      
      audioRef.current = audio

      audio.onplay = () => {
        setIsPlaying(true)
        setIsLoading(false)
      }

      audio.onpause = () => {
        setIsPlaying(false)
      }

      audio.onended = () => {
        setIsPlaying(false)
        if (audioRef.current) {
          URL.revokeObjectURL(url)
          audioRef.current = null
        }
      }

      audio.onerror = (e) => {
        console.error('Audio playback error:', e)
        setIsPlaying(false)
        setIsLoading(false)
        if (audioRef.current) {
          URL.revokeObjectURL(url)
          audioRef.current = null
        }
      }

      await audio.play()
    } catch (error: any) {
      console.error('播放音频失败:', error)
      setIsPlaying(false)
      setIsLoading(false)
      alert('无法播放音频，请稍后重试')
    }
  }, [article])

  // 点击页面其他地方关闭弹窗
  useEffect(() => {
    const handleClickOutside = () => {
      setSelectedWord(null)
    }
    if (selectedWord) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [selectedWord])

  // 清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src)
        }
        audioRef.current = null
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-candy-blue border-t-transparent rounded-full"
        />
        <p className="ml-4 text-candy-blue font-bold">加载中...</p>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-xl text-gray-700 mb-4">{error || '文章不存在'}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="bg-candy-blue text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            返回图书馆
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20 p-6 font-quicksand">
      {/* 顶部按钮 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="bg-white/80 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <span>←</span>
          <span className="font-semibold">返回</span>
        </motion.button>
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

      <div className="max-w-4xl mx-auto pt-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-candy-blue"
        >
          {/* 头部 */}
          <div className="bg-gradient-to-r from-candy-blue/10 to-candy-green/10 p-4 flex justify-between items-center border-b-2 border-gray-200">
            <div></div>
          </div>

          {/* 文章内容 */}
          <div className="p-8 md:p-12 max-h-[85vh] overflow-y-auto">
            {/* 播放速度控制和朗读按钮 - 放在标题上方 */}
            <div className="flex justify-end items-center gap-2 mb-4">
              {/* 播放速度选择 */}
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-md">
                <span className="text-xs text-gray-600 font-semibold">速度:</span>
                <select
                  value={playbackRate.toString()}
                  onChange={(e) => {
                    const newRate = parseFloat(e.target.value)
                    if (!isNaN(newRate) && newRate > 0) {
                      setPlaybackRate(newRate)
                      // 如果正在播放，立即应用新的播放速度
                      if (audioRef.current) {
                        audioRef.current.playbackRate = newRate
                      }
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-semibold text-candy-blue bg-transparent border-none outline-none cursor-pointer"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1.0x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                </select>
              </div>
              {/* 朗读按钮 */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={playAudio}
                disabled={isLoading}
                className={`
                  flex items-center justify-center w-12 h-12 rounded-full transition-all shadow-lg
                  ${isPlaying
                    ? 'bg-candy-green text-white animate-pulse'
                    : isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-candy-blue text-white hover:bg-candy-green'
                  }
                `}
                title={isPlaying ? '暂停朗读' : '朗读故事'}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : isPlaying ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </motion.button>
            </div>
            
            {/* 标题 */}
            <div className="flex items-center justify-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-candy-blue to-candy-green bg-clip-text text-transparent">
                {article.title}
              </h2>
            </div>

            {/* 文章图片 */}
            {article.image_url && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8 w-full"
              >
                <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover rounded-2xl shadow-lg"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            )}

            {/* 文章正文 */}
            <div className="prose prose-lg max-w-none">
              {article.content.split('\n').map((paragraph, idx) => {
                if (!paragraph.trim()) return null
                const highlighted = processTextWithHighlights(paragraph.trim())
                if (!highlighted) return null
                return (
                  <p key={idx} className="mb-4 leading-relaxed text-gray-700 text-lg">
                    {highlighted}
                  </p>
                )
              })}
            </div>

            {/* 测验模块 */}
            {article.quiz && article.quiz.length > 0 && (
              <div className="mt-12 pt-12 border-t-2 border-gray-200">
                <div className="mb-8 text-center">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">🧠 阅读理解测验</h3>
                  <p className="text-gray-600">回顾一下你对故事的理解程度！</p>
                </div>
                <div className="space-y-6">
                  {article.quiz.map((q: any, qIndex: number) => (
                    <div key={qIndex} className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-200">
                      <p className="text-lg font-semibold text-gray-800 mb-4">
                        <span className="text-candy-blue font-bold mr-2">{qIndex + 1}.</span>
                        {q.question}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((option: string, optIndex: number) => (
                          <div
                            key={optIndex}
                            className={`
                              px-4 py-3 rounded-xl border-2 font-medium
                              ${optIndex === q.correctAnswerIndex
                                ? 'bg-green-100 border-green-500 text-green-700'
                                : 'bg-white border-gray-200 text-gray-700'
                              }
                            `}
                          >
                            <div className="flex items-center">
                              <span className={`
                                w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs mr-3 flex-shrink-0 font-bold
                                ${optIndex === q.correctAnswerIndex ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white text-gray-700'}
                              `}>
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              {option}
                              {optIndex === q.correctAnswerIndex && <span className="ml-2 text-green-600">✓</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 发布日期 */}
            <div className="mt-8 text-center mb-4">
              <p className="text-sm text-gray-500 italic">
                保存于 {new Date(article.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 单词翻译弹窗 */}
      <AnimatePresence>
        {selectedWord && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            style={{
              position: 'fixed',
              left: selectedWord.x,
              top: selectedWord.y,
              transform: 'translateX(-50%)',
              zIndex: 60,
            }}
            className="bg-candy-blue text-white px-4 py-2 rounded-lg shadow-xl text-sm font-semibold whitespace-nowrap"
          >
            {selectedWord.word}: {selectedWord.translation}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
