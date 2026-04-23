import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Loader2, Wifi, WifiOff, Pencil, Check, AlertCircle, Building2, ChevronDown, ChevronUp, Save, GripVertical } from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useBusinessStore, type MarketplaceConnection } from '../stores/businessStore'
import { AddBusinessModal } from '../components/businesses/AddBusinessModal'
import { AddConnectionModal } from '../components/businesses/AddConnectionModal'
import { MarketplaceBadge } from '../components/businesses/MarketplaceBadge'
import { CoupangOpenapiGuide } from '../components/CoupangOpenapiGuide'
import { api } from '../api/client'

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

interface ConnEdit { displayName: string; vendorId: string; accessKey: string; secretKey: string }

// ─── 드래그 가능한 카드 래퍼 ─────────────────────────────────────────────────
function SortableConnCard({
  conn,
  isOpen,
  saved,
  status,
  testError,
  connEdit,
  savingConn,
  onExpand,
  onTest,
  onSave,
  onCancel,
  onDelete,
  onEditChange,
  onTestReset,
}: {
  conn:         MarketplaceConnection
  isOpen:       boolean
  saved:        'ok' | 'fail' | undefined
  status:       TestStatus
  testError:    string | undefined
  connEdit:     ConnEdit
  savingConn:   boolean
  onExpand:     () => void
  onTest:       () => void
  onSave:       () => void
  onCancel:     () => void
  onDelete:     () => void
  onEditChange: (patch: Partial<ConnEdit>) => void
  onTestReset:  () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: conn.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl bg-dark-card border transition-all ${
        isDragging ? 'opacity-60 shadow-2xl scale-[1.01]' :
        isOpen     ? 'border-primary-500/40' : 'border-dark-border hover:border-slate-600'
      }`}
    >
      {/* 카드 헤더 */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none p-0.5"
          tabIndex={-1}
        >
          <GripVertical size={15} />
        </button>

        <div className="shrink-0">
          <MarketplaceBadge marketplace={conn.marketplace} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 font-mono">
            {conn.marketplace === 'smartstore'
              ? (conn.hasAccessKey ? 'Client ID 등록됨' : 'Client ID 없음')
              : (conn.vendorId ?? '업체코드 없음')}
          </p>
        </div>

        {/* 테스트 버튼 */}
        <div className="shrink-0">
          {status === 'testing' ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 bg-dark-hover">
              <Loader2 size={12} className="animate-spin" /> 테스트 중
            </span>
          ) : status === 'ok' ? (
            <button onClick={onTestReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all">
              <Wifi size={12} /> 연결됨
            </button>
          ) : status === 'fail' ? (
            <div className="flex flex-col items-end gap-1">
              <button onClick={onTest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all">
                <WifiOff size={12} /> 안됨 (재시도)
              </button>
              {testError && (
                <span className="text-[10px] text-red-400/80 max-w-[180px] text-right leading-tight">{testError}</span>
              )}
            </div>
          ) : (
            <button onClick={onTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 transition-all">
              연결 테스트
            </button>
          )}
        </div>

        {/* 편집 토글 */}
        <button
          onClick={onExpand}
          className={`shrink-0 p-1.5 rounded-lg transition-colors ${isOpen ? 'text-primary-400 bg-primary-500/10' : 'text-slate-500 hover:text-slate-300'}`}
          title="키 편집"
        >
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* 삭제 */}
        <button
          onClick={onDelete}
          className="shrink-0 text-slate-600 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 저장 결과 */}
      {saved === 'ok' && (
        <div className="mx-5 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          <Check size={12} /> 저장되었습니다
        </div>
      )}
      {saved === 'fail' && (
        <div className="mx-5 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> 저장 실패 — 서버 연결을 확인해주세요
        </div>
      )}

      {/* 키 편집 패널 */}
      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-primary-500/15 space-y-3 animate-fade-in">
          {conn.marketplace === 'coupang' && (
            <>
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-3">
                <CoupangOpenapiGuide />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">업체코드 (Vendor ID)</label>
                <input
                  type="text"
                  value={connEdit.vendorId}
                  onChange={e => onEditChange({ vendorId: e.target.value })}
                  placeholder="A00000000"
                  className="w-full px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {conn.marketplace === 'smartstore' ? 'Client ID' : 'Access Key'}
            </label>
            <input
              type="text"
              autoComplete="off"
              value={connEdit.accessKey}
              onChange={e => onEditChange({ accessKey: e.target.value })}
              placeholder={conn.marketplace === 'smartstore' ? '네이버 커머스 API Client ID' : 'Access Key 입력'}
              className="w-full px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">
                {conn.marketplace === 'smartstore' ? 'Client Secret' : 'Secret Key'}
              </label>
              {conn.hasSecretKey && connEdit.secretKey === (conn.secretKeyMask ?? '') && (
                <span className="text-[10px] text-slate-500">변경하려면 새 키 입력</span>
              )}
            </div>
            <input
              type="text"
              autoComplete="off"
              value={connEdit.secretKey}
              onChange={e => onEditChange({ secretKey: e.target.value })}
              placeholder={conn.marketplace === 'smartstore' ? '네이버 커머스 API Client Secret' : 'Secret Key 입력'}
              className="w-full px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-all">
              취소
            </button>
            <button onClick={onSave} disabled={savingConn}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all disabled:opacity-50">
              {savingConn ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export function BusinessesPage() {
  const { businesses, isLoading, error, fetch, update, remove, removeConnection, testConnection } = useBusinessStore()
  const [activeId,      setActiveId]      = useState<string | null>(null)
  const [showAddBiz,    setShowAddBiz]    = useState(false)
  const [showAddConn,   setShowAddConn]   = useState(false)
  const [testStatus,    setTestStatus]    = useState<Record<string, TestStatus>>(() => {
    try { return JSON.parse(localStorage.getItem('conn-test-status') ?? '{}') } catch { return {} }
  })
  const [testError,     setTestError]     = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('conn-test-error') ?? '{}') } catch { return {} }
  })
  const [editingBizId,  setEditingBizId]  = useState<string | null>(null)
  const [editName,      setEditName]      = useState('')
  const [expandedConn,  setExpandedConn]  = useState<string | null>(null)
  const [connEdit,      setConnEdit]      = useState<ConnEdit>({ displayName: '', vendorId: '', accessKey: '', secretKey: '' })
  const [savingConn,    setSavingConn]    = useState(false)
  const [saveResult,    setSaveResult]    = useState<Record<string, 'ok' | 'fail'>>({})
  const [connOrder,     setConnOrder]     = useState<string[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { fetch() }, [])

  // 사업자 로드 후 첫 번째 탭 자동 선택
  useEffect(() => {
    if (businesses.length > 0 && !activeId) {
      setActiveId(businesses[0].id)
    }
  }, [businesses])

  // 온보딩 체크리스트 deep-link 처리
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const action = params.get('action')
    if (!action) return

    if (action === 'add-business') {
      setShowAddBiz(true)
    } else if (action === 'add-connection') {
      if (businesses.length === 0) {
        setShowAddBiz(true)
      } else {
        if (!activeId) setActiveId(businesses[0].id)
        setShowAddConn(true)
      }
    }
    navigate('/businesses', { replace: true })
  }, [location.search, businesses.length])

  const activeBusiness = businesses.find(b => b.id === activeId) ?? null

  // 탭 전환 또는 서버 데이터 갱신 시 순서 초기화
  useEffect(() => {
    if (activeBusiness) {
      setConnOrder(activeBusiness.connections.map(c => c.id))
    }
  }, [activeId, activeBusiness?.connections.length])

  // 현재 순서에 맞게 연동 목록 정렬
  const orderedConns = connOrder
    .map(id => activeBusiness?.connections.find(c => c.id === id))
    .filter((c): c is MarketplaceConnection => !!c)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !activeId) return
    const oldIndex = connOrder.indexOf(String(active.id))
    const newIndex = connOrder.indexOf(String(over.id))
    const newOrder = arrayMove(connOrder, oldIndex, newIndex)
    setConnOrder(newOrder)
    try {
      await api.put(`/businesses/${activeId}/connections/order`, { ids: newOrder })
    } catch {
      setConnOrder(connOrder) // 실패 시 원복
    }
  }

  const handleExpandConn = (conn: MarketplaceConnection) => {
    if (expandedConn === conn.id) { setExpandedConn(null); return }
    setExpandedConn(conn.id)
    setConnEdit({
      displayName: conn.displayName ?? '',
      vendorId:    conn.vendorId    ?? '',
      accessKey:   conn.accessKey   ?? '',
      secretKey:   conn.secretKeyMask ?? '',
    })
  }

  const handleSaveConn = async (connId: string) => {
    if (!activeId) return
    const conn = activeBusiness?.connections.find(c => c.id === connId)
    setSavingConn(true)
    setSaveResult(r => ({ ...r, [connId]: undefined as any }))
    try {
      const payload: Record<string, string> = {
        displayName: connEdit.displayName,
        vendorId:    connEdit.vendorId,
        accessKey:   connEdit.accessKey,
      }
      if (connEdit.secretKey && connEdit.secretKey !== (conn?.secretKeyMask ?? '')) {
        payload.secretKey = connEdit.secretKey
      }
      await api.patch(`/businesses/${activeId}/connections/${connId}`, payload)
      await fetch()
      setSaveResult(r => ({ ...r, [connId]: 'ok' }))
      setTimeout(() => setSaveResult(r => ({ ...r, [connId]: undefined as any })), 3000)
      setExpandedConn(null)
    } catch {
      setSaveResult(r => ({ ...r, [connId]: 'fail' }))
    } finally {
      setSavingConn(false)
    }
  }

  const handleTest = async (connId: string) => {
    if (!activeId) return
    setTestStatus(s => ({ ...s, [connId]: 'testing' }))
    setTestError(s => { const n = { ...s }; delete n[connId]; return n })
    try {
      const res = await testConnection(activeId, connId)
      setTestStatus(s => {
        const next = { ...s, [connId]: res.ok ? 'ok' as TestStatus : 'fail' as TestStatus }
        localStorage.setItem('conn-test-status', JSON.stringify(next))
        return next
      })
      if (!res.ok && res.message) {
        setTestError(s => {
          const next = { ...s, [connId]: res.message }
          localStorage.setItem('conn-test-error', JSON.stringify(next))
          return next
        })
      }
    } catch (err: any) {
      setTestStatus(s => {
        const next = { ...s, [connId]: 'fail' as TestStatus }
        localStorage.setItem('conn-test-status', JSON.stringify(next))
        return next
      })
      setTestError(s => {
        const next = { ...s, [connId]: err?.message ?? '알 수 없는 오류' }
        localStorage.setItem('conn-test-error', JSON.stringify(next))
        return next
      })
    }
  }

  const handleSaveName = async (id: string) => {
    if (!editName.trim()) return
    await update(id, editName.trim())
    setEditingBizId(null)
  }

  const handleDeleteBiz = async (id: string, name: string) => {
    if (!confirm(`"${name}" 사업자를 삭제하시겠습니까?\n연동된 마켓 정보도 모두 삭제됩니다.`)) return
    await remove(id)
    setActiveId(businesses.find(b => b.id !== id)?.id ?? null)
  }

  return (
    <div className="flex flex-col h-full bg-dark-bg dark:bg-dark-bg bg-gray-50">

      {/* 페이지 헤더 */}
      <div className="px-6 pt-6 pb-3">
        <h1 className="text-xl font-bold text-slate-100">사업자 관리</h1>
        <p className="text-xs text-slate-500 mt-0.5">사업자별 쇼핑몰 연동을 관리합니다</p>
      </div>

      {error && (
        <div className="mx-6 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* 탭 바 */}
      <div className="flex items-end gap-1 px-6 border-b border-dark-border dark:border-dark-border border-gray-200">
        {isLoading && businesses.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
            <Loader2 size={13} className="animate-spin" /> 불러오는 중...
          </div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 w-full">
            <Building2 size={32} className="text-slate-600" />
            <p className="text-sm text-slate-400">등록된 사업자가 없습니다</p>
            <button
              onClick={() => setShowAddBiz(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all"
            >
              <Plus size={14} /> 첫 사업자 추가하기
            </button>
          </div>
        ) : (
          <>
            {businesses.map(biz => (
              <button
                key={biz.id}
                onClick={() => setActiveId(biz.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium
                  border border-b-0 transition-all duration-150 min-w-[100px] max-w-[160px]
                  ${activeId === biz.id
                    ? 'bg-dark-card dark:bg-dark-card bg-white border-dark-border dark:border-dark-border border-gray-200 text-slate-100 shadow-sm -mb-px z-10'
                    : 'bg-dark-hover/40 border-transparent text-slate-500 hover:text-slate-300 hover:bg-dark-hover/70'}
                `}
              >
                <span className="truncate">{biz.name}</span>
                {biz.connections.length > 0 && (
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium
                    ${activeId === biz.id ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-700 text-slate-400'}`}>
                    {biz.connections.length}
                  </span>
                )}
              </button>
            ))}

            {/* + 사업자 추가 탭 */}
            <button
              onClick={() => setShowAddBiz(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl text-xs text-slate-600 hover:text-primary-400 hover:bg-primary-500/5 border border-transparent transition-all"
            >
              <Plus size={13} /> 추가
            </button>
          </>
        )}
      </div>

      {/* 탭 콘텐츠 */}
      {activeBusiness && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">

            {/* 사업자 이름 + 편집 + 삭제 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingBizId === activeBusiness.id ? (
                  <>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(activeBusiness.id); if (e.key === 'Escape') setEditingBizId(null) }}
                      className="px-2.5 py-1.5 rounded-lg text-sm bg-dark-hover border border-primary-500/50 text-slate-100 focus:outline-none"
                    />
                    <button onClick={() => handleSaveName(activeBusiness.id)} className="px-3 py-1 rounded-lg text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all">저장</button>
                    <button onClick={() => setEditingBizId(null)} className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-all">취소</button>
                  </>
                ) : (
                  <>
                    <span className="text-base font-semibold text-slate-100">{activeBusiness.name}</span>
                    <button
                      onClick={() => { setEditingBizId(activeBusiness.id); setEditName(activeBusiness.name) }}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => handleDeleteBiz(activeBusiness.id, activeBusiness.name)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <Trash2 size={13} /> 사업자 삭제
              </button>
            </div>

            {/* 연동 목록 */}
            {activeBusiness.connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-dark-border">
                <p className="text-sm text-slate-500">연동된 마켓이 없습니다</p>
                <button
                  onClick={() => setShowAddConn(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 transition-all"
                >
                  <Plus size={13} /> 마켓 연동 추가
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={connOrder} strategy={verticalListSortingStrategy}>
                    {orderedConns.map(conn => (
                      <SortableConnCard
                        key={conn.id}
                        conn={conn}
                        isOpen={expandedConn === conn.id}
                        saved={saveResult[conn.id]}
                        status={testStatus[conn.id] ?? 'idle'}
                        testError={testError[conn.id]}
                        connEdit={connEdit}
                        savingConn={savingConn}
                        onExpand={() => handleExpandConn(conn)}
                        onTest={() => handleTest(conn.id)}
                        onSave={() => handleSaveConn(conn.id)}
                        onCancel={() => setExpandedConn(null)}
                        onDelete={() => { if (confirm('이 연동을 삭제하시겠습니까?')) removeConnection(activeBusiness.id, conn.id) }}
                        onEditChange={patch => setConnEdit(v => ({ ...v, ...patch }))}
                        onTestReset={() => setTestStatus(s => ({ ...s, [conn.id]: 'idle' }))}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* 연동 추가 버튼 */}
                <button
                  onClick={() => setShowAddConn(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm text-slate-500 border border-dashed border-dark-border hover:border-primary-500/40 hover:text-primary-400 hover:bg-primary-500/5 transition-all"
                >
                  <Plus size={14} /> 마켓 연동 추가
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddBiz  && <AddBusinessModal onClose={() => setShowAddBiz(false)} />}
      {showAddConn && activeBusiness && (
        <AddConnectionModal businessId={activeBusiness.id} onClose={() => setShowAddConn(false)} />
      )}
    </div>
  )
}
