import { useState, useEffect } from 'react'
import { Key, Loader2, AlertCircle, CheckCircle2, Zap, Layers, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api/client'

const PLANS = [
  {
    id:       'free',
    name:     '무료',
    desc:     '1:1 단일매칭',
    icon:     Key,
    color:    'text-slate-400',
    bg:       'bg-slate-500/10',
    border:   'border-slate-500/20',
    features: ['1:1 주문매칭', '엑셀 업로드/다운로드'],
    prices:   { '1': 0, '3': 0, '6': 0, '12': 0 },
    free:     true,
  },
  {
    id:       'standard',
    name:     '스탠다드',
    desc:     '일괄매칭',
    icon:     Layers,
    color:    'text-violet-400',
    bg:       'bg-violet-500/10',
    border:   'border-violet-500/30',
    features: ['무료 플랜 포함', '여러 거래처 일괄 분류', '다중 파일 처리'],
    prices:   { '1': 24900, '3': 74700, '6': 149400, '12': 298800 },
    free:     false,
  },
  {
    id:       'pro',
    name:     '프로',
    desc:     '자동매칭',
    icon:     ShoppingCart,
    color:    'text-orange-400',
    bg:       'bg-orange-500/10',
    border:   'border-orange-500/30',
    features: ['스탠다드 포함', '쿠팡 API 자동 주문 수집', '송장번호 자동 전송'],
    prices:   { '1': 29900, '3': 89700, '6': 179400, '12': 358800 },
    free:     false,
    popular:  true,
  },
]

const DURATIONS = [
  { value: '1',  label: '1개월' },
  { value: '3',  label: '3개월' },
  { value: '6',  label: '6개월' },
  { value: '12', label: '12개월' },
]

function formatPrice(price: number) {
  return price.toLocaleString('ko-KR') + '원'
}

export function ActivatePage() {
  const { activate, isLoading, error, clearError, logout } = useAuthStore()
  const [betaMode,      setBetaMode]      = useState<boolean | null>(null)
  const [selectedPlan,  setSelectedPlan]  = useState<string>('pro')
  const [duration,      setDuration]      = useState<'1' | '3' | '6' | '12'>('1')
  const [showKeyInput,  setShowKeyInput]  = useState(false)
  const [licenseKey,    setLicenseKey]    = useState('')
  const [success,       setSuccess]       = useState(false)

  useEffect(() => {
    api.get<{ betaMode: boolean }>('/public/beta-mode')
      .then(r => setBetaMode(r.data.betaMode))
      .catch(() => setBetaMode(false))
  }, [])

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await activate(licenseKey)
      setSuccess(true)
      setTimeout(() => window.location.href = '/dashboard', 1500)
    } catch {}
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={48} className="text-emerald-400" />
          <p className="text-slate-200 font-semibold">활성화 완료!</p>
          <p className="text-xs text-slate-400">잠시 후 대시보드로 이동합니다...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12 animate-fade-in">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-4">
            <span className="text-3xl">🍓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">딸기셀</h1>
          <p className="text-sm text-slate-400 mt-1">이용할 플랜을 선택해주세요</p>
          {betaMode && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 font-semibold">
              <Zap size={12} />
              베타 기간 — 모든 플랜 무료
            </div>
          )}
        </div>

        {/* 기간 선택 (무료 플랜 아닐 때) */}
        {selectedPlan !== 'free' && (
          <div className="flex justify-center gap-2 mb-6">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  duration === d.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-card border border-dark-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* 플랜 카드 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {PLANS.map(plan => {
            const Icon    = plan.icon
            const price   = plan.prices[duration]
            const active  = selectedPlan === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative flex flex-col gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                  active
                    ? `${plan.bg} ${plan.border} ring-2 ring-offset-2 ring-offset-dark-bg ${plan.border.replace('border-', 'ring-')}`
                    : 'bg-dark-card border-dark-border hover:border-slate-600'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                    인기
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl ${plan.bg} border ${plan.border} flex items-center justify-center`}>
                  <Icon size={18} className={plan.color} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${plan.color}`}>{plan.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{plan.desc}</p>
                </div>
                <div>
                  {betaMode || plan.free ? (
                    <p className="text-lg font-bold text-emerald-400">무료</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-slate-100">{formatPrice(price)}</p>
                      {duration !== '1' && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{formatPrice(plan.prices['1'])}/월 × {duration}개월</p>
                      )}
                    </>
                  )}
                </div>
                <ul className="space-y-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* 결제 버튼 */}
        <div className="max-w-sm mx-auto space-y-3">
          {selectedPlan === 'free' ? (
            <button
              onClick={() => { activate('FREE'); setTimeout(() => window.location.href = '/dashboard', 500) }}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-dark-card border border-dark-border text-slate-200 hover:bg-dark-hover transition-all"
            >
              무료로 시작하기
            </button>
          ) : betaMode ? (
            <button
              onClick={() => setShowKeyInput(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/25"
            >
              베타 무료로 시작하기
            </button>
          ) : (
            <button
              disabled
              className="w-full py-3 rounded-xl text-sm font-semibold bg-primary-500/50 text-white/50 cursor-not-allowed"
            >
              결제하기 (준비중)
            </button>
          )}

          {/* 키 직접 입력 */}
          <button
            onClick={() => setShowKeyInput(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Key size={12} />
            이미 라이선스 키가 있으신가요?
            {showKeyInput ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showKeyInput && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-fade-in">
              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
                  <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
              <form onSubmit={handleKeySubmit} className="flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={e => { setLicenseKey(e.target.value); clearError() }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                  className="flex-1 px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all disabled:opacity-60"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                  활성화
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <button onClick={() => logout()} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
