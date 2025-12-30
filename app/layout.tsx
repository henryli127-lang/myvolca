import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EmiliaEdu单词记忆系统（GSL&AWL）',
  description: '有趣的单词学习应用',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

