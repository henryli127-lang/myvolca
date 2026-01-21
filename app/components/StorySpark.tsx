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
  userId?: string
  onBack: () => void
  onLogout: () => void
  onSaveArticle?: (article: {
    title: string
    content: string
    htmlContent: string
    imageUrl?: string
    quiz?: any
    character?: any
    setting?: any
  }) => Promise<void>
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

// 生成HTML内容
function generateHtmlContent(title: string, content: string, quiz: QuizQuestion[], imageUrl?: string): string {
  const quizHtml = quiz.length > 0 ? `
    <div class="quiz-section">
      <h3>🧠 阅读理解测验</h3>
      ${quiz.map((q, index) => `
        <div class="quiz-question">
          <p><strong>${index + 1}. ${q.question}</strong></p>
          <ul>
            ${q.options.map((opt, optIndex) => `
              <li>${String.fromCharCode(65 + optIndex)}. ${opt}${optIndex === q.correctAnswerIndex ? ' ✓' : ''}</li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  ` : ''

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.8;
          color: #333;
        }
        h1 {
          color: #54a0ff;
          text-align: center;
          margin-bottom: 20px;
        }
        img {
          width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 20px 0;
        }
        .content {
          font-size: 18px;
          line-height: 1.8;
          margin: 20px 0;
        }
        .quiz-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #ddd;
        }
        .quiz-question {
          margin: 20px 0;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        ul {
          list-style: none;
          padding-left: 0;
        }
        li {
          padding: 5px 0;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${imageUrl ? `<img src="${imageUrl}" alt="${title}" />` : ''}
      <div class="content">
        ${content.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}
      </div>
      ${quizHtml}
    </body>
    </html>
  `
}

export default function StorySpark({ testWords, userId, onBack, onLogout, onSaveArticle }: StorySparkProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<SelectionItem | null>(null)
  const [selectedSetting, setSelectedSetting] = useState<SelectionItem | null>(null)
  const [story, setStory] = useState<StoryState | null>(null)
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false)

  // 保存阅读状态到 localStorage
  const saveReadingProgress = useCallback((clearProgress = false, quizCompleted = false) => {
    if (typeof window === 'undefined') return

    try {
      if (clearProgress) {
        // 清除阅读进度（quiz完成后）
        localStorage.removeItem('reading_progress')
        console.log('已清除阅读进度（quiz已完成）')
      } else {
        const progress = {
          selectedCharacter,
          selectedSetting,
          story,
          status,
          testWords,
          quizCompleted, // 记录quiz是否已完成
          timestamp: Date.now()
        }
        localStorage.setItem('reading_progress', JSON.stringify(progress))
      }
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
          // 优先检查：如果有story且quiz未完成，直接恢复（不需要testWords匹配）
          if (parsed.story && !parsed.quizCompleted) {
            console.log('检测到未完成的story，直接恢复...')
            if (parsed.selectedCharacter) {
              setSelectedCharacter(parsed.selectedCharacter)
            }
            if (parsed.selectedSetting) {
              setSelectedSetting(parsed.selectedSetting)
            }
            setStory(parsed.story)
            setStatus('success') // 确保显示文章
            console.log('已恢复未完成的story', {
              hasCharacter: !!parsed.selectedCharacter,
              hasSetting: !!parsed.selectedSetting,
              hasStory: !!parsed.story,
              quizCompleted: parsed.quizCompleted
            })
            // 恢复后直接返回，不继续检查其他条件
            return
          }
          // 情况2：只有selectedCharacter但没有story → 恢复角色选择状态
          else if (parsed.selectedCharacter && !parsed.story) {
            console.log('检测到角色选择但未生成story，恢复角色选择状态...')
            setSelectedCharacter(parsed.selectedCharacter)
            if (parsed.selectedSetting) {
              setSelectedSetting(parsed.selectedSetting)
            }
            // 保持status为'idle'，显示角色选择界面
            setStatus('idle')
            console.log('已恢复角色选择状态')
            // 恢复后直接返回，不继续检查其他条件
            return
          }
          // 验证 testWords 是否匹配（允许部分匹配）
          else if (parsed.testWords && Array.isArray(parsed.testWords) && parsed.testWords.length > 0) {
            // 检查是否有重叠的单词
            const savedWords = new Set<string>(parsed.testWords.map((w: any) => (w.word?.toLowerCase() || '').toString()))
            const currentWords = new Set<string>(testWords.map(w => w.word.toLowerCase()))
            const hasOverlap = Array.from(savedWords).some((w: string) => currentWords.has(w))

            if (hasOverlap || parsed.testWords.length === testWords.length) {
              // 恢复状态，即使 testWords 不完全匹配，只要有关键数据就恢复
              if (parsed.selectedCharacter) {
                setSelectedCharacter(parsed.selectedCharacter)
              }
              if (parsed.selectedSetting) {
                setSelectedSetting(parsed.selectedSetting)
              }
              if (parsed.story) {
                setStory(parsed.story)
                // 如果story存在且quiz未完成，确保status是'success'以显示文章
                if (!parsed.quizCompleted && parsed.story) {
                  setStatus('success')
                } else if (parsed.status) {
                  setStatus(parsed.status)
                }
              } else if (parsed.status) {
                setStatus(parsed.status)
              }

              console.log('已恢复阅读进度', {
                hasCharacter: !!parsed.selectedCharacter,
                hasSetting: !!parsed.selectedSetting,
                hasStory: !!parsed.story,
                status: parsed.status,
                quizCompleted: parsed.quizCompleted
              })
            } else {
              // testWords 不匹配，清除旧进度
              console.log('testWords不匹配，清除旧进度')
              localStorage.removeItem('reading_progress')
            }
          } else {
            // 没有 testWords 且没有其他有效状态，清除旧进度
            console.log('没有testWords且没有其他有效状态，清除旧进度')
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

  // 当状态改变时保存进度（标记quiz未完成，除非明确完成）
  useEffect(() => {
    if (hasRestoredProgress) {
      // 如果story存在，保存进度时标记quizCompleted为false（默认未完成）
      // 只有在quiz明确完成时才会清除进度
      const quizCompleted = false // 默认未完成，只有在明确完成时才清除
      saveReadingProgress(false, quizCompleted)
      console.log('保存阅读进度', {
        hasStory: !!story,
        status,
        quizCompleted
      })
    }
  }, [selectedCharacter, selectedSetting, story, status, saveReadingProgress, hasRestoredProgress])

  // 页面关闭前保存进度（标记quiz未完成）
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveReadingProgress(false, false) // 保存进度，标记quiz未完成
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

      // 生成故事图片
      let imageUrl: string | undefined
      let imageData: string | undefined
      let imageMimeType: string | undefined

      try {
        const imageResponse = await fetch('/api/story-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: result.title,
            content: result.content,
            character: selectedCharacter,
            setting: selectedSetting,
          }),
        })

        if (imageResponse.ok) {
          const imageResult = await imageResponse.json()
          console.log('图片生成结果:', { hasImageUrl: !!imageResult.imageUrl, hasImageData: !!imageResult.imageData })
          if (imageResult.imageUrl) {
            // 如果已经有URL，直接使用
            imageUrl = imageResult.imageUrl
            console.log('使用已有的imageUrl:', imageUrl)
          } else if (imageResult.imageData) {
            // 如果有base64数据，先使用base64显示，然后异步上传OSS
            imageData = imageResult.imageData
            imageMimeType = imageResult.mimeType || 'image/png'

            // 异步上传base64图片到OSS（不阻塞UI）
            // 先显示故事，然后后台上传
            console.log('开始异步上传图片到OSS...')
              ; (async () => {
                try {
                  // 将base64转换为Blob
                  const byteCharacters = atob(imageResult.imageData)
                  const byteNumbers = new Array(byteCharacters.length)
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                  }
                  const byteArray = new Uint8Array(byteNumbers)
                  const blob = new Blob([byteArray], { type: imageResult.mimeType || 'image/png' })
                  console.log('Blob创建成功，大小:', blob.size)

                  // 创建FormData上传到OSS
                  const formData = new FormData()
                  formData.append('file', blob, `story-${Date.now()}.png`)

                  // 异步上传OSS（不阻塞）
                  console.log('发送OSS上传请求...')
                  const uploadResponse = await fetch('/api/upload-oss', {
                    method: 'POST',
                    body: formData,
                  })
                  console.log('OSS上传响应状态:', uploadResponse.status, uploadResponse.ok)

                  if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json()
                    const ossUrl = uploadResult.url
                    console.log('图片已成功上传到OSS:', ossUrl)

                    // 上传成功后，更新story状态，使用OSS URL替换base64
                    setStory(prevStory => {
                      if (prevStory) {
                        return {
                          ...prevStory,
                          imageUrl: ossUrl,
                          imageData: undefined, // 清空base64数据
                          imageMimeType: undefined,
                        }
                      }
                      return prevStory
                    })

                    // OSS上传成功后，保存文章到图书馆（此时imageUrl已确定）
                    if (onSaveArticle) {
                      const htmlContent = generateHtmlContent(result.title, result.content, result.quiz || [], ossUrl)
                      onSaveArticle({
                        title: result.title,
                        content: result.content,
                        htmlContent,
                        imageUrl: ossUrl, // 使用OSS URL
                        quiz: result.quiz,
                        character: selectedCharacter,
                        setting: selectedSetting,
                      }).then(() => {
                        console.log('文章已保存到图书馆，图片URL:', ossUrl)
                      }).catch((err) => {
                        console.error('保存文章到图书馆失败:', err)
                      })
                    }
                  } else {
                    const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }))
                    console.error('上传图片到OSS失败:', errorData)
                    // 上传失败时，仍然保存文章（没有图片URL）
                    if (onSaveArticle) {
                      console.log('OSS上传失败，保存文章（无图片URL）')
                      const htmlContent = generateHtmlContent(result.title, result.content, result.quiz || [], undefined)
                      onSaveArticle({
                        title: result.title,
                        content: result.content,
                        htmlContent,
                        imageUrl: undefined, // OSS上传失败，没有URL
                        quiz: result.quiz,
                        character: selectedCharacter,
                        setting: selectedSetting,
                      }).then(() => {
                        console.log('文章已保存到图书馆（OSS上传失败，无图片URL）')
                      }).catch((err) => {
                        console.error('保存文章到图书馆失败:', err)
                      })
                    }
                  }
                } catch (uploadError) {
                  console.error('上传图片到OSS异常:', uploadError)
                  // 上传异常时，仍然保存文章（没有图片URL）
                  if (onSaveArticle) {
                    const htmlContent = generateHtmlContent(result.title, result.content, result.quiz || [], undefined)
                    onSaveArticle({
                      title: result.title,
                      content: result.content,
                      htmlContent,
                      imageUrl: undefined, // OSS上传异常，没有URL
                      quiz: result.quiz,
                      character: selectedCharacter,
                      setting: selectedSetting,
                    }).then(() => {
                      console.log('文章已保存到图书馆（OSS上传异常，无图片URL）')
                    }).catch((err) => {
                      console.error('保存文章到图书馆失败:', err)
                    })
                  }
                }
              })()
          }
        }
      } catch (imageError) {
        console.error('生成图片失败，继续显示故事:', imageError)
        // 图片生成失败不影响故事显示
      }

      // 无论图片生成成功与否，都要保存文章
      // 如果图片生成失败，保存时imageUrl为undefined
      // 如果图片生成成功但OSS上传失败，也会在失败回调中保存
      // 如果图片生成成功且OSS上传成功，会在上传成功回调中保存
      // 但为了确保文章一定会被保存，我们在这里也添加一个兜底保存逻辑

      // 先显示故事（使用base64图片，如果存在）
      setStory({
        title: result.title,
        content: result.content,
        quiz: result.quiz,
        isGenerated: true,
        timestamp: Date.now(),
        imageUrl, // 如果有URL就用URL，否则用base64
        imageData, // base64数据，用于立即显示
        imageMimeType,
      })
      setStatus('success')

      // 保存文章到图书馆的逻辑
      // 策略：等待OSS上传完成后再保存，确保imageUrl正确
      const saveArticleToLibrary = async (finalImageUrl?: string) => {
        if (!onSaveArticle) {
          console.warn('⚠️ onSaveArticle未定义，无法保存文章')
          return
        }

        const htmlContent = generateHtmlContent(result.title, result.content, result.quiz || [], finalImageUrl)

        try {
          console.log('开始保存文章到图书馆，imageUrl:', finalImageUrl || '无')
          await onSaveArticle({
            title: result.title,
            content: result.content,
            htmlContent,
            imageUrl: finalImageUrl, // 使用最终的OSS URL
            quiz: result.quiz,
            character: selectedCharacter,
            setting: selectedSetting,
          })
          console.log('✅ 文章已保存到图书馆，图片URL:', finalImageUrl || '无图片')
        } catch (err) {
          console.error('❌ 保存文章到图书馆失败:', err)
          // 保存失败不影响故事显示
        }
      }

      // 保存文章到图书馆的逻辑
      // 如果已经有imageUrl（直接返回的URL），立即保存
      if (imageUrl) {
        saveArticleToLibrary(imageUrl)
      } else if (imageData) {
        // 如果有base64数据，等待OSS上传完成后再保存
        // 上传逻辑在异步函数中，上传成功后会调用onSaveArticle
        // 如果OSS上传失败，也要保存文章（使用base64或没有图片）
        console.log('等待OSS上传完成后再保存文章...')

        // 设置超时，如果OSS上传超时（30秒），仍然保存文章（可能没有图片URL）
        setTimeout(async () => {
          // 检查是否已经保存过（通过检查story状态）
          // 如果OSS上传成功，应该已经保存了
          // 如果超时，说明OSS上传可能失败，仍然保存文章
          if (onSaveArticle) {
            console.log('OSS上传超时，保存文章（可能没有图片URL）')
            const htmlContent = generateHtmlContent(result.title, result.content, result.quiz || [], undefined)
            try {
              await onSaveArticle({
                title: result.title,
                content: result.content,
                htmlContent,
                imageUrl: undefined, // OSS上传失败，没有URL
                quiz: result.quiz,
                character: selectedCharacter,
                setting: selectedSetting,
              })
              console.log('文章已保存到图书馆（无图片URL）')
            } catch (err) {
              console.error('保存文章到图书馆失败:', err)
            }
          }
        }, 30000) // 30秒超时
      } else {
        // 没有图片，直接保存
        saveArticleToLibrary()
      }
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
    <div className="min-h-screen bg-gradient-to-br from-kawaii-pink/30 via-kawaii-lavender/40 to-kawaii-sky/30 p-4 md:p-6 font-quicksand relative overflow-hidden">
      {/* ===== 背景装饰层 ===== */}
      <div className="absolute top-0 left-0 w-80 h-80 blob-pink rounded-full blur-3xl -translate-x-1/3 -translate-y-1/4 animate-blob" />
      <div className="absolute top-1/4 right-0 w-96 h-96 blob-purple rounded-full blur-3xl translate-x-1/3 animate-blob" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 blob-blue rounded-full blur-3xl translate-y-1/3 animate-blob" style={{ animationDelay: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 blob-orange rounded-full blur-3xl animate-blob" style={{ animationDelay: '6s' }} />

      {/* 顶部按钮 */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleBack}
          className="bg-white/60 backdrop-blur-md text-gray-700 px-4 py-2 rounded-xl shadow-sm border border-white/50 hover:bg-white/80 transition-all flex items-center gap-2 font-bold"
        >
          <span>🏠</span>
          <span>Back</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLogout}
          className="exit-btn px-4 py-2 rounded-xl text-gray-700 font-bold flex items-center gap-2"
        >
          <span>🚪</span>
          <span>Exit</span>
        </motion.button>
      </div>

      <div className="max-w-6xl mx-auto pt-16 relative z-10">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-block relative">
            <h1 className="text-5xl md:text-6xl font-black text-[#38bdf8] font-bubblegum drop-shadow-sm filter" style={{ textShadow: '3px 3px 0px #fff, 5px 5px 0px rgba(0,0,0,0.1)' }}>
              ✨ Fun Reading ✨
            </h1>
          </div>
          <p className="text-gray-600 text-lg mt-4 font-medium bg-white/30 inline-block px-6 py-2 rounded-full backdrop-blur-sm border border-white/40">
            Pick a character & setting, and let's make a magic story! 🧚‍♀️
          </p>
        </motion.div>

        {status === 'success' && story ? (
          <StoryDisplay
            story={story}
            testWords={testWords}
            onReset={handleReset}
            onQuizComplete={() => saveReadingProgress(true, true)} // Quiz完成后清除阅读进度
          />
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
                  kawaii-btn w-full md:w-auto px-12 py-4 text-xl flex items-center justify-center gap-3
                  ${!isSelectionComplete
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'kawaii-btn-green'
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
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(item)}
      className={`
        relative cursor-pointer rounded-3xl overflow-hidden transition-all duration-300
        ${isSelected
          ? 'rainbow-card border-4 border-white shadow-[0_20px_40px_-5px_rgba(56,189,248,0.4)]'
          : 'bg-white border-2 border-transparent hover:border-sky-200 shadow-md hover:shadow-xl'
        }
      `}
    >
      <div className="aspect-square w-full overflow-hidden p-3 bg-white">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover rounded-2xl"
          loading="lazy"
        />
        {/* 选中时的光效遮罩 */}
        {isSelected && (
          <div className="absolute inset-0 bg-gradient-to-t from-sky-400/30 to-transparent pointer-events-none" />
        )}
      </div>

      <div className={`p-4 text-center ${isSelected ? 'text-white' : 'text-gray-700'}`}>
        <h3 className="font-bold text-xl mb-1 font-bubblegum tracking-wide">
          {item.name}
        </h3>
        <p className={`text-xs font-medium ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
          {item.description}
        </p>
      </div>

      {isSelected && (
        <div className="absolute top-4 right-4 bg-white text-sky-500 rounded-full p-1 shadow-lg animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
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
  onReset,
  onQuizComplete
}: {
  story: StoryState
  testWords: Array<{ id: number; word: string; translation: string }>
  onReset: () => void
  onQuizComplete?: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0) // 播放速度，默认1.0（正常速度）
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
      <div className="glass-card rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-white/50 relative">
        {/* 顶部操作 */}
        <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 p-4 flex justify-between items-center border-b border-white/30 backdrop-blur-sm">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReset}
            className="flex items-center space-x-2 text-sm text-gray-500 hover:text-blue-500 transition-colors font-bold px-3 py-1 rounded-full hover:bg-white/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Create New Story</span>
          </motion.button>
        </div>

        {/* 故事内容 */}
        <div className="p-8 md:p-12 max-h-[85vh] overflow-y-auto custom-scrollbar">
          <div className="relative flex items-center justify-center mb-10">
            <h2 className="text-4xl md:text-5xl font-black text-center bubble-text tracking-wide text-[#38bdf8]" style={{ textShadow: '2px 2px 0 #fff' }}>
              {story.title}
            </h2>
            {/* 播放速度控制和朗读按钮 - 位于标题右侧 */}
            <div className="absolute right-0 flex items-center gap-2">
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
          </div>

          {/* 故事图片 */}
          {(story.imageUrl || story.imageData) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 w-full"
            >
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                {story.imageUrl ? (
                  <img
                    src={story.imageUrl}
                    alt={story.title}
                    className="w-full h-full object-cover rounded-2xl shadow-lg"
                    loading="lazy"
                  />
                ) : story.imageData ? (
                  <img
                    src={`data:${story.imageMimeType || 'image/png'};base64,${story.imageData}`}
                    alt={story.title}
                    className="w-full h-full object-cover rounded-2xl shadow-lg"
                    loading="lazy"
                  />
                ) : null}
              </div>
            </motion.div>
          )}

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
            <QuizModule questions={story.quiz} onQuizComplete={onQuizComplete} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// QuizModule 组件
function QuizModule({ questions, onQuizComplete }: { questions: QuizQuestion[], onQuizComplete?: () => void }) {
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
    // Quiz完成后，通知父组件清除阅读进度
    if (onQuizComplete) {
      // 延迟一下，让用户看到分数
      setTimeout(() => {
        onQuizComplete()
      }, 2000) // 2秒后清除进度
    }
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
    <div className="mt-12 pt-12 border-t-2 border-dashed border-gray-200">
      <div className="mb-8 text-center">
        <h3 className="text-2xl font-bold text-gray-800 mb-2 font-bubblegum">🧠 Story Quiz</h3>
        <p className="text-gray-500 font-medium">Test how much you understood!</p>
      </div>

      <div className="space-y-6">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white/60 p-6 rounded-2xl border-2 border-white shadow-sm">
            <p className="text-lg font-bold text-gray-800 mb-4 flex items-start gap-3">
              <span className="bg-blue-100 text-blue-500 rounded-lg w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm">{qIndex + 1}</span>
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
                    w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 font-bold text-md
                    ${getOptionStyle(qIndex, optIndex)}
                  `}
                >
                  <div className="flex items-center">
                    <span className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs mr-3 flex-shrink-0
                      ${isSubmitted && questions[qIndex].correctAnswerIndex === optIndex ? 'border-green-500 bg-green-500 text-white' : ''}
                      ${isSubmitted && userAnswers[qIndex] === optIndex && questions[qIndex].correctAnswerIndex !== optIndex ? 'border-red-500 bg-red-500 text-white' : ''}
                      ${!isSubmitted && userAnswers[qIndex] === optIndex ? 'border-candy-blue bg-candy-blue text-white' : 'border-gray-200 bg-white text-gray-400'}
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

      <div className="mt-10 flex justify-center">
        {!isSubmitted ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            className="kawaii-btn kawaii-btn-green px-10 py-3 text-lg"
          >
            Submit Answer ✨
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl border-2 border-yellow-200 shadow-lg"
          >
            <div className="text-5xl mb-4">
              {score === questions.length ? '🏆' : score > questions.length / 2 ? '👍' : '📚'}
            </div>
            <p className="text-3xl font-black text-gray-800 mb-2 font-bubblegum">
              Score: <span className="text-candy-blue">{score}</span> / {questions.length}
            </p>
            <p className="text-gray-600 font-medium">
              {score === questions.length ? 'Perfect! You are a reading master!' :
                score > questions.length / 2 ? 'Great job! Keep reading!' :
                  'Nice try! Read again to improve!'}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
