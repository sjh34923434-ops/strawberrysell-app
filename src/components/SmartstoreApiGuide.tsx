import { useEffect, useState } from 'react'
import { Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { appSettingsApi } from '../api/client'

interface SmartstoreApiGuideProps {
  compact?: boolean
}

export function SmartstoreApiGuide({ compact = false }: SmartstoreApiGuideProps) {
  const [ip,      setIp]      = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState<string | null>(null)

  useEffect(() => {
    appSettingsApi.getCoupangOpenapi()
      .then(info => setIp(info.ip))
      .catch(() => setIp('209.71.88.96'))
      .finally(() => setLoading(false))
  }, [])

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* ignore */ }
  }

  if (loading || !ip) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Loader2 size={12} className="animate-spin" /> 불러오는 중...
      </div>
    )
  }

  const FIELDS: Array<{ key: string; label: string; value: string; mono?: boolean }> = [
    { key: 'name',        label: '애플리케이션 이름', value: '딸기셀' },
    { key: 'description', label: '설명',              value: '주문수집 프로그램' },
    { key: 'ip',          label: 'API 호출 IP',       value: ip, mono: true },
  ]

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-emerald-300">네이버 커머스 API 발급 가이드</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            commerce.naver.com 접속 → 로그인 → <span className="text-slate-300 font-medium">"내 스토어 애플리케이션"</span> →
            <span className="text-slate-300 font-medium"> 등록하기</span> → 아래 3개 값을 복사·붙여넣기 + API 그룹 체크 후 등록
          </p>
          <a
            href="https://commerce.naver.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
          >
            네이버 커머스 API 센터 열기 <ExternalLink size={10} />
          </a>
        </div>
      )}

      <div className="space-y-1.5">
        {FIELDS.map(({ key, label, value, mono }) => (
          <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 w-24 shrink-0">{label}</span>
            <span className={`flex-1 text-xs text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>
              {value}
            </span>
            <button
              onClick={() => copy(key, value)}
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
        <p className="text-[11px] text-slate-500 leading-relaxed">
          ※ <span className="text-slate-400">API 그룹</span>은 "주문 판매자" + "상품 판매자" 체크 (필요 시 추가).<br />
          ※ 등록 후 발급되는 <span className="text-slate-400">Client ID + Client Secret</span>을 아래 입력란에 붙여넣기.
        </p>
      )}
    </div>
  )
}
