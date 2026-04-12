import { useState } from 'react'
import { X, Loader2, CheckCircle2, XCircle, Plug } from 'lucide-react'
import { useBusinessStore, type ConnectionInput } from '../../stores/businessStore'

interface Props { businessId: string; onClose: () => void }

const MARKETPLACES = [
  { id: 'coupang',    label: '쿠팡',        apiReady: true  },
  { id: 'smartstore', label: '스마트스토어', apiReady: false },
  { id: '11st',       label: '11번가',      apiReady: false },
  { id: 'auction',    label: '옥션',        apiReady: false },
  { id: 'gmarket',    label: '지마켓',      apiReady: false },
  { id: 'etc',        label: '기타',        apiReady: false },
]

export function AddConnectionModal({ businessId, onClose }: Props) {
  const { addConnection, testConnection } = useBusinessStore()
  const [selected,    setSelected]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accessKey,   setAccessKey]   = useState('')
  const [secretKey,   setSecretKey]   = useState('')
  const [vendorId,    setVendorId]    = useState('')
  const [isLoading,   setIsLoading]   = useState(false)
  const [isTesting,   setIsTesting]   = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; message: string } | null>(null)
  const [error,       setError]       = useState('')

  const handleTest = async () => {
    if (!accessKey || !secretKey || !vendorId) {
      setError('API 키와 업체코드를 먼저 입력해주세요.')
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      // 임시로 연동 추가 후 테스트
      const { data } = await import('../../api/client').then(m =>
        m.api.post<{ ok: boolean; message: string }>(`/businesses/${businessId}/connections/test-keys`, {
          marketplace: selected, accessKey, secretKey, vendorId
        })
      )
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, message: '연결 테스트 실패' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError('마켓플레이스를 선택해주세요.'); return }
    setIsLoading(true)
    setError('')
    try {
      const autoName = MARKETPLACES.find(m => m.id === selected)?.label ?? selected
      const input: ConnectionInput = { marketplace: selected, displayName: autoName, accessKey, secretKey, vendorId }
      await addConnection(businessId, input)
      onClose()
    } catch {
      setError('연동 추가에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Plug size={16} className="text-primary-400" />
            <h3 className="text-sm font-semibold text-slate-100">마켓 연동 추가</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 마켓 선택 */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">마켓플레이스 선택</label>
            <div className="grid grid-cols-3 gap-2">
              {MARKETPLACES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`relative py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                    selected === m.id
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                      : 'bg-dark-hover border-dark-border text-slate-300 hover:border-primary-500/30'
                  }`}
                >
                  {m.label}
                  {!m.apiReady && (
                    <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-slate-700 text-slate-500 px-1 rounded">API준비중</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 공통 입력 폼 */}
          {selected && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">업체코드 (Vendor ID)</label>
                <input type="text" value={vendorId} onChange={e => setVendorId(e.target.value)}
                  placeholder="A00000000"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Access Key</label>
                <input type="text" value={accessKey} onChange={e => setAccessKey(e.target.value)}
                  placeholder="API Access Key"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Secret Key</label>
                <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)}
                  placeholder="API Secret Key"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono" />
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  testResult.ok ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {testResult.message}
                </div>
              )}
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-all">
              취소
            </button>
            <button type="submit" disabled={isLoading || !selected}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all disabled:opacity-60">
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              연동 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
