'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { SelectionItem, QuizQuestion, StoryState, GenerationStatus } from '../types/storyspark'
import { Volume2, VolumeX } from 'lucide-react'

interface StorySparkProps {
  testWords: Array<{ 
    id: number
    word: string
    translation: string
  }>
  onBack: () => void
  onLogout: () => void
}

const CHARACTERS: SelectionItem[] = [
  {
    id: 'char_labubu',
    name: 'Labubu',
    imageUrl: '/labubu.jpg',
    description: 'A quirky, mischievous little monster with long ears and a wide smile.',
    type: 'character'
  },
  {
    id: 'char_mickey',
    name: 'Mickey Mouse',
    imageUrl: '/mickeymouse.png',
    description: 'A cheerful, iconic mouse who loves adventure and fun.',
    type: 'character'
  },
  {
    id: 'char_elsa',
    name: 'Queen Elsa',
    imageUrl: '/elsa.jpeg',
    description: 'A magical queen with the power to control ice and snow.',
    type: 'character'
  },
  {
    id: 'char_buzz',
    name: 'Buzz Lightyear',
    imageUrl: '/buzz.webp',
    description: 'A heroic space ranger toy ready to go to infinity and beyond.',
    type: 'character'
  }
]

const SETTINGS: SelectionItem[] = [
  {
    id: 'set_1',
    name: 'Mysterious Island',
    imageUrl: 'https://picsum.photos/seed/jungle_ruins_mystery/400/400',
    description: 'A hidden land filled with ancient ruins and jungle.',
    type: 'setting'
  },
  {
    id: 'set_2',
    name: 'Cyber City',
    imageUrl: 'https://picsum.photos/seed/neon_cyberpunk_city_future/400/400',
    description: 'A glowing metropolis of the future with flying cars.',
    type: 'setting'
  },
  {
    id: 'set_3',
    name: 'Enchanted Forest',
    imageUrl: 'https://picsum.photos/seed/magical_forest_fantasy/400/400',
    description: 'A deep wood where trees whisper and fairies dance.',
    type: 'setting'
  },
  {
    id: 'set_4',
    name: 'Mars Base',
    imageUrl: 'https://picsum.photos/seed/mars_red_planet_space/400/400',
    description: 'A red dusty planet with a high-tech science lab.',
    type: 'setting'
  }
]

