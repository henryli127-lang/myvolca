'use client'

import { useState, useEffect, useRef } from 'react'
import { auth, profiles, supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthProps {
  onAuthSuccess: (user: User) => void
}

type Role = 'child' | 'parent'

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('child')
  const [childEmail, setChildEmail] = useState('')
  const [checkingChild, setCheckingChild] = useState(false)
  const [childExists, setChildExists] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // 使用 ref 防止重复调用 onAuthSuccess
  const hasCalledAuthSuccess = useRef(false)

  useEffect(() => {
    // 检查是否已登录
    const checkUser = async () => {
      if (hasCalledAuthSuccess.current) return
      const { user } = await auth.getCurrentUser()
      if (user && !hasCalledAuthSuccess.current) {
        hasCalledAuthSuccess.current = true
        console.log('🔑 Auth: checkUser 检测到已登录用户')
        onAuthSuccess(user)
      }
    }
    checkUser()

    // 监听认证状态变化
    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      console.log('🔑 Auth: onAuthStateChange 事件:', event)
      if (event === 'SIGNED_IN' && session?.user && !hasCalledAuthSuccess.current) {
        hasCalledAuthSuccess.current = true
        console.log('🔑 Auth: SIGNED_IN 事件触发 onAuthSuccess')
        onAuthSuccess(session.user)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, []) // 移除 onAuthSuccess 依赖，避免重复执行

  // 检查孩子邮箱是否存在
  const checkChildEmail = async (childEmailValue: string) => {
    if (!childEmailValue || !childEmailValue.includes('@')) {
      setChildExists(null)
      return
    }

    setCheckingChild(true)
    try {
      const { data, error } = await profiles.findByEmail(childEmailValue)
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 是"未找到记录"的错误代码
        console.error('检查孩子邮箱失败:', error)
        setChildExists(null)
        return
      }

      if (data && data.role === 'child') {
        setChildExists(true)
      } else {
        setChildExists(false)
      }
    } catch (err) {
      console.error('检查孩子邮箱时出错:', err)
      setChildExists(null)
    } finally {
      setCheckingChild(false)
    }
  }

  // 当孩子邮箱输入变化时检查
  useEffect(() => {
    if (role === 'parent' && childEmail) {
      const timer = setTimeout(() => {
        checkChildEmail(childEmail)
      }, 500) // 防抖：500ms 后检查

      return () => clearTimeout(timer)
    } else {
      setChildExists(null)
    }
  }, [childEmail, role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isLogin) {
        // 登录
        const { data, error: signInError } = await auth.signIn(email, password)

        if (signInError) {
          setError(signInError.message)
          return
        }

        if (data?.user) {
          onAuthSuccess(data.user)
        }
      } else {
        // 注册前的验证
        if (role === 'parent') {
          if (!childEmail || !childEmail.includes('@')) {
            setError('请输入孩子的注册邮箱')
            setLoading(false)
            return
          }

          // 检查孩子邮箱是否存在
          const { data: childProfile, error: childCheckError } = await profiles.findByEmail(childEmail)
          
          if (childCheckError || !childProfile) {
            setError('请让孩子先完成注册，以便您进行关联。')
            setLoading(false)
            return
          }

          if (childProfile.role !== 'child') {
            setError('该邮箱对应的用户不是孩子角色')
            setLoading(false)
            return
          }

          if (childProfile.parent_id) {
            setError('该孩子已经关联了家长')
            setLoading(false)
            return
          }
        }

        // ============================================
        // 步骤 1: 调用 supabase.auth.signUp 创建账号
        // ============================================
        console.log('[注册] 步骤 1: 开始注册用户，邮箱:', email, '角色:', role)
        const { data, error: signUpError } = await auth.signUp(email, password)

        if (signUpError) {
          console.error('[注册] 步骤 1 失败:', signUpError)
          setError(signUpError.message)
          setLoading(false)
          return
        }

        if (!data.user) {
          console.error('[注册] 步骤 1 失败: 未返回用户数据')
          setError('注册失败，请重试')
          setLoading(false)
          return
        }

        console.log('[注册] 步骤 1 成功: 用户已创建，ID:', data.user.id)

        // ============================================
        // 步骤 2: 等待触发器创建 profiles 记录
        // ============================================
        console.log('[注册] 步骤 2: 等待触发器创建 profiles 记录...')
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 重试逻辑：等待触发器创建 profile
        let profile = null
        let retryCount = 0
        const maxRetries = 10
        
        while (retryCount < maxRetries && !profile) {
          console.log(`[注册] 步骤 2: 尝试获取 profile (${retryCount + 1}/${maxRetries})...`)
          const { data: profileData, error: profileError } = await profiles.get(data.user.id)
          
          if (profileData) {
            profile = profileData
            console.log('[注册] 步骤 2 成功: profile 已创建', profile)
            break
          }
          
          if (profileError) {
            console.warn(`[注册] 步骤 2: 获取 profile 失败 (${retryCount + 1}/${maxRetries}):`, profileError)
          }
          
          // 如果 profile 不存在，可能是触发器没有执行，尝试手动创建
          if (retryCount === 3 && !profileData) {
            console.warn('[注册] 步骤 2: 触发器可能未执行，尝试手动创建 profile')
            const { data: insertedProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({ id: data.user.id, email: data.user.email, role: null })
              .select('id, email, role, parent_id')
              .single()
            
            if (insertedProfile && !insertError) {
              profile = insertedProfile
              console.log('[注册] 步骤 2: 手动创建 profile 成功', profile)
              break
            } else {
              console.error('[注册] 步骤 2: 手动创建 profile 失败:', insertError)
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 500))
          retryCount++
        }

        if (!profile) {
          console.error('[注册] 步骤 2 失败: 无法创建或获取 profile')
          setError('注册成功，但初始化用户资料失败。请刷新页面重试，或联系管理员检查触发器配置。')
          setLoading(false)
          return
        }

        // ============================================
        // 步骤 3: 根据角色更新 profile
        // ============================================
        if (role === 'parent') {
          console.log('[注册] 步骤 3: 开始处理家长注册流程')
          
          // 使用 RPC 函数一次性完成『修改自己角色』和『关联孩子』两个动作
          if (childEmail) {
            console.log('[注册] 步骤 3: 调用 RPC 函数初始化家长 profile，孩子邮箱:', childEmail)
            
            const { error: rpcError } = await supabase.rpc('initialize_parent_profile', {
              parent_uuid: data.user.id,
              child_email_input: childEmail
            })
            
            console.log('[注册] 步骤 3: RPC 函数调用结果:', { rpcError })
            
            if (rpcError) {
              console.error('[注册] 步骤 3 失败: RPC 函数调用失败', rpcError)
              
              // 根据错误信息提供更具体的提示
              if (rpcError.message?.includes('找不到') || rpcError.message?.includes('not found')) {
                setError(`注册成功，但找不到孩子的账户（邮箱: ${childEmail}）。请确认孩子已完成注册，或联系管理员。`)
              } else if (rpcError.message?.includes('已关联') || rpcError.message?.includes('already linked')) {
                setError('该孩子已经关联了其他家长，无法重复关联。')
              } else if (rpcError.message?.includes('不是孩子') || rpcError.message?.includes('not a child')) {
                setError('该邮箱对应的用户不是孩子角色，无法关联。')
              } else {
                setError(`注册成功，但初始化家长资料失败: ${rpcError.message || '未知错误'}。请刷新页面重试，或联系管理员。`)
              }
              setLoading(false)
              return
            }
            
            console.log('[注册] 步骤 3 成功: 家长 profile 已初始化，角色已设置为 parent，孩子已关联')
          } else {
            // 如果没有提供 childEmail，只更新角色
            console.log('[注册] 步骤 3: 未提供 childEmail，只更新角色为 parent')
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'parent' })
              .eq('id', data.user.id)
            
            if (updateError) {
              console.error('[注册] 步骤 3 失败: 更新角色失败', updateError)
              setError('注册成功，但设置角色失败。请刷新页面重试，或联系管理员。')
              setLoading(false)
              return
            }
            
            console.log('[注册] 步骤 3 成功: 家长 role 已更新为 parent')
          }
          
          console.log('[注册] 步骤 3 完成: 家长注册流程完成')
        } else if (role === 'child') {
          console.log('[注册] 步骤 3: 开始处理孩子注册流程')
          
          // 更新孩子的 role 为 'child'（如果 role 为 null）
          if (!profile.role) {
            console.log('[注册] 步骤 3: 更新孩子 role 为 child')
            
            // 执行普通的 update，不带 select
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'child' })
              .eq('id', data.user.id)
            
            console.log('[注册] 步骤 3: update 操作结果:', { updateError })
            
            if (updateError) {
              // 检查是否是 RLS 权限问题
              if (updateError.code === '42501' || updateError.message?.includes('permission') || updateError.message?.includes('policy')) {
                console.error('[注册] 步骤 3: RLS 权限问题，请检查 profiles 表的 UPDATE 策略')
              } else if (updateError.code === 'PGRST116' || updateError.message?.includes('406')) {
                console.error('[注册] 步骤 3: 406 错误，可能是 RLS 策略或触发器问题')
              }
              console.warn('[注册] 步骤 3: 更新孩子 role 失败（可能是触发器已设置）', updateError)
            } else {
              // 更新成功后，单独调用 select 来获取最新的 Profile
              console.log('[注册] 步骤 3: update 成功，获取最新的 profile...')
              const { data: updatedProfile, error: selectError } = await supabase
                .from('profiles')
                .select('id, email, role, parent_id')
                .eq('id', data.user.id)
                .single()
              
              if (selectError || !updatedProfile) {
                console.warn('[注册] 步骤 3: 获取更新后的 profile 失败', selectError)
              } else {
                console.log('[注册] 步骤 3 成功: 孩子 role 已更新为 child', updatedProfile)
              }
            }
          } else {
            console.log('[注册] 步骤 3: 孩子 role 已设置，跳过更新:', profile.role)
          }
        }

        // ============================================
        // 步骤 4: 完成注册，处理登录
        // ============================================
        console.log('[注册] 步骤 4: 注册流程完成，处理登录')
        
        // 检查邮箱是否已确认
        if (data.user.email_confirmed_at) {
          // 邮箱已确认，直接登录
          console.log('[注册] 步骤 4: 邮箱已确认，直接登录')
          setMessage('注册成功！正在登录...')
          setTimeout(() => {
            onAuthSuccess(data.user!)
          }, 1000)
        } else {
          // 邮箱未确认，提示用户检查邮箱
          console.log('[注册] 步骤 4: 邮箱未确认，提示用户检查邮箱')
          setMessage('注册成功！请检查你的邮箱并点击确认链接以完成注册。')
        }
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 transform transition-all hover:scale-105">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-600 mb-2">
            {isLogin ? '欢迎回来！' : '开始学习之旅'}
          </h1>
          <p className="text-sky-600 text-sm">🎓 GSL&AWL单词学习平台</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-sky-700 mb-2">
                👤 角色选择
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setRole('child')
                    setChildEmail('')
                    setChildExists(null)
                    setError('')
                  }}
                  className={`flex-1 py-3 px-4 rounded-2xl font-semibold transition-all ${
                    role === 'child'
                      ? 'bg-sky-500 text-white shadow-lg'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  👶 孩子
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('parent')
                    setError('')
                  }}
                  className={`flex-1 py-3 px-4 rounded-2xl font-semibold transition-all ${
                    role === 'parent'
                      ? 'bg-sky-500 text-white shadow-lg'
                      : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  }`}
                >
                  👨‍👩‍👧 家长
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-sky-700 mb-2">
              📧 邮箱地址
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border-2 border-sky-200 focus:border-sky-500 focus:outline-none text-sky-700 transition-all"
              placeholder="your@email.com"
            />
          </div>

          {!isLogin && role === 'parent' && (
            <div>
              <label className="block text-sm font-semibold text-sky-700 mb-2">
                👶 孩子的注册邮箱 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={childEmail}
                onChange={(e) => setChildEmail(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-2xl border-2 transition-all ${
                  childExists === false
                    ? 'border-red-300 focus:border-red-500'
                    : childExists === true
                    ? 'border-green-300 focus:border-green-500'
                    : 'border-sky-200 focus:border-sky-500'
                } focus:outline-none text-sky-700`}
                placeholder="child@example.com"
              />
              {checkingChild && (
                <p className="text-xs text-sky-500 mt-1 flex items-center">
                  <span className="animate-spin mr-1">⏳</span>
                  正在检查...
                </p>
              )}
              {childExists === true && (
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  ✅ 找到该孩子的账户
                </p>
              )}
              {childExists === false && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ 未找到该孩子的账户，请让孩子先完成注册
                </p>
              )}
              {!checkingChild && childExists === null && childEmail && (
                <p className="text-xs text-sky-500 mt-1">
                  请输入孩子已注册的邮箱地址
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-sky-700 mb-2">
              🔒 密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-2xl border-2 border-sky-200 focus:border-sky-500 focus:outline-none text-sky-700 transition-all"
              placeholder="至少6个字符"
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-2xl animate-pulse">
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border-2 border-green-200 text-green-700 px-4 py-3 rounded-2xl">
              ✅ {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (role === 'parent' && childExists !== true)}
            className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2">⏳</span>
                处理中...
              </span>
            ) : (
              isLogin ? '🚀 登录' : '✨ 注册'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setMessage('')
              setRole('child')
              setChildEmail('')
              setChildExists(null)
            }}
            className="text-sky-600 hover:text-sky-700 font-semibold transition-colors"
          >
            {isLogin ? '还没有账号？点击注册 👉' : '已有账号？点击登录 👉'}
          </button>
        </div>
        <div className="text-center text-sm text-sky-600">
          <p> </p>
          <p>© 2025 EmiliaEdu. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

