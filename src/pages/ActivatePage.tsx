import { useState } from 'react'
import { Key, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export function ActivatePage() {
  const { activate, isLoading, error, clearError, logout } = useAuthStore()
  const [licenseKey, setLicenseKey] = useState('')
  const [success,    setSuccess]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await activate(licenseKey)
      setSuccess(true)
      setTimeout(() => window.location.href = '/dashboard', 1500)
    } catch {
      // 에러는 store에서 처리
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-4">
            <span className="text-3xl">🍓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">딸기셀</h1>
          <p className="text-sm text-slate-500 mt-1">라이선스 활성화</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-7 shadow-2xl shadow-black/20">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={40} className="text-green-400" />
              <p className="text-sm text-slate-200 font-medium">활성화 완료!</p>
              <p className="text-xs text-slate-400">잠시 후 대시보드로 이동합니다...</p>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-200 mb-1">라이선스 키 입력</h2>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                관리자로부터 받은 라이선스 키를 입력해주세요.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">라이선스 키</label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      required
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all disabled:opacity-60 shadow-lg shadow-primary-500/25"
                >
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  {isLoading ? '확인 중...' : '활성화'}
                </button>
              </form>

              <button
                onClick={() => logout()}
                className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
