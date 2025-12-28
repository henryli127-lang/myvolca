'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface AuthFormProps {
  onAuthSuccess: (userId: string, userType: string, username: string) => void
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState<'Parent' | 'Child'>('Child')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // 登录逻辑
        const { data, error: loginError } = await supabase
          .from('users')
          .select('id, username, user_type')
          .eq('username', username)
          .eq('password', password) // 注意：实际应用中应该使用哈希密码
          .single()

        if (loginError || !data) {
          setError('用户名或密码错误')
          return
        }

        // 保存用户信息到 localStorage
        localStorage.setItem('userId', data.id)
        localStorage.setItem('userType', data.user_type)
        localStorage.setItem('username', data.username)
        
        onAuthSuccess(data.id, data.user_type, data.username)
      } else {
        // 注册逻辑
        // 检查用户名是否已存在
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single()

        if (existingUser) {
          setError('用户名已存在')
          return
        }

        // 创建新用户
        const { data: newUser, error: registerError } = await supabase
          .from('users')
          .insert({
            username: username,
            password: password, // 注意：实际应用中应该使用哈希密码
            user_type: userType,
            created_at: new Date().toISOString(),
          })
          .select('id, username, user_type')
          .single()

        if (registerError || !newUser) {
          setError('注册失败，请重试')
          return
        }

        // 保存用户信息到 localStorage
        localStorage.setItem('userId', newUser.id)
        localStorage.setItem('userType', newUser.user_type)
        localStorage.setItem('username', newUser.username)
        
        onAuthSuccess(newUser.id, newUser.user_type, newUser.username)
      }
    } catch (err) {
      setError('操作失败，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-sky-700">
          {isLogin ? '登录' : '注册'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-sky-700 mb-2">
                用户类型
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setUserType('Parent')}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                    userType === 'Parent'
                      ? 'bg-sky-500 text-white shadow-lg'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  👨‍👩‍👧 Parent
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('Child')}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                    userType === 'Child'
                      ? 'bg-sky-500 text-white shadow-lg'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  👶 Child
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-sky-700 mb-2">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-sky-200 focus:border-sky-500 focus:outline-none text-sky-700"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-sky-700 mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-sky-200 focus:border-sky-500 focus:outline-none text-sky-700"
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
            className="text-sky-600 hover:text-sky-700 font-semibold"
          >
            {isLogin ? '还没有账号？点击注册' : '已有账号？点击登录'}
          </button>
        </div>
      </div>
    </div>
  )
}

