'use client'

interface UserInfoProps {
  username: string
  userType: string
  onLogout: () => void
}

export default function UserInfo({ username, userType, onLogout }: UserInfoProps) {
  return (
    <div className="w-full max-w-lg mx-auto mb-4 flex justify-between items-center">
      <div className="text-sky-700">
        <span className="font-semibold">欢迎, {username}</span>
        <span className="ml-2 text-sm bg-sky-200 px-3 py-1 rounded-full">
          {userType === 'Parent' ? '👨‍👩‍👧 Parent' : '👶 Child'}
        </span>
      </div>
      <button
        onClick={onLogout}
        className="text-sky-600 hover:text-sky-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sky-100 transition-colors"
      >
        退出
      </button>
    </div>
  )
}

