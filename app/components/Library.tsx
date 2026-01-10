'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { articles } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface LibraryProps {
  user: User
  onBack: () => void
  onViewArticle: (articleId: string) => void
  onLogout: () => void
}

interface Article {
  id: string
  title: string
  image_url: string | null
  created_at: string
}

export default function Library({ user, onBack, onViewArticle, onLogout }: LibraryProps) {
  const [articlesList, setArticlesList] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadArticles = async () => {
      try {
        const { data, error } = await articles.getUserArticles(user.id)
        if (error) {
          console.error('获取文章列表失败:', error)
          setArticlesList([])
        } else {
          setArticlesList(data || [])
        }
      } catch (err) {
        console.error('加载文章列表异常:', err)
        setArticlesList([])
      } finally {
        setLoading(false)
      }
    }

    loadArticles()
  }, [user.id])

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
            📚 我的图书馆
          </h1>
          <p className="text-gray-600 text-lg">查看你保存的所有文章</p>
        </motion.div>

        {/* 文章列表 */}
        {articlesList.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">📖</div>
            <p className="text-gray-600 text-xl">还没有保存的文章</p>
            <p className="text-gray-500 mt-2">完成阅读测试后生成的文章会自动保存到这里</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articlesList.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onViewArticle(article.id)}
                className="bg-white rounded-2xl shadow-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-all border-2 border-gray-100"
              >
                {/* 文章图片 */}
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  {article.image_url ? (
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-candy-blue/20 to-candy-green/20">
                      <span className="text-4xl">📖</span>
                    </div>
                  )}
                </div>
                
                {/* 文章标题和日期 */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(article.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
