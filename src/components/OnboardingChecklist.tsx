import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ArrowRight, ChevronDown, X } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { useBusinessStore } from '../stores/businessStore'

const DISMISSED_KEY = 'onboarding-dismissed'

export function OnboardingChecklist() {
  const navigate = useNavigate()
  const { coupangPartners } = useSettingsStore()
  const { businesses }      = useBusinessStore()
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISSED_KEY))

  const hasPartner    = coupangPartners.length > 0
  const hasB2b        = coupangPartners.some(p => p.b2bFileData)
  const hasMapping    = coupangPartners.some(p => p.b2bHeaders.length > 0 && Object.keys(p.mapping ?? {}).length > 0)
  const hasConnection = businesses.some(b => b.connections?.length > 0)

  const steps = [
    { label: '거래처 등록',          done: hasPartner,    desc: '거래처관리에서 거래처를 추가하세요',              path: '/b2b-partners' },
    { label: 'B2B 양식 등록',        done: hasB2b,        desc: '거래처에 B2B 주문양식 파일을 등록하세요',         path: '/b2b-partners' },
    { label: '컬럼 매핑 완료',       done: hasMapping,    desc: '마켓별 컬럼 매핑을 설정하세요',                   path: '/b2b-partners' },
    { label: '마켓 API 연동',         done: hasConnection, desc: '사업자관리에서 쿠팡/스마트스토어를 연동하세요',   path: '/businesses'   },
  ]

  const doneCount = steps.filter(s => s.done).length
  const allDone   = doneCount === steps.length

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className={`bg-dark-card border rounded-2xl overflow-hidden transition-all ${
      allDone ? 'border-emerald-500/30' : 'border-primary-500/30'
    }`}>
      {/* 헤더 */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-dark-hover transition-colors"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          allDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary-500/20 text-primary-400'
        }`}>
          {doneCount}/{steps.length}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${allDone ? 'text-emerald-400' : 'text-slate-200'}`}>
            {allDone ? '✅ 초기 설정 완료!' : '🚀 시작 전 초기 설정을 완료해주세요'}
          </p>
          {!allDone && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 bg-dark-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${(doneCount / steps.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{Math.round((doneCount / steps.length) * 100)}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {allDone && (
            <button onClick={e => { e.stopPropagation(); handleDismiss() }}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={15} className={`text-slate-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </div>

      {/* 스텝 목록 */}
      {!collapsed && (
        <div className="px-5 pb-4 space-y-2">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => !step.done && navigate(step.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                ${step.done
                  ? 'border-emerald-500/20 bg-emerald-500/5 cursor-default'
                  : 'border-dark-border bg-dark-hover hover:border-primary-500/40 hover:bg-primary-500/5'
                }`}
            >
              {step.done
                ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                : <Circle size={16} className="text-slate-600 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${step.done ? 'text-emerald-400 line-through opacity-60' : 'text-slate-200'}`}>
                  {step.label}
                </p>
                {!step.done && <p className="text-[11px] text-slate-500 mt-0.5">{step.desc}</p>}
              </div>
              {!step.done && <ArrowRight size={13} className="text-slate-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
