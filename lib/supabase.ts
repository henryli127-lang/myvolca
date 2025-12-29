import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 用户认证相关
export const auth = {
  // 邮箱注册（需要邮箱确认）
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  },

  // 邮箱登录（需要邮箱确认）
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // 登出
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // 获取当前用户
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // 监听认证状态变化
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  },
}

// 用户资料相关
export const profiles = {
  // 检查用户资料是否存在
  exists: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    return { exists: !!data && !error, error }
  },

  // 获取用户资料（字段名严格对应数据库：id, email, role, parent_id, streak_days, last_login_at, daily_learning_goal, daily_testing_goal）
  get: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, parent_id, streak_days, last_login_at, daily_learning_goal, daily_testing_goal')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  // 更新登录信息（更新 streak_days 和 last_login_at）
  updateLoginInfo: async (userId: string, streakDays: number) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        streak_days: streakDays,
        last_login_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, role, parent_id, streak_days, last_login_at, daily_learning_goal, daily_testing_goal')
      .single()
    return { data, error }
  },

  // 更新最后登录时间（简化版本，只更新 last_login_at）
  updateLastLogin: async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        last_login_at: new Date().toISOString()
      })
      .eq('id', userId)
    return { error }
  },

  // 根据邮箱查找用户（用于关联家长，字段名严格对应数据库）
  findByEmail: async (email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, parent_id')
      .eq('email', email)
      .single()
    return { data, error }
  },

  // 更新孩子的 parent_id（parentId 可以为 null 来解除关联）
  updateParentId: async (childId: string, parentId: string | null) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ parent_id: parentId })
      .eq('id', childId)
      .select('id, email, role, parent_id')
      .single()
    return { data, error }
  },

  // 更新用户角色（仅在注册时使用，role 为 NULL 时才能设置，之后禁止修改）
  // force: 如果为 true，允许在注册阶段强制更新 role（用于处理触发器已设置默认值的情况）
  updateRole: async (userId: string, newRole: 'child' | 'parent', force: boolean = false): Promise<{ data: any; error: any }> => {
    // 先检查当前 role 和 profile 是否存在
    const { data: currentProfile, error: getError } = await profiles.get(userId)
    
    // 如果 profile 不存在，返回错误
    if (getError || !currentProfile) {
      return { 
        data: null, 
        error: { 
          message: '用户资料不存在',
          code: 'PROFILE_NOT_FOUND'
        } as any
      }
    }
    
    // 如果 role 已经设置且不是强制更新，不允许修改
    if (currentProfile.role && !force) {
      return { 
        data: currentProfile, 
        error: { 
          message: 'role 字段一旦设置后不能修改',
          code: 'ROLE_ALREADY_SET'
        } as any
      }
    }

    // 构建更新查询
    // 如果 force=false，只更新 role 为 NULL 的记录
    // 如果 force=true，允许更新任何 role（用于注册阶段纠正错误的角色）
    console.log(`准备更新 role: userId=${userId}, newRole=${newRole}, force=${force}, currentRole=${currentProfile.role}`)
    
    let query = supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
    
    if (!force) {
      // 只更新 role 为 NULL 的记录
      query = query.is('role', null)
    }
    
    // 执行更新
    const { data: updateData, error: updateError } = await query
      .select('id, email, role, parent_id')
      .maybeSingle()
    
    console.log('更新操作结果:', { updateData, updateError, hasData: !!updateData, hasError: !!updateError })
    
    // 如果更新出错，返回错误
    if (updateError) {
      console.error('更新 role 时出错:', updateError)
      return { data: null, error: updateError }
    }
    
    // 如果更新成功但没有返回数据（可能是 RLS 策略问题），重新查询一次
    if (!updateData) {
      console.warn('更新操作没有返回数据，可能是 RLS 策略问题，重新查询...')
      // 等待一小段时间，让数据库更新完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 重新查询 profile
      const { data: refreshedProfile, error: refreshError } = await profiles.get(userId)
      
      if (refreshError || !refreshedProfile) {
        return { 
          data: null, 
          error: { 
            message: '更新成功但无法获取更新后的数据',
            code: 'UPDATE_SUCCESS_BUT_NO_DATA'
          } as any
        }
      }
      
      // 检查 role 是否真的更新了
      if (refreshedProfile.role !== newRole) {
        console.error(`角色更新不匹配: 期望 ${newRole}，实际 ${refreshedProfile.role}，当前 profile:`, refreshedProfile)
        
        // 如果 role 仍然是 null，可能是更新操作被阻止了
        // 尝试使用 force=true 再次更新
        if (refreshedProfile.role === null && !force) {
          console.log('role 仍然是 null，尝试使用 force=true 再次更新...')
          const { data: retryData, error: retryError } = await profiles.updateRole(userId, newRole, true)
          
          if (retryError) {
            return { 
              data: refreshedProfile, 
              error: { 
                message: `更新失败：期望 role 为 ${newRole}，但实际为 ${refreshedProfile.role}。重试也失败: ${retryError.message}`,
                code: 'ROLE_UPDATE_MISMATCH'
              } as any
            }
          }
          
          return { data: retryData, error: null }
        }
        
        return { 
          data: refreshedProfile, 
          error: { 
            message: `更新失败：期望 role 为 ${newRole}，但实际为 ${refreshedProfile.role}`,
            code: 'ROLE_UPDATE_MISMATCH'
          } as any
        }
      }
      
      return { data: refreshedProfile, error: null }
    }
    
    // 验证返回的数据
    if (updateData.role !== newRole) {
      console.error(`更新返回的数据不匹配: 期望 ${newRole}，实际 ${updateData.role}`)
      return { 
        data: updateData, 
        error: { 
          message: `更新返回的数据不匹配：期望 role 为 ${newRole}，但实际为 ${updateData.role}`,
          code: 'ROLE_UPDATE_MISMATCH'
        } as any
      }
    }
    
    return { data: updateData, error: null }
  },

  // 获取家长关联的所有孩子
  getChildren: async (parentId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, parent_id, streak_days, last_login_at')
      .eq('parent_id', parentId)
      .eq('role', 'child')
    return { data, error }
  },
}