export default function StorySpark({ testWords, onBack, onLogout }: StorySparkProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<SelectionItem | null>(null)
  const [selectedSetting, setSelectedSetting] = useState<SelectionItem | null>(null)
  const [story, setStory] = useState<StoryState | null>(null)
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false)

  // 保存阅读状态到 localStorage
  const saveReadingProgress = useCallback(() => {
    if (typeof window === 'undefined') return
    
    try {
      const progress = {
        selectedCharacter,
        selectedSetting,
        story,
        status,
        testWords,
        timestamp: Date.now()
      }
      localStorage.setItem('reading_progress', JSON.stringify(progress))
    } catch (error) {
      console.error('保存阅读进度失败:', error)
    }
  }, [selectedCharacter, selectedSetting, story, status, testWords])

  // 恢复阅读状态
  useEffect(() => {
    if (hasRestoredProgress) return
    
    if (typeof window === 'undefined') {
      setHasRestoredProgress(true)
      return
    }
    
    try {
      const saved = localStorage.getItem('reading_progress')
      if (saved) {
        const parsed = JSON.parse(saved)
        // 检查时间戳（24小时内有效）
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          // 验证 testWords 是否匹配（允许部分匹配）
          if (parsed.testWords && Array.isArray(parsed.testWords) && parsed.testWords.length > 0) {
            // 检查是否有重叠的单词
            const savedWords = new Set(parsed.testWords.map((w: any) => w.word?.toLowerCase()))
            const currentWords = new Set(testWords.map(w => w.word.toLowerCase()))
            const hasOverlap = Array.from(savedWords).some(w => currentWords.has(w))
            
            if (hasOverlap || parsed.testWords.length === testWords.length) {
              if (parsed.selectedCharacter) {
                setSelectedCharacter(parsed.selectedCharacter)
              }
              if (parsed.selectedSetting) {
                setSelectedSetting(parsed.selectedSetting)
              }
              if (parsed.story) {
                setStory(parsed.story)
              }
              if (parsed.status) {
                setStatus(parsed.status)
              }
              
              console.log('已恢复阅读进度')
            } else {
              // testWords 不匹配，清除旧进度
              localStorage.removeItem('reading_progress')
            }
          } else {
            // 没有 testWords，清除旧进度
            localStorage.removeItem('reading_progress')
          }
        } else {
          // 超过24小时，清除旧进度
          localStorage.removeItem('reading_progress')
        }
      }
    } catch (error) {
      console.error('恢复阅读进度失败:', error)
      localStorage.removeItem('reading_progress')
    } finally {
      setHasRestoredProgress(true)
    }
  }, [testWords, hasRestoredProgress])

  // 当状态改变时保存进度
  useEffect(() => {
    if (hasRestoredProgress) {
      saveReadingProgress()
    }
  }, [selectedCharacter, selectedSetting, story, status, saveReadingProgress, hasRestoredProgress])

  // 页面关闭前保存进度
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveReadingProgress()
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        saveReadingProgress()
      }
    }
  }, [saveReadingProgress])

  const handleGenerate = async () => {
    if (!selectedCharacter || !selectedSetting) return

    setStatus('generating')
    setErrorMsg(null)

    try {
      const response = await fetch('/api/storyspark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character: selectedCharacter,
          setting: selectedSetting,
          words: testWords.map(w => ({ word: w.word, translation: w.translation })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate story')
      }

      const result = await response.json()
      setStory({
        title: result.title,
        content: result.content,
        quiz: result.quiz,
        isGenerated: true,
        timestamp: Date.now(),
      })
      setStatus('success')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || "Oops! We couldn't write the story right now. Please try again.")
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStory(null)
    setStatus('idle')
    setErrorMsg(null)
    // 清除保存的进度
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reading_progress')
    }
  }

  const handleBack = () => {
    // 返回时不清除进度，允许用户稍后继续
    onBack()
  }

  const isSelectionComplete = !!selectedCharacter && !!selectedSetting

  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-blue/20 via-candy-green/20 to-candy-orange/20 p-6 font-quicksand">
      {/* 顶部按钮 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleBack}
          className="bg-white/80 backdrop-blur-sm text-gray-700 px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <span>🏠</span>
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

      <div className="max-w-6xl mx-auto pt-16">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-candy-blue to-candy-green bg-clip-text text-transparent mb-2">
            📚 趣味阅读
          </h1>
          <p className="text-gray-600 text-lg">选择角色和场景，AI 会为你生成一个包含新学单词的精彩故事！</p>
        </motion.div>

        {status === 'success' && story ? (
          <StoryDisplay story={story} testWords={testWords} onReset={handleReset} />
        ) : (
          <div className="space-y-8">
            {/* 角色选择 */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-candy-blue text-white font-bold">1</span>
                <h2 className="text-2xl font-bold text-gray-800">选择角色</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {CHARACTERS.map((char) => (
                  <SelectionCard
                    key={char.id}
                    item={char}
                    isSelected={selectedCharacter?.id === char.id}
                    onSelect={setSelectedCharacter}
                  />
                ))}
              </div>
            </motion.section>

            {/* 场景选择 */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-candy-green text-white font-bold">2</span>
                <h2 className="text-2xl font-bold text-gray-800">选择场景</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {SETTINGS.map((setting) => (
                  <SelectionCard
                    key={setting.id}
                    item={setting}
                    isSelected={selectedSetting?.id === setting.id}
                    onSelect={setSelectedSetting}
                  />
                ))}
              </div>
            </motion.section>

            {/* 生成按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center pt-8"
            >
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-4 bg-red-100 border-2 border-red-300 text-red-700 rounded-2xl text-sm max-w-md"
                >
                  {errorMsg}
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: isSelectionComplete ? 1.05 : 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleGenerate}
                disabled={!isSelectionComplete || status === 'generating'}
                className={`
                  px-12 py-4 rounded-full font-bold text-xl shadow-xl transition-all duration-300
                  ${!isSelectionComplete
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-candy-blue to-candy-green text-white hover:shadow-2xl'
                  }
                `}
              >
                {status === 'generating' ? (
                  <div className="flex items-center space-x-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    <span>正在生成故事...</span>
                  </div>
                ) : (
                  <span>✨ 生成故事</span>
                )}
              </motion.button>

              {!isSelectionComplete && (
                <p className="mt-4 text-sm text-gray-500">
                  请先选择角色和场景
                </p>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

// SelectionCard 组件
function SelectionCard({ item, isSelected, onSelect }: {
  item: SelectionItem
  isSelected: boolean
  onSelect: (item: SelectionItem) => void
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(item)}
      className={`
        relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300
        ${isSelected
          ? 'ring-4 ring-candy-blue shadow-2xl'
          : 'hover:shadow-xl border-2 border-gray-200'
        }
        bg-white
      `}
    >
      <div className="aspect-square w-full overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className={`font-bold text-lg mb-1 ${isSelected ? 'text-candy-blue' : 'text-white'}`}>
          {item.name}
        </h3>
        <p className="text-xs text-white/90 line-clamp-2">
          {item.description}
        </p>
      </div>

      {isSelected && (
        <div className="absolute top-3 right-3 bg-candy-blue text-white rounded-full p-1.5 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </motion.div>
  )
}

// StoryDisplay 组件
function StoryDisplay({ 
  story, 
  testWords, 
  onReset 
}: { 
  story: StoryState
  testWords: Array<{ id: number; word: string; translation: string }>
  onReset: () => void 
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedWord, setSelectedWord] = useState<{ word: string; translation: string; x: number; y: number } | null>(null)

  // 创建单词到翻译的映射（支持多种形式）
  const wordMap = useRef(new Map<string, string>())
  
  // 创建单词到翻译的映射（支持多种形式）
  useEffect(() => {
    wordMap.current.clear()
    if (testWords && testWords.length > 0) {
      testWords.forEach(w => {
        const wordLower = w.word.toLowerCase().trim()
        if (wordLower.length > 0) {
          wordMap.current.set(wordLower, w.translation)
          // 支持常见的变化形式
          // 复数形式
          if (wordLower.endsWith('s')) {
            wordMap.current.set(wordLower.slice(0, -1), w.translation)
          } else if (!wordLower.endsWith('ss') && !wordLower.endsWith('us') && !wordLower.endsWith('is')) {
            wordMap.current.set(wordLower + 's', w.translation)
          }
          // 过去式（简单处理）
          if (wordLower.endsWith('ed')) {
            wordMap.current.set(wordLower.slice(0, -2), w.translation)
            wordMap.current.set(wordLower.slice(0, -1), w.translation)
          }
          // 进行时
          if (wordLower.endsWith('ing')) {
            wordMap.current.set(wordLower.slice(0, -3), w.translation)
            const base = wordLower.slice(0, -3)
            if (!base.endsWith('e')) {
              wordMap.current.set(base + 'e', w.translation)
            }
          }
        }
      })
    }
  }, [testWords])

  // 查询单词翻译（从数据库）
  const lookupWordTranslation = useCallback(async (word: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/word-lookup?word=${encodeURIComponent(word)}`)
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

  // 高亮并处理点击单词
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
      
      // 是单词，检查是否是新学单词
      const wordLower = part.text.toLowerCase().trim()
      const isNewWord = wordMap.current.has(wordLower)
      const translation = isNewWord ? wordMap.current.get(wordLower) : null
      
      return (
        <span
          key={`word-${index}-${part.text}`}
          onClick={async (e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            let finalTranslation = translation
            
            // 如果不是新学单词，尝试查询翻译
            if (!finalTranslation) {
              finalTranslation = await lookupWordTranslation(part.text)
            }
            
            // 计算弹窗位置，确保在视口内
            const x = Math.min(
              Math.max(rect.left + rect.width / 2, 150),
              window.innerWidth - 150
            )
            const y = Math.max(rect.top - 10, 50)
            
            setSelectedWord({
              word: part.text,
              translation: finalTranslation || '暂无翻译',
              x,
              y
            })
          }}
          className={`
            cursor-pointer rounded px-1 transition-colors inline-block
            ${isNewWord
              ? 'bg-yellow-200 hover:bg-yellow-300 font-semibold'
              : 'hover:bg-gray-100'
            }
          `}
          title={translation || '点击查看翻译'}
        >
          {part.text}
        </span>
      )
    })
  }, [lookupWordTranslation])

  const playAudio = useCallback(async () => {
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

    // 停止之前的播放（如果存在）
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }

    setIsLoading(true)
    setIsPlaying(false)

    try {
      // 构建完整的故事文本（标题 + 内容）
      const fullText = `${story.title}. ${story.content}`
      
      const response = await fetch(
        `/api/tts?text=${encodeURIComponent(fullText)}&lang=en`,
        { method: 'GET' }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('TTS API 错误:', response.status, errorText)
        throw new Error(`TTS failed: ${response.status}`)
      }

      let blob = await response.blob()
      if (blob.size === 0) {
        throw new Error('Empty audio blob')
      }

      // 验证并修复音频格式
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      const isValidMP3 = uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0 ||
                         (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33)
      
      if (!isValidMP3) {
        let mp3StartIndex = -1
        for (let i = 0; i < Math.min(100, uint8Array.length - 1); i++) {
          if (uint8Array[i] === 0xFF && (uint8Array[i + 1] & 0xE0) === 0xE0) {
            mp3StartIndex = i
            break
          }
        }
        if (mp3StartIndex > 0) {
          const trimmedBuffer = arrayBuffer.slice(mp3StartIndex)
          blob = new Blob([trimmedBuffer], { type: 'audio/mpeg' })
        }
      }
      
      let audioBlob = blob
      if (!blob.type || !blob.type.startsWith('audio/')) {
        audioBlob = new Blob([blob], { type: 'audio/mpeg' })
      }

      const url = URL.createObjectURL(audioBlob)
      const audio = new Audio(url)
      
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
  }, [story.title, story.content])

  // 清理函数
  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src)
      }
      audioRef.current = null
    }
    setIsPlaying(false)
    setIsLoading(false)
    onReset()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-candy-blue">
        {/* 头部操作 */}
        <div className="bg-gradient-to-r from-candy-blue/10 to-candy-green/10 p-4 flex justify-between items-center border-b-2 border-gray-200">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReset}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-candy-blue transition-colors font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>创建新故事</span>
          </motion.button>
        </div>

        {/* 故事内容 */}
        <div className="p-8 md:p-12 max-h-[85vh] overflow-y-auto">
          <div className="relative flex items-center justify-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-candy-blue to-candy-green bg-clip-text text-transparent">
              {story.title}
            </h2>
            {/* 朗读按钮 - 位于标题右侧 */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={playAudio}
              disabled={isLoading}
              className={`
                absolute right-0 flex items-center justify-center w-12 h-12 rounded-full transition-all shadow-lg
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
          <div className="prose prose-lg max-w-none">
            {story.content.split('\n').map((paragraph, idx) => {
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

          {/* 单词翻译弹窗 */}
          {selectedWord && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setSelectedWord(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                className="fixed z-50 bg-white rounded-xl shadow-2xl border-4 border-candy-blue p-4 min-w-[200px] max-w-xs"
                style={{
                  left: `${selectedWord.x}px`,
                  top: `${selectedWord.y}px`,
                  transform: 'translate(-50%, -100%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-candy-blue mb-2 break-words">
                    {selectedWord.word}
                  </p>
                  <p className="text-lg text-gray-700 break-words">
                    {selectedWord.translation}
                  </p>
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                  <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-candy-blue" />
                </div>
              </motion.div>
            </>
          )}

          <div className="mt-8 text-center mb-4">
            <p className="text-sm text-gray-500 italic">
              由 AI 生成 • {new Date(story.timestamp).toLocaleDateString('zh-CN')}
            </p>
          </div>

          {/* 测验模块 */}
          {story.quiz && story.quiz.length > 0 && (
            <QuizModule questions={story.quiz} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// QuizModule 组件
function QuizModule({ questions }: { questions: QuizQuestion[] }) {
  const [userAnswers, setUserAnswers] = useState<number[]>(new Array(questions.length).fill(-1))
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    if (isSubmitted) return
    const newAnswers = [...userAnswers]
    newAnswers[questionIndex] = optionIndex
    setUserAnswers(newAnswers)
  }

  const calculateScore = () => {
    return userAnswers.reduce((score, answer, index) => {
      return answer === questions[index].correctAnswerIndex ? score + 1 : score
    }, 0)
  }

  const handleSubmit = () => {
    if (userAnswers.includes(-1)) {
      alert('请回答所有问题后再提交！')
      return
    }
    setIsSubmitted(true)
  }

  const getOptionStyle = (qIndex: number, optIndex: number) => {
    const isSelected = userAnswers[qIndex] === optIndex
    const isCorrect = questions[qIndex].correctAnswerIndex === optIndex

    if (!isSubmitted) {
      return isSelected
        ? 'bg-candy-blue/20 border-2 border-candy-blue text-candy-blue shadow-md'
        : 'bg-gray-50 border-2 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-candy-blue/50'
    }

    if (isCorrect) {
      return 'bg-green-100 border-2 border-green-500 text-green-700'
    }
    if (isSelected && !isCorrect) {
      return 'bg-red-100 border-2 border-red-500 text-red-700'
    }
    return 'bg-gray-50 border-2 border-gray-200 text-gray-400'
  }

  const score = calculateScore()

  return (
    <div className="mt-12 pt-12 border-t-2 border-gray-200">
      <div className="mb-8 text-center">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">🧠 阅读理解测验</h3>
        <p className="text-gray-600">测试一下你对故事的理解程度！</p>
      </div>

      <div className="space-y-6">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-200">
            <p className="text-lg font-semibold text-gray-800 mb-4">
              <span className="text-candy-blue font-bold mr-2">{qIndex + 1}.</span>
              {q.question}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {q.options.map((option, optIndex) => (
                <motion.button
                  key={optIndex}
                  whileHover={!isSubmitted ? { scale: 1.02 } : {}}
                  whileTap={!isSubmitted ? { scale: 0.98 } : {}}
                  onClick={() => handleOptionSelect(qIndex, optIndex)}
                  disabled={isSubmitted}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium
                    ${getOptionStyle(qIndex, optIndex)}
                  `}
                >
                  <div className="flex items-center">
                    <span className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs mr-3 flex-shrink-0 font-bold
                      ${isSubmitted && questions[qIndex].correctAnswerIndex === optIndex ? 'border-green-500 bg-green-500 text-white' : ''}
                      ${isSubmitted && userAnswers[qIndex] === optIndex && questions[qIndex].correctAnswerIndex !== optIndex ? 'border-red-500 bg-red-500 text-white' : ''}
                      ${!isSubmitted && userAnswers[qIndex] === optIndex ? 'border-candy-blue bg-candy-blue text-white' : 'border-gray-300 bg-white'}
                    `}>
                      {String.fromCharCode(65 + optIndex)}
                    </span>
                    {option}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        {!isSubmitted ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            className="px-8 py-3 bg-gradient-to-r from-candy-blue to-candy-green text-white font-bold rounded-full text-lg shadow-xl hover:shadow-2xl transition-all"
          >
            提交答案
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-6 bg-gradient-to-r from-candy-blue/10 to-candy-green/10 rounded-2xl border-2 border-candy-blue"
          >
            <p className="text-3xl font-bold text-gray-800 mb-2">
              得分：{score} / {questions.length}
            </p>
            <p className="text-candy-blue font-semibold">
              {score === questions.length ? '🌟 满分！太棒了！' :
               score > questions.length / 2 ? '👍 很好！继续加油！' :
               '📚 不错！再读一遍故事会更好！'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
