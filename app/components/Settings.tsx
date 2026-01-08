'use client'

import { useState } from 'react'
import { profiles } from '@/lib/supabase'
import { motion } from 'framer-motion'

interface SettingsProps {
  userId: string
  userProfile: any
  onClose: () => void
  onProfileUpdate: (profile: any) => void
}

export default function Settings({ userId, userProfile, onClose, onProfileUpdate }: SettingsProps) {
  const [parentEmail, setParentEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // 验证输入
      if (!parentEmail || !parentEmail.includes('@')) {
        setError('请输入有效的邮箱地址')
        setLoading(false)
        return
      }

      // 根据邮箱查找家长
      const { data: parentProfile, error: findError } = await profiles.findByEmail(parentEmail)

      if (findError || !parentProfile) {
        setError('未找到该邮箱对应的用户，请确认邮箱地址是否正确')
        setLoading(false)
        return
      }

      // 检查是否是家长角色
      if (parentProfile.role !== 'parent') {
        setError('该邮箱对应的用户不是家长角色')
        setLoading(false)
        return
      }

      // 检查是否是自己
      if (parentProfile.id === userId) {
        setError('不能将自己关联为家长')
        setLoading(false)
        return
      }

      // 更新孩子的 parent_id
      const { data: updatedProfile, error: updateError } = await profiles.updateParentId(
        userId,
        parentProfile.id
      )

      if (updateError || !updatedProfile) {
        setError('关联家长失败，请重试')
        setLoading(false)
        return
      }

      setSuccess('成功关联家长！')
      onProfileUpdate(updatedProfile)
      
      // 2秒后关闭
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err: any) {
      setError(err.message || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlinkParent = async () => {
    if (!confirm('确定要解除关联家长吗？')) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { data: updatedProfile, error: updateError } = await profiles.updateParentId(
        userId,
        null as any
      )

      if (updateError || !updatedProfile) {
        setError('解除关联失败，请重试')
        setLoading(false)
        return
      }

      setSuccess('已解除关联家长')
      onProfileUpdate(updatedProfile)
    } catch (err: any) {
      setError(err.message || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-sky-700">⚙️ 设置</h2>
          <button
            onClick={onClose}
            className="text-sky-600 hover:text-sky-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 关联家长 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-sky-700 mb-4">关联家长</h3>
          
          {userProfile?.parent_id ? (
            <div className="bg-sky-50 rounded-2xl p-4 mb-4">
              <p className="text-sky-700 mb-2">
                ✅ 已关联家长
              </p>
              <button
                onClick={handleUnlinkParent}
                disabled={loading}
                className="text-sm text-red-600 hover:text-red-700 font-semibold"
              >
                解除关联
              </button>
            </div>
          ) : (
            <form onSubmit={handleLinkParent} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-sky-700 mb-2">
                  📧 家长邮箱
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl border-2 border-sky-200 focus:border-sky-500 focus:outline-none text-sky-700 transition-all"
                  placeholder="parent@example.com"
                />
                <p className="text-xs text-sky-500 mt-1">
                  请输入家长的注册邮箱
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-2xl">
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-2 border-green-200 text-green-700 px-4 py-3 rounded-2xl">
                  ✅ {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin mr-2">⏳</span>
                    处理中...
                  </span>
                ) : (
                  '🔗 关联家长'
                )}
              </button>
            </form>
          )}
        </div>

        {/* 用户信息 */}
        <div className="border-t border-sky-200 pt-4">
          <h3 className="text-lg font-semibold text-sky-700 mb-2">账户信息</h3>
          <div className="text-sm text-sky-600 space-y-1">
            <p>邮箱: {userProfile?.email}</p>
            <p>角色: {userProfile?.role === 'child' ? '👶 Child' : '👨‍👩‍👧 Parent'}</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}



