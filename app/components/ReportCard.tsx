'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { userProgress } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface ReportCardProps {
  user: User
  results: {
    translationCorrect: number
    translationTotal: number
    spellingCorrect: number
    spellingTotal: number
    translationErrors: number
    spellingErrors: number
  }
  testWords: Array<{ 
    id: number
    word: string
    translation: string
    translationError?: boolean
    spellingError?: boolean
  }>
  onBack: () => void
  onLogout: () => void
}

export default function ReportCard({ user, results, testWords, onBack, onLogout }: ReportCardProps) {
  const [medal, setMedal] = useState<string>('')
  const [saving, setSaving] = useState(true)


  const translationAccuracy = results.translationTotal > 0 
    ? Math.round((results.translationCorrect / results.translationTotal) * 100) 
    : 0
  const spellingAccuracy = results.spellingTotal > 0 
    ? Math.round((results.spellingCorrect / results.spellingTotal) * 100) 
    : 0
  const overallAccuracy = Math.round((translationAccuracy + spellingAccuracy) / 2)

  useEffect(() => {
    // 只显示奖牌和触发动画，不保存数据（数据已在 page.tsx 中后台保存）
    const showMedal = () => {
      try {
        // 触发五彩纸屑（动态导入以避免 SSR 问题）
        if (overallAccuracy === 100) {
          setMedal('Kiwi Master 🏆')
          import('canvas-confetti').then((confetti) => {
            confetti.default({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            })
          })
        } else if (overallAccuracy >= 80) {
          setMedal('Explorer ⭐')
          import('canvas-confetti').then((confetti) => {
            confetti.default({
              particleCount: 50,
              spread: 50,
              origin: { y: 0.6 }
            })
          })
        }
        setSaving(false)
      } catch (error) {
        console.error('显示奖牌失败:', error)
        setSaving(false)
      }
    }

    // 立即显示，不等待
    showMedal()
  }, [overallAccuracy]) // 只依赖 overallAccuracy，避免重复执行

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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-candy-blue"
        >
          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-gray-800 mb-4">
              📊 测试成绩单
            </h1>
            {medal && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-4xl font-bold text-candy-orange mb-2"
              >
                {medal}
              </motion.div>
            )}
          </div>

          {/* 总体准确率 */}
          <div className="text-center mb-8">
            <div className="text-8xl font-bold text-candy-blue mb-2">
              {overallAccuracy}%
            </div>
            <p className="text-xl text-gray-600">总体准确率</p>
          </div>

          {/* 详细统计 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* 翻译测试 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-candy-blue/20 to-candy-green/20 rounded-2xl p-6 border-2 border-candy-blue"
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-4">📝 翻译测试</h3>
              <div className="text-4xl font-bold text-candy-blue mb-2">
                {translationAccuracy}%
              </div>
              <p className="text-gray-600">
                正确: {results.translationCorrect} / {results.translationTotal}
              </p>
              <p className="text-red-600 text-sm mt-2">
                错误: {results.translationErrors}
              </p>
            </motion.div>

            {/* 拼写测试 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-candy-green/20 to-candy-orange/20 rounded-2xl p-6 border-2 border-candy-green"
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-4">✍️ 拼写测试</h3>
              <div className="text-4xl font-bold text-candy-green mb-2">
                {spellingAccuracy}%
              </div>
              <p className="text-gray-600">
                正确: {results.spellingCorrect} / {results.spellingTotal}
              </p>
              <p className="text-red-600 text-sm mt-2">
                错误: {results.spellingErrors}
              </p>
            </motion.div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // 通过自定义事件传递 testWords 数据
                const event = new CustomEvent('openStorySpark', { detail: { testWords } })
                window.dispatchEvent(event)
              }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform transition-all text-lg"
            >
              📚 趣味阅读
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="bg-gradient-to-r from-candy-blue to-candy-green text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:shadow-2xl transform transition-all text-lg"
            >
              🏠 返回首页
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

