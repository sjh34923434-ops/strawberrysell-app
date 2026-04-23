import { useEffect, useState } from 'react'
import { Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { appSettingsApi, type CoupangOpenapiInfo } from '../api/client'

interface CoupangOpenapiGuideProps {
  compact?: boolean
}

export function CoupangOpenapiGuide({ compact = false }: CoupangOpenapiGuideProps) {
  const [info, setInfo]       = useState<CoupangOpenapiInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState<string | null>(null)

  useEffect(() => {
    appSettingsApi.getCoupangOpenapi()
      .then(setInfo)
      .catch(() => setInfo({ name: '딸기셀', url: 'https://fly.io/apps/strawberrysell-server', ip: '209.71.88.96' }))
      .finally(() => setLoading(false))
  }, [])

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // 무시
    }
  }

  if (loading || !info) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Loader2 size={12} className="animate-spin" /> 불러오는 중...
      </div>
    )
  }

  const FIELDS: Array<{ key: keyof CoupangOpenapiInfo; label: string; mono?: boolean }> = [
    { key: 'name', label: '이름' },
    { key: 'url',  label: '주소 URL' },
    { key: 'ip',   label: 'IP 주소', mono: true },
  ]

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-300">쿠팡 WING OpenAPI 발급 가이드</p>
          <p className="text-xs text-slate-400">
            WING → 판매자정보 → 추가판매정보 → <span className="text-slate-300 font-medium">Open API 확인</span> → 발급 →
            <span className="text-slate-300 font-medium"> 자체개발</span> 선택 후 아래 3개 값을 복사·붙여넣기 하세요.
          </p>
          <a
            href="https://wing.coupang.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
          >
            쿠팡 WING 열기 <ExternalLink size={10} />
          </a>
        </div>
      )}

      <div className="space-y-1.5">
        {FIELDS.map(({ key, label, mono }) => (
          <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 w-20 shrink-0">{label}</span>
            <span className={`flex-1 text-xs text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>
              {info[key]}
            </span>
            <button
              onClick={() => copy(key, info[key])}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                copied === key
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600'
              }`}
            >
              {copied === key ? <><Check size={11} /> 복사됨</> : <><Copy size={11} /> 복사</>}
            </button>
          </div>
        ))}
      </div>

      {!compact && (
        <p className="text-[11px] text-slate-500">
          ※ IP 주소는 "접속 허용 IP" 항목에 등록해주세요. 승인까지 보통 1영업일 소요됩니다.
        </p>
      )}
    </div>
  )
}
