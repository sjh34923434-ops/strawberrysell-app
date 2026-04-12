import { useState } from 'react'
import { Trash2, Plus, ChevronDown, ChevronUp, Pencil, Check, X, Loader2, Wifi, WifiOff } from 'lucide-react'
import { useBusinessStore, type Business } from '../../stores/businessStore'
import { MarketplaceBadge } from './MarketplaceBadge'
import { AddConnectionModal } from './AddConnectionModal'

interface Props { business: Business }

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

export function BusinessCard({ business }: Props) {
  const { remove, update, removeConnection, testConnection } = useBusinessStore()
  const [expanded,       setExpanded]       = useState(false)
  const [showAddConn,    setShowAddConn]    = useState(false)
  const [isEditing,      setIsEditing]      = useState(false)
  const [editName,       setEditName]       = useState(business.name)
  const [testStatus,     setTestStatus]     = useState<Record<string, TestStatus>>({})

  const handleTest = async (connId: string) => {
    setTestStatus(s => ({ ...s, [connId]: 'testing' }))
    try {
      const res = await testConnection(business.id, connId)
      setTestStatus(s => ({ ...s, [connId]: res.ok ? 'ok' : 'fail' }))
    } catch {
      setTestStatus(s => ({ ...s, [connId]: 'fail' }))
    }
  }

  const handleSaveName = async () => {
    if (!editName.trim()) return
    await update(business.id, editName.trim())
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`"${business.name}" 사업자를 삭제하시겠습니까?\n연동된 마켓 정보도 모두 삭제됩니다.`)) return
    await remove(business.id)
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary-400">
              {business.name.charAt(0).toUpperCase()}
            </span>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditing(false) }}
                autoFocus
                className="flex-1 px-2 py-1 rounded-lg text-sm bg-dark-hover border border-primary-500/50 text-slate-100 focus:outline-none"
              />
              <button onClick={handleSaveName} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
              <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-slate-100 truncate">{business.name}</span>
              <button onClick={() => { setIsEditing(true); setEditName(business.name) }}
                className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-3">
          {/* 연동 배지들 */}
          <div className="flex items-center gap-1">
            {business.connections.slice(0, 3).map(c => (
              <MarketplaceBadge key={c.id} marketplace={c.marketplace} />
            ))}
            {business.connections.length > 3 && (
              <span className="text-[10px] text-slate-500">+{business.connections.length - 3}</span>
            )}
          </div>

          <button onClick={() => setShowAddConn(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 border border-dark-border hover:border-primary-500/30 transition-all">
            <Plus size={11} /> 연동
          </button>

          <button onClick={handleDelete}
            className="text-slate-600 hover:text-red-400 transition-colors p-1">
            <Trash2 size={13} />
          </button>

          <button onClick={() => setExpanded(v => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 연동 목록 */}
      {expanded && (
        <div className="border-t border-dark-border">
          {business.connections.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-slate-500">연동된 마켓이 없습니다</p>
              <button onClick={() => setShowAddConn(true)}
                className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition-colors">
                + 마켓 연동 추가
              </button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dark-border/50">
                  <th className="text-left px-5 py-2.5 text-slate-500 font-medium">마켓</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">별칭</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">업체코드</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">상태</th>
                  <th className="text-center px-4 py-2.5 text-slate-500 font-medium">연결 테스트</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {business.connections.map(conn => (
                  <tr key={conn.id} className="border-b border-dark-border/30 hover:bg-dark-hover/30 transition-colors">
                    <td className="px-5 py-3">
                      <MarketplaceBadge marketplace={conn.marketplace} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{conn.displayName ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{conn.vendorId ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        conn.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {conn.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {testStatus[conn.id] === 'testing' ? (
                        <span className="flex items-center justify-center gap-1 text-slate-400">
                          <Loader2 size={11} className="animate-spin" />
                          <span className="text-[10px]">테스트 중</span>
                        </span>
                      ) : testStatus[conn.id] === 'ok' ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-400">
                          <Wifi size={11} />
                          <span className="text-[10px] font-medium">연결됨</span>
                        </span>
                      ) : testStatus[conn.id] === 'fail' ? (
                        <span className="flex items-center justify-center gap-1 text-red-400">
                          <WifiOff size={11} />
                          <span className="text-[10px] font-medium">안됨</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleTest(conn.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 transition-all"
                        >
                          테스트
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm('이 연동을 삭제하시겠습니까?')) removeConnection(business.id, conn.id) }}
                        className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAddConn && (
        <AddConnectionModal businessId={business.id} onClose={() => setShowAddConn(false)} />
      )}
    </div>
  )
}
