import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, AlertCircle,
  CheckCircle2, Loader2, Download,
  RotateCcw, Package, RefreshCw, Building2,
  FileSpreadsheet, Users,
  Truck,
  FolderOpen,
  Tag, Plus,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useBusinessStore } from '../stores/businessStore'
import { useSettingsStore } from '../stores/settingsStore'
import { coupangApi } from '../api/client'
import { InvoiceMatchTab } from '../components/InvoiceMatchTab'


// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Tab  = 'match' | 'invoice'
type Step = 1 | 2 | 3

const STEPS = [
  { num: 1, label: '주문 가져오기' },
  { num: 3, label: '결과 다운로드' },
] as const

const ORDER_STATUSES = [
  { value: 'ALL',        label: '전체' },
  { value: 'ACCEPT',     label: '신규주문' },
  { value: 'INSTRUCT',   label: '상품준비중' },
  { value: 'DEPARTURE',  label: '배송지시' },
  { value: 'DELIVERING', label: '배송중' },
  { value: 'FINAL_DELIVERY', label: '배송완료' },
] as const

const CARRIER_MAP: Record<string, string> = {
  'CJ대한통운': 'CJGLS',
  '한진택배':   'HANJIN',
  '롯데택배':   'LOTTE',
  '우체국택배': 'EPOST',
  '로젠택배':   'KGB',
  '경동택배':   'KDEXP',
  '대신택배':   'DAESIN',
  '일양택배':   'ILYANG',
  '천일택배':   'CHUNIL',
}

const RECOMMENDED_CLASSIFY_COLS = ['업체상품코드', '등록상품명', '옵션ID']

