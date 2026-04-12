import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api } from '../api/client'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/login?verified=success'), 2500)
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="relative w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-6">
          <span className="text-3xl">🍓</span>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl shadow-black/20">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin text-primary-400" />
              <p className="text-sm text-slate-300">인증 확인 중...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 size={40} className="text-green-400" />
              <p className="text-base font-semibold text-slate-100">이메일 인증 완료!</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                4일 무료체험이 시작됐습니다.<br />
                잠시 후 로그인 페이지로 이동합니다...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3">
              <XCircle size={40} className="text-red-400" />
              <p className="text-base font-semibold text-slate-100">인증 실패</p>
              <p className="text-xs text-slate-400">
                유효하지 않거나 만료된 인증 링크입니다.
              </p>
              <button
                onClick={() => navigate('/register')}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all"
              >
                다시 가입하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
