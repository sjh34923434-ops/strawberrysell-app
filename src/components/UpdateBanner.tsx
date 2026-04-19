import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'

export function UpdateBanner() {
  const [status, setStatus] = useState<'idle' | 'available' | 'downloaded'>('idle')

  useEffect(() => {
    if (!window.electron?.updater) return
    window.electron.updater.onUpdateAvailable(() => setStatus('available'))
    window.electron.updater.onUpdateDownloaded(() => setStatus('downloaded'))
  }, [])

  if (status === 'idle') return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5 text-sm font-medium shadow-lg
      ${status === 'downloaded'
        ? 'bg-primary-500 text-white'
        : 'bg-amber-500/90 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        {status === 'downloaded' ? <Download size={15} /> : <RefreshCw size={15} className="animate-spin" />}
        {status === 'downloaded'
          ? '새 버전 다운로드 완료! 지금 업데이트하시겠습니까?'
          : '새 버전을 다운로드 중입니다...'}
      </div>
      {status === 'downloaded' && (
        <button
          onClick={() => window.electron.updater.installUpdate()}
          className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold"
        >
          지금 재시작
        </button>
      )}
    </div>
  )
}