// ─── 단계 인디케이터 ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map(({ num, label }, i) => {
        const done   = current > num
        const active = current === num
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                transition-all duration-300
                ${done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-primary-500 text-white ring-4 ring-primary-500/25'
                :          'bg-dark-hover text-slate-500'}
              `}>
                {done ? <CheckCircle2 size={14} /> : num}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap
                ${active ? 'text-primary-400' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-px mb-5 mx-1 transition-colors duration-300
                ${current > num ? 'bg-emerald-500/50' : 'bg-dark-border'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export function CoupangAutoPage() {
  const navigate = useNavigate()
  const { businesses, isLoading: bizLoading, fetch: fetchBiz } = useBusinessStore()
  const {
    multiMatchConfigs,
    coupangPartners, saveOrder, savedOrders,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<Tab>('match')

  // ── 주문 매칭 상태 ──────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<Step>(1)
  const [selectedBizId,  setSelectedBizId]  = useState<string>('')
  const [selectedConnId, setSelectedConnId] = useState<string>('')
  const [orderStatus,    setOrderStatus]    = useState<string>('ALL')
  const [startDate,      setStartDate]      = useState<string>(() => new Date().toISOString().split('T')[0])
  const [endDate,        setEndDate]        = useState<string>(() => new Date().toISOString().split('T')[0])
  const [isFetching,     setIsFetching]     = useState(false)
  const [fetchProgress,  setFetchProgress]  = useState(0)
  const [fetchedOrders,  setFetchedOrders]  = useState<any[] | null>(null)
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [classifyColumn,   setClassifyColumn]   = useState<string>('업체상품코드')
  const [isMatching,       setIsMatching]        = useState(false)
  const [matchResult,      setMatchResult]       = useState<Record<string, any[]>>({})
  const [showOrderList,    setShowOrderList]     = useState(false)



  useEffect(() => { fetchBiz() }, [])

  const coupangBizList = businesses.map(b => ({
    ...b,
    coupangConns: b.connections.filter(c => c.marketplace === 'coupang'),
  })).filter(b => b.coupangConns.length > 0)

  const availablePartners = coupangPartners.filter(p => p.b2bFileData)

  const handleBizChange = (bizId: string) => {
    setSelectedBizId(bizId)
    const biz = coupangBizList.find(b => b.id === bizId)
    setSelectedConnId(biz?.coupangConns[0]?.id ?? '')
    setFetchedOrders(null)
  }

  const canFetch = !!selectedConnId && !!startDate && !!endDate

  const handleFetch = async () => {
    if (!selectedBizId || !selectedConnId) return
    setIsFetching(true)
    setFetchedOrders(null)
    setFetchProgress(0)

    // 진행률 애니메이션 (API 응답 대기 중)
    const progressInterval = setInterval(() => {
      setFetchProgress(p => p < 85 ? p + 5 : p)
    }, 200)

    try {
      const result = await coupangApi.getOrders(selectedBizId, selectedConnId, startDate, endDate, orderStatus)
      clearInterval(progressInterval)
      setFetchProgress(100)
      await new Promise(r => setTimeout(r, 300))
      const orders = result.orders as any[]
      setFetchedOrders(orders)
      if (orders.length > 0) {
        saveOrder('coupang-api', Object.keys(orders[0]), orders as Record<string, unknown>[])
      }
    } catch (err: any) {
      clearInterval(progressInterval)
      setFetchProgress(0)
      alert(err.message || '주문 조회 중 오류가 발생했습니다.')
    } finally {
      setIsFetching(false)
    }
  }

  // ── 접두어 앞 2글자 기반 자동 매칭 (일괄매칭과 동일 로직) ──
  const handleMatch = async () => {
    setIsMatching(true)
    await new Promise(r => setTimeout(r, 300))

    if (!fetchedOrders) { setIsMatching(false); return }

    const result: Record<string, any[]> = {}

    for (const order of fetchedOrders) {
      const code = String((order as any)[classifyColumn] ?? '')
      const codeKey = code.slice(0, 2)
      const partner = coupangPartners.find(p => {
        const prefix = (p.prefix || p.partnerName).trim()
        return prefix && code.slice(0, 2) === prefix.slice(0, 2)
      })
      const key = partner ? partner.partnerName : '(미매칭)'
      if (!result[key]) result[key] = []
      result[key].push(order)
    }

    setMatchResult(result)
    setIsMatching(false)
    setStep(3)
  }

  const partnerSummary = fetchedOrders
    ? Object.entries(
        fetchedOrders.reduce((acc, o) => {
          const key = String((o as Record<string, unknown>)[classifyColumn] ?? '(없음)')
          if (!acc[key]) acc[key] = { count: 0, amount: 0 }
          acc[key].count  += o.수량
          acc[key].amount += o.금액
          return acc
        }, {} as Record<string, { count: number; amount: number }>)
      )
    : []

  const orderColumns    = fetchedOrders?.length ? Object.keys(fetchedOrders[0]) : []
  const recommendedCols = orderColumns.filter(c => RECOMMENDED_CLASSIFY_COLS.includes(c))
  const otherCols       = orderColumns.filter(c => !RECOMMENDED_CLASSIFY_COLS.includes(c))
  const today           = new Date().toISOString().split('T')[0]

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5 animate-fade-in">

        {/* 헤더 */}
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-400" />
            쿠팡 자동매칭
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            쿠팡 API로 주문을 가져와 거래처별로 자동 분류·출력합니다
          </p>
        </div>

        {/* ── 탭 ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-dark-card border border-dark-border">
          <button
            onClick={() => setActiveTab('match')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all
              ${activeTab === 'match'
                ? 'bg-primary-500/15 text-primary-300 border-primary-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
          >
            <ShoppingCart size={14} /> 주문 매칭
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all
              ${activeTab === 'invoice'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
          >
            <Truck size={14} /> 송장번호 추가
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            탭 1: 주문 매칭
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'match' && (
          <>
            <StepIndicator current={step} />

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-5">

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Building2 size={12} /> 사업자 선택
                    </label>
                    {bizLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <Loader2 size={13} className="animate-spin" /> 불러오는 중...
                      </div>
                    ) : coupangBizList.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        <AlertCircle size={13} />
                        쿠팡 연동된 사업자가 없습니다. 사업자 관리에서 쿠팡 API 키를 먼저 등록해주세요.
                      </div>
                    ) : (
                      <select
                        value={selectedBizId}
                        onChange={e => handleBizChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="">— 사업자를 선택하세요 —</option>
                        {coupangBizList.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                      주문 기간
                      <span className="text-slate-600 font-normal">오늘 날짜 수집 기본 적용됩니다.</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={startDate} max={today} onChange={e => setStartDate(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50" />
                      <span className="text-slate-500 text-xs">~</span>
                      <input type="date" value={endDate} max={today} onChange={e => setEndDate(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Package size={12} /> 주문 상태
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ORDER_STATUSES.map(({ value, label }) => (
                        <button key={value} onClick={() => setOrderStatus(value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                            ${orderStatus === value
                              ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                              : 'bg-dark-hover border-dark-border text-slate-400 hover:border-primary-500/30 hover:text-primary-400'
                            }`}
                        >{label}</button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-600"><span className="text-slate-400">상태 선택</span> 후 아래 <span className="text-slate-400">쿠팡 주문 가져오기</span> 버튼을 눌러주세요.</p>
                  </div>

                  {fetchedOrders !== null && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
                      <CheckCircle2 size={14} />
                      주문 <span className="font-bold">{fetchedOrders.length}건</span> 가져왔습니다
                    </div>
                  )}
                </div>

                <p className="text-xs text-center text-slate-400 bg-dark-hover border border-dark-border rounded-xl px-4 py-2.5">
                  💡 거래처관리에서 B2B 주문양식 컬럼 매핑을 완성해야 적용됩니다.
                </p>

                <button disabled={!canFetch || isFetching || coupangBizList.length === 0} onClick={handleFetch}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20">
                  {isFetching ? <><Loader2 size={15} className="animate-spin" /> 주문 가져오는 중...</> : <><RefreshCw size={15} /> 쿠팡 주문 가져오기</>}
                </button>

                {/* 진행률 바 */}
                {isFetching && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>쿠팡 주문 수집 중...</span>
                      <span className="font-mono text-orange-400">{fetchProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-dark-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${fetchProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 수집 완료 표시 */}
                {!isFetching && fetchProgress === 100 && fetchedOrders !== null && (
                  fetchedOrders.length > 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
                      <CheckCircle2 size={14} /> 수집 완료 — <span className="font-bold">{fetchedOrders.length}건</span> 주문이 수집되었습니다
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-sm text-slate-400">
                      <AlertCircle size={14} /> 해당 기간에 주문이 없습니다
                    </div>
                  )
                )}

                <button disabled={fetchedOrders === null || coupangPartners.length === 0 || isMatching}
                  onClick={handleMatch}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20">
                  {isMatching ? <><Loader2 size={14} className="animate-spin" /> 매칭 중...</> : '매칭 실행 →'}
                </button>
                <button onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                  ← 뒤로가기
                </button>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-dark-border bg-dark-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">가져온 주문 요약</p>
                    {fetchedOrders && fetchedOrders.length > 0 && (
                      <button
                        onClick={() => setShowOrderList(v => !v)}
                        className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        <Package size={12} />
                        {showOrderList ? '목록 닫기 ▲' : `주문 ${fetchedOrders.length}건 보기 ▼`}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">총 주문</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-100">{partnerSummary.length}</p>
                      <p className="text-xs text-slate-500">거래처 수</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.reduce((s, o) => s + o.수량, 0) ?? 0}</p>
                      <p className="text-xs text-slate-500">총 수량</p>
                    </div>
                  </div>

                  {/* 주문 목록 */}
                  {showOrderList && fetchedOrders && fetchedOrders.length > 0 && (
                    <div className="mt-1 rounded-xl border border-dark-border overflow-hidden">
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-dark-bg">
                            <tr>
                              {Object.keys(fetchedOrders[0]).map(col => (
                                <th key={col} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap border-b border-dark-border">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fetchedOrders.map((order, i) => (
                              <tr key={i} className={`border-b border-dark-border/50 ${i % 2 === 0 ? 'bg-dark-hover/30' : ''}`}>
                                {Object.values(order).map((val, j) => (
                                  <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                                    {String(val ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* 주문 전체 다운로드 */}
                <button
                  disabled={!fetchedOrders?.length}
                  onClick={() => {
                    if (!fetchedOrders?.length) return
                    const ws = XLSX.utils.json_to_sheet(fetchedOrders)
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, '주문목록')
                    XLSX.writeFile(wb, `쿠팡주문_${startDate}_${endDate}.xlsx`)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Download size={14} /> 매칭전 주문 전체 다운로드 (Excel)
                </button>

                {/* ── 파트너 목록 (거래처 B2B에서 가져옴) ── */}
                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={15} className="text-primary-400" />
                      <p className="text-sm font-semibold text-slate-200">자동 분류 파트너</p>
                    </div>
                    <button onClick={() => navigate('/b2b-partners')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-primary-400 hover:border-primary-500/30 transition-all">
                      <Tag size={11} /> 거래처 관리
                    </button>
                  </div>

                  {coupangPartners.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <Tag size={26} className="mx-auto text-slate-600" />
                      <p className="text-xs text-slate-500">등록된 거래처가 없어요</p>
                      <button onClick={() => navigate('/b2b-partners')}
                        className="mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 transition-all">
                        <Plus size={12} /> 거래처 B2B에서 등록하기
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {coupangPartners.map(p => (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dark-border bg-dark-hover">
                          <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary-400">{p.prefix}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200">{p.partnerName}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {p.b2bFileName ?? 'B2B 파일 미등록'}
                            </p>
                          </div>
                          {p.b2bFileName
                            ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                            : <AlertCircle size={14} className="text-amber-400 shrink-0" />
                          }
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-600 px-1 pt-1">
                        업체상품코드 앞글자 기준으로 위 거래처에 자동 분류됩니다
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                    ← 이전
                  </button>
                  <button disabled={coupangPartners.length === 0 || isMatching} onClick={handleMatch}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {isMatching ? <><Loader2 size={14} className="animate-spin" /> 매칭 중...</> : '매칭 실행 →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-400">매칭 완료</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">전체 주문</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-400">
                        {Object.entries(matchResult).filter(([k]) => k !== '(미매칭)').reduce((s, [, v]) => s + v.length, 0)}
                      </p>
                      <p className="text-xs text-slate-500">매칭 성공</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-400">{matchResult['(미매칭)']?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">미매칭</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-3">
                  <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Users size={12} /> 거래처별 분류 결과
                  </p>
                  <div className="space-y-2">
                    {Object.entries(matchResult).map(([name, orders]) => (
                      <div key={name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${name === '(미매칭)' ? 'bg-red-500/5 border-red-500/20' : 'bg-dark-hover border-dark-border'}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${name === '(미매칭)' ? 'text-red-400' : 'text-slate-200'}`}>{name}</p>
                          <p className="text-xs text-slate-500">{orders.length}건</p>
                        </div>
                        {name !== '(미매칭)' && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-400 border border-primary-500/20 hover:bg-primary-500/25 transition-all">
                            <FileSpreadsheet size={11} /> B2B 다운로드
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/20">
                  <Download size={15} /> 전체 ZIP 다운로드
                </button>

                <button onClick={() => { setStep(1); setMatchResult({}) }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                  ← 이전 (주문 가져오기로)
                </button>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            탭 2: 송장번호 추가
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'invoice' && (
          <InvoiceMatchTab source="coupang-api" />
        )}

      </div>
    </div>
  )
}
