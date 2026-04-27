import { useEffect } from 'react'
import { Download, CheckCircle2, AlertCircle, X, RotateCw } from 'lucide-react'
import { useUpdateStore } from '../stores/updateStore'

function formatBytes(b?: number): string {
  if (!b) return ''
  const mb = b / (1024 * 1024)
  return `${mb.toFixed(1)}MB`
}

export function UpdateToast() {
  const { status, version, progress, transferred, total, error, dismissed, dismiss, installNow, openManualDownload } = useUpdateStore()

  useEffect(() => {
    const setStatus = useUpdateStore.getState().setStatus
    const off = window.electron?.updater?.onStatus?.(setStatus)
    return () => { off?.() }
  }, [])

  // 표시 조건: idle/checking 은 숨김, dismissed면 숨김
  if (dismissed) return null
  if (status === 'idle' || status === 'checking') return null

  // 다운로드 중
  if (status === 'downloading') {
    return (
      <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-primary-500/30 bg-dark-card shadow-2xl shadow-black/50 animate-fade-in overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center">
            <Download size={14} className="text-primary-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">새 버전 다운로드 중</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              v{version ?? ''} {transferred && total ? `· ${formatBytes(transferred)} / ${formatBytes(total)}` : ''}
            </p>
            {/* 진행률 바 */}
            <div className="mt-2 w-full h-1.5 rounded-full bg-dark-hover overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 text-right">{progress}%</p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            title="알림 닫기 (다운로드는 계속됨)"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  // 다운로드 완료 — 설치 대기
  if (status === 'ready') {
    return (
      <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-emerald-500/40 bg-dark-card shadow-2xl shadow-black/50 animate-fade-in overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">새 버전 준비 완료</p>
            <p className="text-[11px] text-slate-400 mt-0.5">v{version ?? ''} 가 다운로드됐어요. 지금 설치할까요?</p>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={installNow}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              >
                <RotateCw size={11} /> 지금 설치
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-colors"
              >
                나중에
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              설치하면 앱이 종료된 후 자동으로 새 버전이 실행돼요.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 에러 발생
  if (status === 'error') {
    return (
      <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-amber-500/40 bg-dark-card shadow-2xl shadow-black/50 animate-fade-in overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <AlertCircle size={14} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">자동업데이트 오류</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={error}>
              {error?.slice(0, 60) ?? '알 수 없는 오류'}
            </p>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={openManualDownload}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                <Download size={11} /> 수동 다운로드
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
