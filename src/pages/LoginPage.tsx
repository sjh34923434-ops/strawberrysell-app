import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate            = useNavigate()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [autoLogin,  setAutoLogin]  = useState(true)

  // DEV 자동 로그인
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const devEmail = import.meta.env.VITE_DEV_EMAIL
    const devPw    = import.meta.env.VITE_DEV_PASSWORD
    if (!devEmail || !devPw) return
    login(devEmail, devPw).then(() => navigate('/dashboard')).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      // 오류는 store의 error 필드에 표시
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg dark:bg-dark-bg bg-gray-50 p-4">
      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-4">
            <span className="text-3xl">🍓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 dark:text-slate-100 text-gray-900">
            딸기셀
          </h1>
          <p className="text-sm text-slate-500 mt-1">주문매칭 자동화 시스템</p>
        </div>

        {/* 카드 */}
        <div className="
          bg-dark-card dark:bg-dark-card bg-white
          border border-dark-border dark:border-dark-border border-gray-200
          rounded-2xl p-7 shadow-2xl shadow-black/20
        ">
          <h2 className="text-base font-semibold text-slate-200 dark:text-slate-200 text-gray-800 mb-5">
            로그인
          </h2>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4 animate-fade-in">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이메일 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400 dark:text-slate-400 text-gray-500">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="email"
                className="
                  w-full px-3 py-2.5 rounded-xl text-sm
                  bg-dark-hover dark:bg-dark-hover bg-gray-50
                  border border-dark-border dark:border-dark-border border-gray-200
                  text-slate-100 dark:text-slate-100 text-gray-900
                  placeholder-slate-500 dark:placeholder-slate-500 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  transition-all duration-150
                "
              />
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400 dark:text-slate-400 text-gray-500">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  autoComplete="current-password"
                  className="
                    w-full pl-3 pr-10 py-2.5 rounded-xl text-sm
                    bg-dark-hover dark:bg-dark-hover bg-gray-50
                    border border-dark-border dark:border-dark-border border-gray-200
                    text-slate-100 dark:text-slate-100 text-gray-900
                    placeholder-slate-500 dark:placeholder-slate-500 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                    transition-all duration-150
                  "
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 dark:hover:text-slate-300 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 자동 로그인 */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setAutoLogin((v) => !v)}
                className={`
                  w-4 h-4 rounded flex items-center justify-center
                  border transition-all duration-150 cursor-pointer
                  ${autoLogin
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-dark-border dark:border-dark-border border-gray-300 bg-transparent'
                  }
                `}
              >
                {autoLogin && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-400 text-gray-500">자동 로그인</span>
            </label>

            {/* 제출 */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                w-full flex items-center justify-center gap-2
                py-2.5 rounded-xl text-sm font-semibold
                bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                text-white transition-all duration-150 active:scale-[0.99]
                disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-primary-500/25 mt-1
              "
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 dark:text-slate-600 text-gray-400 mt-4">
          딸기셀 라이선스 보유 고객 전용 서비스입니다
        </p>
      </div>
    </div>
  )
}
