import { useState } from 'react'
import { X, Building2, Loader2 } from 'lucide-react'
import { useBusinessStore } from '../../stores/businessStore'

interface Props { onClose: () => void }

export function AddBusinessModal({ onClose }: Props) {
  const { add } = useBusinessStore()
  const [name,      setName]      = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('사업자 이름을 입력해주세요.'); return }
    setIsLoading(true)
    try {
      await add(name.trim())
      onClose()
    } catch {
      setError('사업자 추가에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary-400" />
            <h3 className="text-sm font-semibold text-slate-100">사업자 추가</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">사업자 이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 메인 쇼핑몰, 부업 스토어"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-all">
              취소
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all disabled:opacity-60">
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
