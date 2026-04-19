import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, AlertCircle,
  CheckCircle2, Loader2, Download,
  RotateCcw, Package, RefreshCw, Building2,
  FileSpreadsheet, Users,
  Truck,
  FolderOpen,
  Tag, Plus, ChevronLeft, Zap, Store,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useBusinessStore } from '../stores/businessStore'
import { useSettingsStore, type MarketType } from '../stores/settingsStore'
import { api, coupangApi, naverApi } from '../api/client'
import { InvoiceMatchTab } from '../components/InvoiceMatchTab'
import { fillB2bFromOrder } from '../utils/fillMapper'


// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Tab  = 'match' | 'invoice'
type Step = 1 | 2 | 3

const STEPS = [
  { num: 1, label: '주문 가져오기' },
  { num: 3, label: '결과 다운로드' },
] as const

const ORDER_STATUSES = [
  { value: 'ACCEPT',     label: '신규주문' },
  { value: 'INSTRUCT',   label: '상품준비중' },
  { value: 'DEPARTURE',  label: '배송지시' },
  { value: 'DELIVERING', label: '배송중' },
  { value: 'FINAL_DELIVERY', label: '배송완료' },
  { value: 'ALL',        label: '전체' },
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

// ─── 마켓 정의 ────────────────────────────────────────────────────────────────

// marketplace 필드 매핑 (businessStore connection.marketplace 값)
const MARKET_CONN_KEY: Record<MarketType, string> = {
  '쿠팡':       'coupang',
  '스마트스토어': 'smartstore',  // 추후 연동 시 실제 키로 변경
  '옥션':       'auction',
  '지마켓':     'gmarket',
  '11번가':     '11st',
  '기타':       'other',
}

const MARKET_CARDS = [
  { type: '쿠팡'  as MarketType, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { type: '스마트스토어' as MarketType, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { type: '옥션'  as MarketType, color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  { type: '지마켓' as MarketType, color: 'text-red-400',   bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  { type: '11번가' as MarketType, color: 'text-rose-400',  bg: 'bg-rose-500/10',   border: 'border-rose-500/30' },
  { type: '기타'  as MarketType, color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
]

// ─── 마켓별 API 호출 (연동 완료 마켓만 실제 구현) ─────────────────────────────
async function fetchOrdersByMarket(
  market: MarketType,
  bizId: string, connId: string,
  startDate: string, endDate: string, orderStatus: string
): Promise<any[]> {
  switch (market) {
    case '쿠팡': {
      const result = await coupangApi.getOrders(bizId, connId, startDate, endDate, orderStatus)
      return result.orders as any[]
    }
    case '스마트스토어': {
      const result = await naverApi.getOrders(bizId, connId, startDate, endDate, orderStatus)
      return result.orders as any[]
    }
    // ─ 아래 마켓은 API 연동 시 case 추가 ─
    // case '옥션':    return await auctionApi.getOrders(...)
    // case '지마켓':  return await gmarketApi.getOrders(...)
    // case '11번가':  return await elevenApi.getOrders(...)
    default:
      throw new Error(`${market} API는 아직 연동되지 않았습니다.\n연동 완료 후 자동으로 사용 가능합니다.`)
  }
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

export function CoupangAutoPage() {
  const navigate = useNavigate()
  const { businesses, isLoading: bizLoading, fetch: fetchBiz } = useBusinessStore()
  const {
    multiMatchConfigs,
    coupangPartners, saveOrder, savedOrders,
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<Tab>('match')
  const [selectedMarket, setSelectedMarket] = useState<MarketType | null>(null)
  const connTestStatus: Record<string, string> = (() => {
    try { return JSON.parse(localStorage.getItem('conn-test-status') ?? '{}') } catch { return {} }
  })()

  // ── 주문 매칭 상태 ──────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<Step>(1)
  const [selectedBizId,  setSelectedBizId]  = useState<string>('')
  const [selectedConnId, setSelectedConnId] = useState<string>('')
  const [orderStatus,    setOrderStatus]    = useState<string>('ACCEPT')
  const [startDate,      setStartDate]      = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 4); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [endDate,        setEndDate]        = useState<string>(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [isFetching,     setIsFetching]     = useState(false)
  const [fetchProgress,  setFetchProgress]  = useState(0)
  const [fetchedOrders,  setFetchedOrders]  = useState<any[] | null>(null)
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [classifyColumn,   setClassifyColumn]   = useState<string>('업체관리코드')
  const [isMatching,       setIsMatching]        = useState(false)
  const [matchResult,      setMatchResult]       = useState<Record<string, any[]>>({})
  const [showOrderList,    setShowOrderList]     = useState(false)
  const [isAcknowledging,  setIsAcknowledging]  = useState(false)
  const [ackResult,        setAckResult]         = useState<string | null>(null)



  useEffect(() => { fetchBiz() }, [])

  // 현재 선택된 마켓의 연동 사업자 목록
  const marketBizList = selectedMarket
    ? businesses.map(b => ({
        ...b,
        marketConns: b.connections.filter(c =>
        c.marketplace === MARKET_CONN_KEY[selectedMarket] &&
        (MARKET_CONN_KEY[selectedMarket] === 'coupang' ? !!c.vendorId : c.hasAccessKey)
      ),
      })).filter(b => b.marketConns.length > 0)
    : []

  // 사업자 목록 로드 후 첫 번째 사업자 자동 선택
  useEffect(() => {
    if (!selectedMarket || selectedBizId) return
    const list = businesses
      .map(b => ({ ...b, marketConns: b.connections.filter(c =>
        c.marketplace === MARKET_CONN_KEY[selectedMarket] &&
        (MARKET_CONN_KEY[selectedMarket] === 'coupang' ? !!c.vendorId : c.hasAccessKey)
      )}))
      .filter(b => b.marketConns.length > 0)
    if (list.length > 0) {
      setSelectedBizId(list[0].id)
      setSelectedConnId(list[0].marketConns[0]?.id ?? '')
    }
  }, [businesses, selectedMarket, selectedBizId])

  const handleBizChange = (bizId: string) => {
    setSelectedBizId(bizId)
    const biz = marketBizList.find(b => b.id === bizId)
    setSelectedConnId(biz?.marketConns[0]?.id ?? '')
    setFetchedOrders(null)
  }

  const canFetch = !!startDate && !!endDate && !!selectedBizId && !!selectedConnId

  const [fetchError, setFetchError] = useState<string | null>(null)

  const handleFetch = async () => {
    if (!selectedMarket) return
    setIsFetching(true)
    setFetchedOrders(null)
    setFetchProgress(0)
    setFetchError(null)

    const progressInterval = setInterval(() => {
      setFetchProgress(p => p < 85 ? p + 5 : p)
    }, 200)

    try {
      const orders = await fetchOrdersByMarket(
        selectedMarket, selectedBizId, selectedConnId, startDate, endDate, orderStatus
      )
      clearInterval(progressInterval)
      setFetchProgress(100)
      await new Promise(r => setTimeout(r, 300))
      setFetchedOrders(orders)
      if (orders.length > 0) {
        saveOrder('coupang-api', Object.keys(orders[0]), orders as Record<string, unknown>[])
      }
    } catch (err: any) {
      clearInterval(progressInterval)
      setFetchProgress(0)
      setFetchError(err.message || '주문 조회 중 오류가 발생했습니다.')
    } finally {
      setIsFetching(false)
    }
  }

  // ── 발주확인처리 (신규주문 → 상품준비중) ──────────────────────────────────
  const handleAcknowledge = async () => {
    if (!fetchedOrders || !selectedBizId || !selectedConnId) return
    const acceptOrders = fetchedOrders.filter(o => o['주문상태'] === '신규주문')
    if (acceptOrders.length === 0) { setAckResult('발주확인할 신규주문이 없습니다.'); return }

    setIsAcknowledging(true)
    setAckResult(null)
    try {
      const body = acceptOrders.map(o => ({
        orderId:     String(o['주문번호']),
        orderItemId: String(o['주문상품번호']),
        vendorItemId: String(o['업체상품코드']),
      }))
      await api.post(
        `/businesses/${selectedBizId}/connections/${selectedConnId}/coupang/acknowledge`,
        body
      )
      setAckResult(`✅ ${acceptOrders.length}건 발주확인 완료! 주문 상태가 상품준비중으로 변경됩니다.`)
    } catch (err: any) {
      setAckResult(`❌ ${err.response?.data?.message ?? err.message}`)
    } finally {
      setIsAcknowledging(false)
    }
  }

  // ── 접두어 앞 2글자 기반 자동 매칭 (일괄매칭과 동일 로직) ──
  const handleMatch = async () => {
    setIsMatching(true)
    await new Promise(r => setTimeout(r, 300))

    if (!fetchedOrders) { setIsMatching(false); return }

    const matchableOrders = fetchedOrders  // 모든 상태 매칭
    const result: Record<string, any[]> = {}

    for (const order of matchableOrders) {
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

  // ── 거래처별 B2B 다운로드 ──────────────────────────────────────────────────
  const downloadB2bForPartner = (partnerName: string, orders: any[]) => {
    const partner = coupangPartners.find(p => p.partnerName === partnerName)
    if (!partner || !partner.b2bHeaders.length) {
      alert(`${partnerName}: B2B 파일 양식이 등록되지 않았습니다.\n거래처 B2B 관리에서 양식을 먼저 등록해주세요.`)
      return
    }
    const marketMapping = selectedMarket
      ? partner.marketMappings?.find(m => m.marketType === selectedMarket)
      : undefined
    const mapping    = marketMapping?.mapping    ?? partner.mapping
    const appendVals = marketMapping?.appendValues ?? partner.appendValues
    const { rows }   = fillB2bFromOrder(orders, partner.b2bHeaders, mapping, appendVals)
    const ws = XLSX.utils.json_to_sheet(rows, { header: partner.b2bHeaders })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'B2B주문')
    XLSX.writeFile(wb, `${partnerName}_B2B_${startDate}_${endDate}.xlsx`)
  }

  const downloadAllB2b = () => {
    const wb = XLSX.utils.book_new()
    Object.entries(matchResult).forEach(([name, orders]) => {
      if (name === '(미매칭)') return
      const partner = coupangPartners.find(p => p.partnerName === name)
      if (!partner || !partner.b2bHeaders.length) return
      const marketMapping = selectedMarket
        ? partner.marketMappings?.find(m => m.marketType === selectedMarket)
        : undefined
      const mapping    = marketMapping?.mapping    ?? partner.mapping
      const appendVals = marketMapping?.appendValues ?? partner.appendValues
      const { rows }   = fillB2bFromOrder(orders, partner.b2bHeaders, mapping, appendVals)
      const ws = XLSX.utils.json_to_sheet(rows, { header: partner.b2bHeaders })
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
    })
    if (wb.SheetNames.length === 0) { alert('다운로드할 B2B 파일이 없습니다.'); return }
    XLSX.writeFile(wb, `전체B2B_${startDate}_${endDate}.xlsx`)
  }

  const partnerSummary = fetchedOrders
    ? Object.entries(
        fetchedOrders.reduce((acc, o) => {
          const key = String((o as Record<string, unknown>)[classifyColumn] ?? '(없음)')
          if (!acc[key]) acc[key] = { count: 0, amount: 0 }
          acc[key].count  += Number(o['수량'] ?? 0)
          acc[key].amount += Number(o['금액'] ?? 0)
          return acc
        }, {} as Record<string, { count: number; amount: number }>)
      )
    : []

  const orderColumns    = fetchedOrders?.length ? Object.keys(fetchedOrders[0]) : []
  const recommendedCols = orderColumns.filter(c => RECOMMENDED_CLASSIFY_COLS.includes(c))
  const otherCols       = orderColumns.filter(c => !RECOMMENDED_CLASSIFY_COLS.includes(c))
  const today           = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5 animate-fade-in">

        {/* 헤더 */}
        <div className="flex items-center gap-3">
          {selectedMarket && (
            <button
              onClick={() => { setSelectedMarket(null); setStep(1); setFetchedOrders(null); setMatchResult({}) }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all shrink-0"
            >
              <ChevronLeft size={13} /> 마켓 선택
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Zap size={18} className="text-primary-400" />
              자동매칭
              {selectedMarket && <span className="text-orange-400 text-base font-semibold">{selectedMarket}</span>}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {selectedMarket ? '주문을 자동으로 가져와 거래처별 B2B 파일로 출력합니다' : '마켓을 선택하세요'}
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            마켓 허브 (미선택)
        ═══════════════════════════════════════════════════════════════════ */}
        {!selectedMarket && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-dark-card border border-dark-border">
              <button onClick={() => setActiveTab('match')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all
                  ${activeTab === 'match' ? 'bg-primary-500/15 text-primary-300 border-primary-500/40' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                <Zap size={14} /> 주문 매칭
              </button>
              <button onClick={() => setActiveTab('invoice')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all
                  ${activeTab === 'invoice' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                <Truck size={14} /> 송장번호 추가
              </button>
            </div>

            {activeTab === 'match' && (
              <div className="grid grid-cols-2 gap-3">
                {MARKET_CARDS.map(({ type, color, bg, border }) => {
                  const connKey = MARKET_CONN_KEY[type]
                  const isConnected = businesses.some(b => b.connections.some(c =>
                    c.marketplace === connKey &&
                    (connKey === 'coupang' ? !!c.vendorId : c.hasAccessKey) &&
                    connTestStatus[c.id] === 'ok'
                  ))
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedMarket(type)}
                      className={`relative flex flex-col items-center gap-3 px-4 py-7 rounded-2xl border-2 transition-all duration-200
                        ${bg} ${border} hover:scale-[1.03] hover:shadow-lg cursor-pointer active:scale-[0.98]`}
                    >
                      <span className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded border ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-500/15 text-slate-500 border-slate-500/20'
                      }`}>
                        {isConnected ? 'API ON' : 'API OFF'}
                      </span>
                      <div className={`w-14 h-14 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                        <Store size={26} className={color} />
                      </div>
                      <div className="text-center">
                        <p className={`text-base font-bold ${color}`}>{type}</p>
                        <p className="text-xs text-slate-500 mt-0.5">API 자동 주문 수집</p>
                        <p className={`text-xs font-semibold mt-1.5 ${['쿠팡', '스마트스토어'].includes(type) ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {['쿠팡', '스마트스토어'].includes(type) ? '사용가능' : '준비중'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {activeTab === 'invoice' && <InvoiceMatchTab source="coupang-api" marketType={selectedMarket ?? '쿠팡'} />}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            마켓 선택 후: 모든 마켓 공통 UI
        ═══════════════════════════════════════════════════════════════════ */}
        {selectedMarket && (
          <>
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
                    ) : marketBizList.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                        <AlertCircle size={13} />
                        {selectedMarket} 연동된 사업자가 없습니다. 사업자 관리에서 {selectedMarket} API 키를 먼저 등록해주세요.
                      </div>
                    ) : (
                      <select
                        value={selectedBizId}
                        onChange={e => handleBizChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="">— 사업자를 선택하세요 —</option>
                        {marketBizList.map(b => (
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
                      {ORDER_STATUSES.map(({ value, label }) => {
                        const STATUS_KO: Record<string, string> = {
                          ALL: '', ACCEPT: '신규주문', INSTRUCT: '상품준비중',
                          DEPARTURE: '배송지시', DELIVERING: '배송중', FINAL_DELIVERY: '배송완료',
                        }
                        const koLabel = STATUS_KO[value]
                        const cnt = fetchedOrders
                          ? value === 'ALL'
                            ? fetchedOrders.length
                            : fetchedOrders.filter(o => o['주문상태'] === koLabel).length
                          : null
                        return (
                          <button key={value} onClick={() => setOrderStatus(value)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-0.5 min-w-[52px]
                              ${orderStatus === value
                                ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                                : 'bg-dark-hover border-dark-border text-slate-400 hover:border-primary-500/30 hover:text-primary-400'
                              }`}
                          >
                            <span>{label}</span>
                            {cnt !== null && (
                              <span className={`text-base font-bold leading-none ${cnt > 0 ? 'text-primary-300' : 'text-slate-600'}`}>
                                {cnt}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-slate-600"><span className="text-slate-400">상태 선택</span> 후 아래 <span className="text-slate-400">주문 가져오기</span> 버튼을 눌러주세요.</p>
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

                {/* 발주확인처리 (신규주문 있을 때) */}
                {fetchedOrders !== null && fetchedOrders.some(o => o['주문상태'] === '신규주문') && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300">신규주문 {fetchedOrders.filter(o => o['주문상태'] === '신규주문').length}건 — 발주확인 필요</p>
                        <p className="text-xs text-amber-400/70 mt-0.5">쿠팡 셀러에서 '발주확인처리'를 해야 상품준비중으로 변경됩니다.<br />아래 버튼으로 API를 통해 자동 처리할 수 있습니다.</p>
                      </div>
                    </div>
                    {ackResult && (
                      <p className="text-xs px-2 py-1.5 rounded-lg bg-dark-hover text-slate-300">{ackResult}</p>
                    )}
                    <button
                      onClick={handleAcknowledge}
                      disabled={isAcknowledging}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-all"
                    >
                      {isAcknowledging ? <><Loader2 size={13} className="animate-spin" /> 처리 중...</> : '발주확인처리 (API 자동)'}
                    </button>
                  </div>
                )}

                {fetchError && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-400">API 연결 안됨</p>
                      <p className="text-xs text-red-400/70 mt-0.5 whitespace-pre-line">{fetchError}</p>
                    </div>
                  </div>
                )}

                <button disabled={!canFetch || isFetching} onClick={handleFetch}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20">
                  {isFetching ? <><Loader2 size={15} className="animate-spin" /> 주문 가져오는 중...</> : <><RefreshCw size={15} /> {selectedMarket} 주문 가져오기</>}
                </button>

                {/* 진행률 바 */}
                {isFetching && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{selectedMarket} 주문 수집 중...</span>
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
                <button onClick={() => { setSelectedMarket(null); setStep(1); setFetchedOrders(null); setMatchResult({}) }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                  ← 마켓 선택
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
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.reduce((s, o) => s + Number(o['수량'] ?? 0), 0) ?? 0}</p>
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
                          <button
                            onClick={() => downloadB2bForPartner(name, orders)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-400 border border-primary-500/20 hover:bg-primary-500/25 transition-all">
                            <FileSpreadsheet size={11} /> B2B 다운로드
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={downloadAllB2b}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/20">
                  <Download size={15} /> 전체 B2B 한번에 다운로드 (시트별)
                </button>

                <button onClick={() => { setStep(1); setMatchResult({}) }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                  ← 이전 (주문 가져오기로)
                </button>
              </div>
            )}
          </>
        )}

        {/* 송장번호 추가 탭 */}
        {activeTab === 'invoice' && (
          <InvoiceMatchTab source="coupang-api" marketType={selectedMarket ?? '쿠팡'} />
        )}
          </>
        )}

      </div>
    </div>
  )
}
