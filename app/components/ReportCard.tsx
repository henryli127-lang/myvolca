'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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

  const translationAccuracy = results.translationTotal > 0
    ? Math.round((results.translationCorrect / results.translationTotal) * 100)
    : 0
  const spellingAccuracy = results.spellingTotal > 0
    ? Math.round((results.spellingCorrect / results.spellingTotal) * 100)
    : 0
  // Calculate average, can exceed 100% based on user request/logic (bonus points?) 
  // For now simple average
  const overallAccuracy = Math.round((translationAccuracy + spellingAccuracy) / 2)

  useEffect(() => {
    // Fire confetti effect
    if (overallAccuracy >= 80) {
      import('canvas-confetti').then((confetti) => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti.default(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
          confetti.default(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
      })
    }
  }, [overallAccuracy])

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-100 via-blue-100 to-green-100 p-6 font-quicksand relative overflow-hidden flex items-center justify-center">

      {/* Background Decorations (Stars & Confetti) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Left Cluster */}
        <div className="absolute top-10 left-10 text-4xl animate-bounce" style={{ animationDuration: '3s' }}>⭐</div>
        <div className="absolute top-20 left-32 text-2xl text-yellow-400 rotate-12">✦</div>
        <div className="absolute top-40 left-10 text-3xl text-blue-400 -rotate-12">🌀</div>

        {/* Top Right Cluster */}
        <div className="absolute top-12 right-20 text-4xl animate-pulse">☁️</div>
        <div className="absolute top-24 right-10 text-2xl text-pink-400 rotate-45">✨</div>

        {/* Bottom Sides */}
        <div className="absolute bottom-20 left-16 text-3xl text-purple-400 rotate-12">🎉</div>
        <div className="absolute bottom-32 right-24 text-4xl text-yellow-400 -rotate-6">⭐</div>
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.8, bounce: 0.4 }}
        className="bg-white rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-8 md:p-12 max-w-2xl w-full border-4 border-white/50 backdrop-blur-sm relative z-10"
      >
        {/* Header Title */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-2">
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-5xl"
            >
              🏆
            </motion.span>
            <h1 className="text-4xl md:text-5xl font-black text-gray-800 tracking-tight">
              Awesome Job!
            </h1>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-5xl"
            >
              🌟
            </motion.span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
            You're a Star Explorer!
          </h2>
        </div>

        {/* Overall Score */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="text-8xl md:text-9xl font-black text-[#38bdf8] drop-shadow-sm font-bubblegum"
          >
            {overallAccuracy}%
          </motion.div>
          <p className="text-gray-900 font-bold text-lg mt-2">Overall Accuracy</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Translation Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-[#dbeafe] border-2 border-[#93c5fd] rounded-3xl p-6 text-center shadow-sm"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">✏️</span>
              <h3 className="font-bold text-gray-800 text-lg">Translation Test</h3>
            </div>
            <div className="text-6xl font-black text-gray-900 mb-2">
              {translationAccuracy}%
            </div>
            <div className="flex justify-center gap-4 text-sm font-bold">
              <span className="text-gray-600">Correct: {results.translationCorrect} / {results.translationTotal}</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">Incorrect: {results.translationErrors}</span>
            </div>
          </motion.div>

          {/* Spelling Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-[#dcfce7] border-2 border-[#86efac] rounded-3xl p-6 text-center shadow-sm"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">🔡</span>
              <h3 className="font-bold text-gray-800 text-lg">Spelling Test</h3>
            </div>
            <div className="text-6xl font-black text-gray-900 mb-2">
              {spellingAccuracy}%
            </div>
            <div className="flex justify-center gap-4 text-sm font-bold">
              <span className="text-gray-600">Correct: {results.spellingCorrect} / {results.spellingTotal}</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">Incorrect: {results.spellingErrors}</span>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const event = new CustomEvent('openStorySpark', { detail: { testWords } })
              window.dispatchEvent(event)
            }}
            className="bg-[#fb7185] hover:bg-[#f43f5e] text-white font-black py-4 px-8 rounded-full shadow-[0_4px_0_rgb(190,18,60)] hover:shadow-[0_2px_0_rgb(190,18,60)] hover:translate-y-[2px] transition-all text-xl flex items-center justify-center gap-2 min-w-[200px]"
          >
            <span>📖</span> Fun Reading
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="bg-[#22d3ee] hover:bg-[#06b6d4] text-white font-black py-4 px-8 rounded-full shadow-[0_4px_0_rgb(8,145,178)] hover:shadow-[0_2px_0_rgb(8,145,178)] hover:translate-y-[2px] transition-all text-xl flex items-center justify-center gap-2 min-w-[200px]"
          >
            <span>🏠</span> Back to Home
          </motion.button>
        </div>

      </motion.div>
    </div>
  )
}
