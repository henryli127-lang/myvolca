'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { reports } from '@/lib/supabase'
import { Printer } from 'lucide-react' // ✅ 引入图标

interface WordHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  title?: string
}

export default function WordHistoryModal({ isOpen, onClose, userId, title = "已学单词明细" }: WordHistoryModalProps) {
  // 默认时间范围：今天
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await reports.getHistory(userId, startDate, endDate)
      if (data) {
        setHistoryData(data)
      }
    } catch (err) {
      console.error('查询失败:', err)
    } finally {
      setLoading(false)
      setHasSearched(true)
    }
  }

  // ✅ 新增：处理打印/导出PDF
  const handlePrint = () => {
    if (historyData.length === 0) return

    // 1. 创建打印窗口
    const printWindow = window.open('', '_blank', 'height=600,width=800')
    if (!printWindow) return

    // 2. 准备样式
    const styles = `
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; color: #333; }
        h1 { text-align: center; color: #2d3436; margin-bottom: 10px; }
        .meta { text-align: center; color: #666; font-size: 14px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #dfe6e9; padding: 10px; text-align: left; font-size: 14px; }
        th { background-color: #f1f2f6; font-weight: bold; }
        tr:nth-child(even) { background-color: #fcfcfc; }
        .tag { font-size: 12px; padding: 2px 6px; border-radius: 4px; font-weight: bold; display: inline-block; }
        .tag-green { color: #00b894; border: 1px solid #00b894; background: #eafffa; }
        .tag-red { color: #d63031; border: 1px solid #d63031; background: #fff0f0; }
        .tag-orange { color: #e17055; border: 1px solid #e17055; background: #fff5f0; }
        .tag-yellow { color: #b7791f; border: 1px solid #b7791f; background: #fffaeb; }
      </style>
    `

    // 3. 生成表格内容 HTML
    const rows = historyData.map(item => {
      let statusHtml = ''
      const { translation_errors: tErr, spelling_errors: sErr } = item
      
      if (tErr === 0 && sErr === 0) statusHtml = '<span class="tag tag-green">💯 全对</span>'
      else if (tErr > 0 && sErr > 0) statusHtml = '<span class="tag tag-red">❌ 双错</span>'
      else if (tErr > 0) statusHtml = '<span class="tag tag-orange">🔤 翻译错</span>'
      else if (sErr > 0) statusHtml = '<span class="tag tag-yellow">✍️ 拼写错</span>'
      else statusHtml = '<span class="tag">未知</span>'

      return `
        <tr>
          <td>${item.word}</td>
          <td>${item.translation}</td>
          <td>${statusHtml}</td>
          <td>${new Date(item.last_reviewed_at).toLocaleString()}</td>
        </tr>
      `
    }).join('')

    // 4. 写入内容并触发打印
    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - 打印报表</title>
          ${styles}
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">
            查询范围: ${startDate} 至 ${endDate} | 共 ${historyData.length} 条记录
            <br>生成时间: ${new Date().toLocaleString()}
          </div>
          <table>
            <thead>
              <tr>
                <th width="25%">单词</th>
                <th width="35%">中文意思</th>
                <th width="20%">测试结果</th>
                <th width="20%">学习时间</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          //<script>
            // 等待图片等资源加载(如果有)
            //setTimeout(() => {
                //window.print();
                // 打印取消后不自动关闭窗口，方便用户多次操作，或者你可以取消注释下面这行来自动关闭
                // window.close();
            //}, 500);
          //</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // 辅助函数：判断测试状态 (用于界面显示)
  const getStatusTag = (tErr: number, sErr: number) => {
    if (tErr === 0 && sErr === 0) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">💯 全对</span>
    }
    if (tErr > 0 && sErr > 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">❌ 双错</span>
    }
    if (tErr > 0) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">🔤 翻译错</span>
    }
    if (sErr > 0) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">✍️ 拼写错</span>
    }
    return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">未知</span>
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="p-6 bg-candy-blue flex justify-between items-center text-white">
              <h2 className="text-2xl font-bold">{title}</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 筛选区 */}
            <div className="p-6 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-500 mb-1 ml-1">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-candy-blue"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1 ml-1">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-candy-blue"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-2 bg-candy-green text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? '查询中...' : '🔍 查询'}
              </button>
              
              {/* ✅ 新增：打印/导出按钮 */}
              {hasSearched && historyData.length > 0 && (
                <button
                  onClick={handlePrint}
                  className="ml-auto px-4 py-2 bg-blue-500 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Printer size={18} />
                  <span>打印 / PDF</span>
                </button>
              )}
            </div>

            {/* 列表内容区 */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {!hasSearched ? (
                <div className="text-center text-gray-400 py-10">请选择日期并点击查询</div>
              ) : historyData.length === 0 ? (
                <div className="text-center text-gray-500 py-10">该时间段内没有学习记录 🍃</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr>
                      <th className="p-3 font-bold text-gray-600 border-b">单词</th>
                      <th className="p-3 font-bold text-gray-600 border-b">中文意思</th>
                      <th className="p-3 font-bold text-gray-600 border-b">测试结果</th>
                      <th className="p-3 font-bold text-gray-600 border-b text-right">学习时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item) => (
                      <tr key={item.word_id + item.last_reviewed_at} className="hover:bg-gray-50 border-b border-gray-100">
                        <td className="p-3 font-bold text-gray-800 text-lg">{item.word}</td>
                        <td className="p-3 text-gray-600">{item.translation}</td>
                        <td className="p-3">
                          {getStatusTag(item.translation_errors, item.spelling_errors)}
                        </td>
                        <td className="p-3 text-gray-400 text-sm text-right">
                          {new Date(item.last_reviewed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} <br/>
                          {new Date(item.last_reviewed_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* 底部统计 */}
            {hasSearched && historyData.length > 0 && (
              <div className="p-4 bg-gray-50 text-right text-gray-500 text-sm border-t">
                共找到 {historyData.length} 个单词记录
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}