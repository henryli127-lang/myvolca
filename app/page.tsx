'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Word {
  id: number
  word: string
  translation: string
  mnemonic?: string
}

export default function Home() {
  const [word, setWord] = useState<Word | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchRandomWord = async () => {
    try {
      setLoading(true)
      setIsFlipped(false)
      
      // 获取所有单词
      const { data, error } = await supabase
        .from('words')
        .select('*')

      if (error) throw error

      if (data && data.length > 0) {
        // 随机选择一个单词
        const randomIndex = Math.floor(Math.random() * data.length)
        setWord(data[randomIndex])
      }
    } catch (error) {
      console.error('获取单词失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRandomWord()
  }, [])

  const handleCardClick = () => {
    setIsFlipped(!isFlipped)
  }

  const handleNextWord = () => {
    fetchRandomWord()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-bold text-purple-600 animate-pulse">
          加载中...
        </div>
      </div>
    )
  }

  if (!word) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-bold text-red-500">
          暂无单词数据
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8 text-purple-700 drop-shadow-lg">
          🎓 单词学习卡片
        </h1>
        
        <div className="relative perspective-1000">
          <div
            className={`relative w-full h-80 transition-transform duration-700 transform-style-preserve-3d cursor-pointer ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            onClick={handleCardClick}
          >
            {/* 正面 - 单词 */}
            <div className="absolute inset-0 backface-hidden rounded-3xl bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 shadow-2xl flex flex-col items-center justify-center p-8 border-4 border-white">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-5xl font-bold text-white drop-shadow-lg text-center">
                {word.word}
              </h2>
              <p className="text-white/80 text-lg mt-4">点击卡片查看翻译</p>
            </div>

            {/* 背面 - 翻译和记忆技巧 */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400 shadow-2xl flex flex-col items-center justify-center p-8 border-4 border-white">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-4xl font-bold text-white drop-shadow-lg text-center mb-6">
                {word.translation}
              </h3>
              {word.mnemonic && (
                <div className="bg-white/30 rounded-2xl p-4 backdrop-blur-sm">
                  <p className="text-white font-semibold text-lg text-center">
                    💡 {word.mnemonic}
                  </p>
                </div>
              )}
              <p className="text-white/80 text-lg mt-4">点击卡片返回</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleNextWord}
          className="w-full mt-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-xl"
        >
          下一个单词 🎲
        </button>
      </div>
    </div>
  )
}

