import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { authApi } from '../api/client'

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative bg-dark-card border border-dark-border rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200">개인정보처리방침</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="text-xs text-slate-400 space-y-4 leading-relaxed">
          <div>
            <p className="font-semibold text-slate-300 mb-1">1. 수집하는 개인정보 항목</p>
            <p>필수: 이름, 이메일 주소, 비밀번호</p>
            <p>선택: 전화번호</p>
          </div>
          <div>
            <p className="font-semibold text-slate-300 mb-1">2. 개인정보 수집 및 이용 목적</p>
            <p>- 서비스 회원 가입 및 관리</p>
            <p>- 라이선스 발급 및 서비스 제공</p>
            <p>- 고객 문의 및 CS 대응</p>
            <p>- 서비스 이용 관련 공지사항 전달</p>
          </div>
          <div>
            <p className="font-semibold text-slate-300 mb-1">3. 개인정보 보유 및 이용 기간</p>
            <p>회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다.</p>
            <p>단, 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-300 mb-1">4. 개인정보의 제3자 제공</p>
            <p>수집된 개인정보는 제3자에게 제공하지 않습니다.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-300 mb-1">5. 개인정보 처리 담당자</p>
            <p>이메일: sjh34923434@gmail.com</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-5 py-2 rounded-xl text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all"
        >
          확인
        </button>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()

  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [agreed,    setAgreed]    = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!agreed) {
      setError('개인정보처리방침에 동의해주세요.')
      return
    }
    if (password !== password2) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setIsLoading(true)
    try {
      let deviceId = localStorage.getItem('deviceId')
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        localStorage.setItem('deviceId', deviceId)
      }
      await authApi.signup(email, password, deviceId, name, phone || undefined)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입신청 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

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
          <p className="text-sm text-slate-500 mt-1">가입신청</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-7 shadow-2xl shadow-black/20">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={40} className="text-green-400" />
              <p className="text-sm text-slate-200 font-medium">가입신청이 완료됐습니다!</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                가입하신 이메일로 인증 링크를 보내드렸어요.<br />
                메일함을 확인하고 인증 링크를 클릭하면<br />
                <strong className="text-primary-400">7일 무료체험</strong>이 바로 시작됩니다!<br /><br />
                <span className="text-yellow-400">📌 메일이 안 보이면 스팸 메일함도 확인해주세요!</span>
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all"
              >
                로그인하러 가기
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-200 mb-1">가입신청</h2>
              <p className="text-xs text-slate-500 mb-5">이메일 인증 시 7일 무료체험이 자동으로 시작됩니다.</p>

              {error && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">이름 <span className="text-primary-400">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="홍길동"
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">이메일 <span className="text-primary-400">*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">전화번호 <span className="text-primary-400">*</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">비밀번호 <span className="text-primary-400">*</span></label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="6자 이상"
                      required
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-400">비밀번호 확인 <span className="text-primary-400">*</span></label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    placeholder="비밀번호 재입력"
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                {/* 개인정보처리방침 동의 */}
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 leading-relaxed">
                    <button
                      type="button"
                      onClick={() => setShowPrivacy(true)}
                      className="text-primary-400 hover:text-primary-300 underline transition-colors"
                    >
                      개인정보처리방침
                    </button>
                    에 동의합니다 <span className="text-primary-400">*</span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all disabled:opacity-60 shadow-lg shadow-primary-500/25 mt-1"
                >
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  {isLoading ? '신청 중...' : '가입신청'}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500 mt-4">
                이미 계정이 있으신가요?{' '}
                <Link to="/login" className="text-primary-400 hover:text-primary-300 transition-colors">로그인</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