// 单词相关
export const words = {
  // 获取随机未掌握的单词（status 不为 'mastered'）
  getRandomUnmastered: async (userId: string) => {
    try {
      console.log('开始获取未掌握的单词，用户ID:', userId)
      
      // 先获取所有已掌握的单词ID（status = 'mastered'）
      const { data: masteredWords, error: masteredError } = await supabase
        .from('user_progress')
        .select('word_id')
        .eq('user_id', userId)
        .eq('status', 'mastered')

      // 如果查询出错，记录错误但继续执行（可能是新用户，没有进度记录）
      if (masteredError) {
        console.warn('查询已掌握单词时出错（可能是新用户）:', masteredError)
        // 对于新用户，可能没有 user_progress 记录，这是正常的
      }

      const masteredWordIds = masteredWords?.map(w => w.word_id) || []
      console.log('已掌握的单词ID:', masteredWordIds)

      // 获取所有单词（包含 keywords 字段）
      const { data: allWords, error } = await supabase
        .from('words')
        .select('id, word, translation, pos, mnemonic, sentence_en, sentence_cn, keywords')

      if (error) {
        console.error('获取单词列表失败:', error)
        console.error('错误详情:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // 如果是 406 错误或权限问题，提示检查 RLS 策略
        if (error.code === 'PGRST116' || error.message?.includes('406') || error.message?.includes('permission')) {
          console.error('可能是 RLS 策略问题，请检查 words 表的权限设置')
          console.error('请参考 RLS_SETUP.md 文件设置正确的 RLS 策略')
        }
        
        return { data: null, error }
      }

      console.log('获取到的所有单词数量:', allWords?.length || 0)

      if (!allWords || allWords.length === 0) {
        console.warn('单词表中没有数据')
        return { data: null, error: null }
      }

      // 过滤掉已掌握的单词（status = 'mastered'）
      // 注意：status 为 'learning' 或其他值的单词仍然可以学习
      const unmasteredWords = allWords.filter(
        (word) => !masteredWordIds.includes(word.id)
      )

      console.log('未掌握的单词数量:', unmasteredWords.length)

      if (unmasteredWords.length === 0) {
        // 所有单词都已掌握
        console.log('所有单词都已掌握')
        return { data: null, error: null }
      }

      // 随机选择一个
      const randomIndex = Math.floor(Math.random() * unmasteredWords.length)
      console.log('随机选择的单词索引:', randomIndex)
      return { data: unmasteredWords[randomIndex], error: null }
    } catch (error: any) {
      console.error('获取随机单词时出错:', error)
      return { data: null, error }
    }
  },

  // 获取已掌握的单词总数
  getMasteredCount: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_progress')
      .select('word_id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'mastered')
    
    return { count: data?.length || 0, error }
  },

  // 获取学习会话的单词（基于艾宾浩斯记忆曲线，包含错题复习、旧词巩固、新词学习）
  getWordsForSession: async (userId: string, limit: number = 30) => {
    try {
      const { data, error } = await supabase.rpc('get_words_for_session', {
        p_user_id: userId,
        p_limit: limit
      })
      
      if (error) {
        console.error('调用 get_words_for_session RPC 失败:', error)
        return { data: null, error }
      }

      // 确保 id 为 number 类型（int8）
      const words = data?.map((word: any) => ({
        ...word,
        id: Number(word.id),
        is_review: word.is_review || false
      })) || []

      return { data: words, error: null }
    } catch (err: any) {
      console.error('调用 get_words_for_session RPC 异常:', err)
      return { data: null, error: err }
    }
  },
}

// 学习进度相关
export const userProgress = {
  // 获取今日已学单词数
  getTodayCount: async (userId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const { data, error } = await supabase
      .from('user_progress')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('updated_at', todayISO)

    return { count: data?.length || 0, error }
  },

  // 更新学习进度（Got it）
  upsertProgress: async (
    userId: string,
    wordId: number,
    isNewWord: boolean,
    currentReviewCount: number
  ) => {
    const now = new Date()
    const nextReview = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24小时后

    const upsertData: any = {
      word_id: wordId,
      user_id: userId,
      review_count: isNewWord ? 0 : currentReviewCount + 1,
      next_review: nextReview.toISOString(),
      updated_at: now.toISOString(),
    }

    if (isNewWord) {
      upsertData.status = 'learning'
      upsertData.created_at = now.toISOString()
    }

    const { data, error } = await supabase
      .from('user_progress')
      .upsert(upsertData, {
        onConflict: 'user_id,word_id',
      })

    return { data, error }
  },

  // 更新测试结果（通过 RPC 函数保存，数据库自动识别当前用户）
  updateTestResults: async (
    wordId: number,
    translationErrors: number,
    spellingErrors: number
  ) => {
    try {
      const { data, error } = await supabase.rpc('save_word_challenge_result', {
        p_word_id: wordId,
        p_trans_errors: translationErrors,
        p_spell_errors: spellingErrors
      })
      return { data, error }
    } catch (err: any) {
      console.error('调用 save_word_challenge_result RPC 失败:', err)
      return { data: null, error: err }
    }
  },

  // 检查单词进度（如果不存在返回 null，不报错）
  checkProgress: async (userId: string, wordId: number) => {
    const { data, error } = await supabase
      .from('user_progress')
      .select('review_count, status, translation_errors, spelling_errors')
      .eq('word_id', wordId)
      .eq('user_id', userId)
      .maybeSingle()  // 使用 maybeSingle() 而不是 single()，记录不存在时返回 null 而不是错误

    // PGRST116 是"未找到记录"的错误代码，这是正常的（新词）
    if (error && error.code !== 'PGRST116') {
      return { data: null, error }
    }

    return { data: data || null, error: null }
  },

  // 获取已掌握的单词总数
  getMasteredCount: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_progress')
      .select('word_id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'mastered')
    
    return { count: data?.length || 0, error }
  },
}

// 学习日志相关
export const studyLogs = {
  // 记录学习会话
  create: async (
    userId: string,
    sessionId: string,
    startTime: string,
    endTime: string,
    durationMinutes: number
  ) => {
    try {
      const { data, error } = await supabase
        .from('study_logs')
        .insert({
          user_id: userId,
          session_id: sessionId,
          start_time: startTime,
          end_time: endTime,
          duration: durationMinutes, // 使用 duration 字段（分钟数）
          created_at: new Date().toISOString(),
        })

      // 如果是 RLS 策略错误，记录但不抛出
      if (error && error.code === '42501') {
        console.warn('记录学习日志被 RLS 策略阻止（可能是认证状态已改变）:', error)
        return { data: null, error: null } // 返回成功，避免影响退出流程
      }

      return { data, error }
    } catch (err: any) {
      console.error('记录学习日志时出错:', err)
      return { data: null, error: err }
    }
  },
}

// 家长端数据相关
export const parent = {
  // 调用 RPC 函数获取孩子统计数据
  getChildStats: async (parentId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_child_stats', {
        p_parent_id: parentId
      })
      return { data, error }
    } catch (err: any) {
      console.error('调用 get_child_stats RPC 失败:', err)
      return { data: null, error: err }
    }
  },
  // [新增] 获取孩子全量看板数据 (一次性获取所有图表数据)
  getChildDashboardStats: async (childId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_child_dashboard_full_stats', {
        p_child_id: childId
      })
      return { data, error }
    } catch (err: any) {
      console.error('调用 get_child_dashboard_full_stats RPC 失败:', err)
      return { data: null, error: err }
    }
  },
  // 获取今日已复习单词数（基于 last_reviewed_at）
  getTodayReviewedCount: async (childId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowISO = tomorrow.toISOString()

    const { data, error } = await supabase
      .from('user_progress')
      .select('word_id', { count: 'exact' })
      .eq('user_id', childId)
      .gte('last_reviewed_at', todayISO)
      .lt('last_reviewed_at', tomorrowISO)

    return { count: data?.length || 0, error }
  },

  // 获取过去7天每天新增的 mastered 单词数
  getWeeklyMasteredStats: async (childId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 获取过去7天内状态变为 mastered 的单词
    const { data, error } = await supabase
      .from('user_progress')
      .select('updated_at, status')
      .eq('user_id', childId)
      .eq('status', 'mastered')
      .gte('updated_at', sevenDaysAgo.toISOString())

    if (error) {
      return { data: null, error }
    }

    // 按日期分组统计
    const dailyStats: { [key: string]: number } = {}
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    // 初始化过去7天的数据
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dayKey = daysOfWeek[date.getDay()]
      dailyStats[dayKey] = 0
    }

    // 统计每天的数量
    data?.forEach(item => {
      const date = new Date(item.updated_at)
      const dayKey = daysOfWeek[date.getDay()]
      if (dailyStats[dayKey] !== undefined) {
        dailyStats[dayKey]++
      }
    })

    // 转换为数组格式，按周一到周日排序
    const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const result = weekOrder.map(day => ({
      day,
      count: dailyStats[day] || 0
    }))

    return { data: result, error: null }
  },

  // 获取错误最多的前5个单词
  getTopErrorWords: async (childId: string, limit: number = 5) => {
    const { data, error } = await supabase
      .from('user_progress')
      .select(`
        word_id,
        translation_errors,
        spelling_errors,
        words!inner(word, translation)
      `)
      .eq('user_id', childId)
      .order('translation_errors', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) {
      return { data: null, error }
    }

    // 计算总错误数并排序
    const wordsWithErrors = data
      ?.map(item => ({
        wordId: item.word_id,
        word: (item.words as any)?.word || '',
        translation: (item.words as any)?.translation || '',
        totalErrors: (item.translation_errors || 0) + (item.spelling_errors || 0),
        translationErrors: item.translation_errors || 0,
        spellingErrors: item.spelling_errors || 0,
      }))
      .filter(item => item.totalErrors > 0)
      .sort((a, b) => b.totalErrors - a.totalErrors)
      .slice(0, limit) || []

    return { data: wordsWithErrors, error: null }
  },

  // 更新孩子的学习目标和测试目标
  updateChildGoals: async (childId: string, learningGoal: number, testingGoal: number) => {
    try {
      // 先执行更新操作（不包含 select，避免 RLS 问题）
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          daily_learning_goal: learningGoal,
          daily_testing_goal: testingGoal
        })
        .eq('id', childId)
      
      if (updateError) {
        console.error('更新操作失败:', updateError)
        return { data: null, error: updateError }
      }

      // 更新成功后，单独查询获取更新后的数据
      const { data, error: selectError } = await supabase
        .from('profiles')
        .select('id, daily_learning_goal, daily_testing_goal')
        .eq('id', childId)
        .single()
      
      if (selectError) {
        console.error('查询更新后的数据失败:', selectError)
        // 即使查询失败，更新操作可能已经成功，返回成功但数据为空
        return { data: null, error: selectError }
      }
      
      return { data, error: null }
    } catch (err: any) {
      console.error('更新孩子目标失败:', err)
      return { data: null, error: err }
    }
  },
}
