import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, AlertCircle,
  Clock, CheckCircle2, Loader2, Download,
  RotateCcw, Package, RefreshCw, Building2,
  FlaskConical, FileSpreadsheet, Users,
  Upload, Send, Truck, XCircle, Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useBusinessStore } from '../stores/businessStore'
import { useSettingsStore } from '../stores/settingsStore'
import { coupangApi } from '../api/client'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Tab  = 'match' | 'invoice'
type Step = 1 | 2 | 3

const STEPS = [
  { num: 1, label: '주문 가져오기' },
  { num: 2, label: '파트너 설정' },
  { num: 3, label: '결과 다운로드' },
] as const

const ORDER_STATUSES = [
  { value: 'ALL',        label: '전체' },
  { value: 'ACCEPT',     label: '결제완료' },
  { value: 'INSTRUCT',   label: '상품준비중' },
  { value: 'DEPARTURE',  label: '배송준비중' },
  { value: 'DELIVERING', label: '배송중' },
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

// 가상 주문 데이터 (DEV 테스트용)
const MOCK_ORDERS = [
  { 번호: 1,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-001', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 45000 },
  { 번호: 2,  묶음배송번호: 'B-002', 주문번호: 'C-20240101-002', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 18000 },
  { 번호: 3,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-003', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 2, 주문상태: '상품준비중', 금액: 30000 },
  { 번호: 4,  묶음배송번호: 'B-003', 주문번호: 'C-20240101-004', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',    옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 5, 주문상태: '배송준비중', 금액: 75000 },
  { 번호: 5,  묶음배송번호: 'B-002', 주문번호: 'C-20240101-005', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 2, 주문상태: '결제완료',   금액: 36000 },
  { 번호: 6,  묶음배송번호: 'B-004', 주문번호: 'C-20240101-006', 업체상품코드: 'A00000004', 등록상품명: '딸기 선물세트', 옵션ID: 'OPT-004', 거래처명: '거래처D(달롬)', 수량: 1, 주문상태: '상품준비중', 금액: 22000 },
  { 번호: 7,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-007', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 4, 주문상태: '배송준비중', 금액: 60000 },
  { 번호: 8,  묶음배송번호: 'B-003', 주문번호: 'C-20240101-008', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',    옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 2, 주문상태: '배송중',     금액: 30000 },
  { 번호: 9,  묶음배송번호: 'B-005', 주문번호: 'C-20240101-009', 업체상품코드: 'A00000005', 등록상품명: '딸기잼',       옵션ID: 'OPT-005', 거래처명: '거래처E(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 15000 },
  { 번호: 10, 묶음배송번호: 'B-002', 주문번호: 'C-20240101-010', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 54000 },
  { 번호: 11, 묶음배송번호: 'B-004', 주문번호: 'C-20240101-011', 업체상품코드: 'A00000004', 등록상품명: '딸기 선물세트', 옵션ID: 'OPT-004', 거래처명: '거래처D(달롬)', 수량: 2, 주문상태: '배송준비중', 금액: 44000 },
  { 번호: 12, 묶음배송번호: 'B-001', 주문번호: 'C-20240101-012', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 1, 주문상태: '배송중',     금액: 15000 },
  { 번호: 13, 묶음배송번호: 'B-005', 주문번호: 'C-20240101-013', 업체상품코드: 'A00000005', 등록상품명: '딸기잼',       옵션ID: 'OPT-005', 거래처명: '거래처E(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 45000 },
  { 번호: 14, 묶음배송번호: 'B-003', 주문번호: 'C-20240101-014', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',    옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 15000 },
  { 번호: 15, 묶음배송번호: 'B-002', 주문번호: 'C-20240101-015', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 2, 주문상태: '배송준비중', 금액: 36000 },
]

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
  const { mappingPresets } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<Tab>('match')

  // ── 주문 매칭 상태 ──────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<Step>(1)
  const [selectedBizId,  setSelectedBizId]  = useState<string>('')
  const [selectedConnId, setSelectedConnId] = useState<string>('')
  const [orderStatus,    setOrderStatus]    = useState<string>('ALL')
  const [startDate,      setStartDate]      = useState<string>(() => new Date().toISOString().split('T')[0])
  const [endDate,        setEndDate]        = useState<string>(() => new Date().toISOString().split('T')[0])
  const [isFetching,     setIsFetching]     = useState(false)
  const [fetchedOrders,  setFetchedOrders]  = useState<typeof MOCK_ORDERS | null>(null)
  const [isMockMode,     setIsMockMode]     = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [classifyColumn,   setClassifyColumn]   = useState<string>('업체상품코드')
  const [isMatching,       setIsMatching]        = useState(false)

  // ── 송장번호 전송 상태 ──────────────────────────────────────────────────────
  const [invBizId,       setInvBizId]       = useState<string>('')
  const [invConnId,      setInvConnId]      = useState<string>('')
  const [invoiceFileName, setInvoiceFileName] = useState<string>('')
  const [invoiceColumns,  setInvoiceColumns]  = useState<string[]>([])
  const [invoiceRows,     setInvoiceRows]     = useState<Record<string, unknown>[]>([])
  const [colNumber,          setColNumber]          = useState<string>('')
  const [colShipmentBox,     setColShipmentBox]     = useState<string>('')
  const [colOrderNumber,     setColOrderNumber]     = useState<string>('')
  const [colCarrier,         setColCarrier]         = useState<string>('')
  const [colInvoice,         setColInvoice]         = useState<string>('')
  const [colSeparateDelivery, setColSeparateDelivery] = useState<string>('')
  const [isSending,          setIsSending]          = useState(false)
  const [sendResult,      setSendResult]      = useState<{ ok: boolean; message: string } | null>(null)
  const [isDragging,      setIsDragging]      = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchBiz() }, [])

  const coupangBizList = businesses.map(b => ({
    ...b,
    coupangConns: b.connections.filter(c => c.marketplace === 'coupang'),
  })).filter(b => b.coupangConns.length > 0)

  const multiMatchPresets = mappingPresets.filter((p: any) => p.mode === 'multi' || !p.mode)

  const handleBizChange = (bizId: string) => {
    setSelectedBizId(bizId)
    const biz = coupangBizList.find(b => b.id === bizId)
    setSelectedConnId(biz?.coupangConns[0]?.id ?? '')
    setFetchedOrders(null)
    setIsMockMode(false)
  }

  const handleInvBizChange = (bizId: string) => {
    setInvBizId(bizId)
    const biz = coupangBizList.find(b => b.id === bizId)
    setInvConnId(biz?.coupangConns[0]?.id ?? '')
  }

  const canFetch = !!selectedConnId && !!startDate && !!endDate

  const handleMockFetch = async () => {
    setIsFetching(true)
    setFetchedOrders(null)
    await new Promise(r => setTimeout(r, 1200))
    setFetchedOrders(MOCK_ORDERS)
    setIsMockMode(true)
    setIsFetching(false)
  }

  const handleFetch = async () => {
    setIsFetching(true)
    setFetchedOrders(null)
    await new Promise(r => setTimeout(r, 1500))
    setIsFetching(false)
  }

  const handleMatch = async () => {
    setIsMatching(true)
    await new Promise(r => setTimeout(r, 1500))
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

  // ── 파일 파싱 ───────────────────────────────────────────────────────────────

  const parseInvoiceFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' })
        const ws   = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const cols = rows.length > 0 ? Object.keys(rows[0]) : []
        setInvoiceRows(rows)
        setInvoiceColumns(cols)
        setInvoiceFileName(file.name)
        setSendResult(null)
        setColNumber(cols.find(c => c === '번호') ?? '')
        setColShipmentBox(cols.find(c => c === '묶음배송번호') ?? cols.find(c => c.includes('묶음배송')) ?? '')
        setColOrderNumber(cols.find(c => c === '주문번호') ?? '')
        setColCarrier(cols.find(c => c === '택배사') ?? cols.find(c => c.includes('배송업체') || c.includes('배송사')) ?? '')
        setColInvoice(cols.find(c => c === '운송장번호') ?? cols.find(c => c === '송장번호') ?? cols.find(c => c.includes('운송장') || c.includes('송장')) ?? '')
        setColSeparateDelivery(cols.find(c => c === '분리배송 Y/N') ?? cols.find(c => c.includes('분리배송')) ?? '')
      } catch {
        setSendResult({ ok: false, message: '파일을 읽을 수 없습니다. Excel 또는 CSV 파일을 올려주세요.' })
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseInvoiceFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseInvoiceFile(file)
  }

  // ── 송장 전송 ───────────────────────────────────────────────────────────────

  const handleSendShipments = async () => {
    if (!colShipmentBox || !colCarrier || !colInvoice) return
    setIsSending(true)
    setSendResult(null)

    try {
      const shipments = invoiceRows
        .map(row => ({
          shipmentBoxId:       String(row[colShipmentBox] ?? '').trim(),
          deliveryCompanyCode: CARRIER_MAP[String(row[colCarrier] ?? '').trim()] ?? String(row[colCarrier] ?? '').trim(),
          invoiceNumber:       String(row[colInvoice] ?? '').trim(),
        }))
        .filter(s => s.shipmentBoxId && s.deliveryCompanyCode && s.invoiceNumber)
        .map((s, i) => ({ 번호: i + 1, ...s, 분리배송: 'N' }))

      if (shipments.length === 0) {
        setSendResult({ ok: false, message: '전송할 데이터가 없습니다. 컬럼 매핑을 확인해주세요.' })
        return
      }

      if (!invBizId || !invConnId) {
        setSendResult({ ok: false, message: '사업자 / 쿠팡 계정을 선택해주세요.' })
        return
      }

      const res = await coupangApi.confirmShipments(invBizId, invConnId, shipments)
      if (res.code === '200' || res.code === '0' || res.message?.toLowerCase().includes('success')) {
        setSendResult({ ok: true, message: `${shipments.length}건 쿠팡 전송 완료` })
      } else {
        setSendResult({ ok: false, message: res.message || '전송 실패' })
      }
    } catch (err: any) {
      setSendResult({ ok: false, message: err.message || '전송 오류가 발생했습니다.' })
    } finally {
      setIsSending(false)
    }
  }

  const canSend = !!invBizId && !!invConnId && !!colShipmentBox && !!colCarrier && !!colInvoice && invoiceRows.length > 0

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
        <div className="flex rounded-xl overflow-hidden border border-dark-border bg-dark-card">
          <button
            onClick={() => setActiveTab('match')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all
              ${activeTab === 'match'
                ? 'bg-primary-500/20 text-primary-300 border-b-2 border-primary-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-dark-hover'
              }`}
          >
            <ShoppingCart size={14} /> 주문 매칭
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all
              ${activeTab === 'invoice'
                ? 'bg-orange-500/20 text-orange-300 border-b-2 border-orange-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-dark-hover'
              }`}
          >
            <Truck size={14} /> 송장번호 전송
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            탭 1: 주문 매칭
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'match' && (
          <>
            {/* 배너 */}
            {!isMockMode ? (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">쿠팡 API 인증 확인 중</p>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    쿠팡 Wing에서 API 인증이 승인되면 주문 가져오기가 활성화됩니다. (보통 1영업일 소요)
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
                <FlaskConical size={16} className="text-violet-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-violet-400">테스트 모드</p>
                  <p className="text-xs text-violet-300/80 mt-0.5">가상 주문 데이터로 전체 흐름을 테스트하고 있습니다.</p>
                </div>
              </div>
            )}

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
                      {isMockMode && <span className="text-xs text-violet-400 ml-1">(가상 데이터)</span>}
                    </div>
                  )}
                </div>

                <button disabled={!canFetch || isFetching || coupangBizList.length === 0} onClick={handleFetch}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20">
                  {isFetching ? <><Loader2 size={15} className="animate-spin" /> 주문 가져오는 중...</> : <><RefreshCw size={15} /> 쿠팡 주문 가져오기</>}
                </button>

                {import.meta.env.DEV && (
                  <button disabled={isFetching} onClick={handleMockFetch}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {isFetching ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</> : <><FlaskConical size={14} /> 가상 주문 15건으로 테스트</>}
                  </button>
                )}

                <button disabled={fetchedOrders === null} onClick={() => setStep(2)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20">
                  다음: 파트너 설정 →
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
                <div className="rounded-2xl border border-dark-border bg-dark-card p-4">
                  <p className="text-xs text-slate-500 mb-3">가져온 주문 요약</p>
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
                </div>

                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-primary-400" />
                    <p className="text-sm font-semibold text-slate-200">파트너 매핑 설정</p>
                  </div>

                  {multiMatchPresets.length === 0 ? (
                    <div className="px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                      일괄매칭 프리셋이 없습니다. 일괄매칭 메뉴에서 먼저 설정을 저장해주세요.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500">사용할 일괄매칭 프리셋 선택</label>
                      <div className="space-y-2">
                        {multiMatchPresets.map((p: any) => (
                          <button key={p.id} onClick={() => setSelectedPresetId(p.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                              ${selectedPresetId === p.id ? 'border-primary-500/50 bg-primary-500/10' : 'border-dark-border bg-dark-hover hover:border-primary-500/30'}`}>
                            <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${selectedPresetId === p.id ? 'border-primary-400 bg-primary-400' : 'border-slate-600'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">컬럼 {Object.keys(p.mapping || {}).length}개 매핑</p>
                            </div>
                            {selectedPresetId === p.id && <CheckCircle2 size={14} className="text-primary-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">
                      분류 기준 컬럼 <span className="text-slate-600">(총 {orderColumns.length}개)</span>
                    </label>
                    <select value={classifyColumn} onChange={e => setClassifyColumn(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50">
                      <option value="">— 컬럼을 선택하세요 —</option>
                      {recommendedCols.length > 0 && (
                        <optgroup label="추천 컬럼">{recommendedCols.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                      )}
                      {otherCols.length > 0 && (
                        <optgroup label="전체 컬럼">{otherCols.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                      )}
                    </select>
                    {classifyColumn && (
                      <p className="text-xs text-slate-500">
                        <span className="text-primary-400 font-medium">"{classifyColumn}"</span> 기준으로 거래처별 분류합니다
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                    ← 이전
                  </button>
                  <button disabled={!classifyColumn || (!selectedPresetId && multiMatchPresets.length > 0) || isMatching} onClick={handleMatch}
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
                      <p className="text-lg font-bold text-emerald-400">{fetchedOrders?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">매칭 성공</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-500">0</p>
                      <p className="text-xs text-slate-500">미매칭</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-3">
                  <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Users size={12} /> 거래처별 분류 결과
                  </p>
                  <div className="space-y-2">
                    {partnerSummary.map(([name, { count, amount }]) => (
                      <div key={name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-dark-hover border border-dark-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{name}</p>
                          <p className="text-xs text-slate-500">{count}개 · {amount.toLocaleString()}원</p>
                        </div>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-400 border border-primary-500/20 hover:bg-primary-500/25 transition-all">
                          <FileSpreadsheet size={11} /> B2B 다운로드
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/20">
                  <Download size={15} /> 전체 ZIP 다운로드
                </button>

                {isMockMode && (
                  <p className="text-center text-xs text-violet-400/70">* 테스트 모드 — 실제 파일이 생성되지 않습니다</p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                    ← 이전
                  </button>
                  <button onClick={() => { setStep(1); setFetchedOrders(null); setIsMockMode(false); setSelectedPresetId('') }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all">
                    <RotateCcw size={13} /> 처음부터
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            탭 2: 송장번호 전송
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'invoice' && (
          <div className="space-y-4 animate-fade-in">

            {/* 안내 배너 */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Truck size={15} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/90">
                <span className="font-semibold text-amber-400">사용 방법:</span>{' '}
                도매몰에서 받은 송장번호가 담긴 엑셀 파일을 올리고, 묶음배송번호 · 택배사 · 송장번호 컬럼을 맞춰주면 쿠팡에 자동 전송됩니다.
              </p>
            </div>

            {/* 사업자 / 쿠팡 계정 선택 */}
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Building2 size={14} className="text-slate-400" /> 쿠팡 계정 선택
              </p>

              {bizLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 size={13} className="animate-spin" /> 불러오는 중...
                </div>
              ) : coupangBizList.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle size={13} />
                  쿠팡 연동된 사업자가 없습니다. 사업자 관리에서 먼저 API 키를 등록해주세요.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <select value={invBizId} onChange={e => handleInvBizChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50">
                    <option value="">— 사업자를 선택하세요 —</option>
                    {coupangBizList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>

                  {invBizId && (
                    <select value={invConnId} onChange={e => setInvConnId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50">
                      <option value="">— 쿠팡 계정을 선택하세요 —</option>
                      {coupangBizList.find(b => b.id === invBizId)?.coupangConns.map(c => (
                        <option key={c.id} value={c.id}>{c.displayName || c.vendorId || c.id}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* 파일 업로드 */}
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Upload size={14} className="text-slate-400" /> 송장 파일 업로드
              </p>

              <div className="relative">
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    flex flex-col items-center justify-center gap-2 py-9 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
                    ${isDragging
                      ? 'border-primary-400 bg-primary-500/10'
                      : invoiceFileName
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-dark-border hover:border-primary-500/40 hover:bg-dark-hover'
                    }
                  `}
                >
                  {invoiceFileName ? (
                    <>
                      <CheckCircle2 size={24} className="text-emerald-400" />
                      <p className="text-sm font-semibold text-emerald-400">{invoiceFileName}</p>
                      <p className="text-xs text-slate-500">{invoiceRows.length}행 · 컬럼 {invoiceColumns.length}개 인식됨</p>
                      <p className="text-xs text-slate-600 mt-1">다른 파일로 교체하려면 클릭하세요</p>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-slate-500" />
                      <p className="text-sm text-slate-400">파일을 드래그하거나 클릭해서 업로드</p>
                      <p className="text-xs text-slate-600">.xlsx · .xls · .csv 지원</p>
                    </>
                  )}
                </div>

                {/* 휴지통 버튼 */}
                {invoiceFileName && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setInvoiceFileName(''); setInvoiceRows([]); setInvoiceColumns([])
                      setColNumber(''); setColOrderNumber('')
                      setColCarrier(''); setColInvoice(''); setColSeparateDelivery('')
                      setSendResult(null)
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-dark-border hover:border-red-500/30 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
            </div>

            {/* 컬럼 매핑 */}
            {invoiceColumns.length > 0 && (
              <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">컬럼 매핑</p>
                  <p className="text-xs text-slate-500 mt-0.5">파일의 어느 컬럼이 아래 항목에 해당하는지 선택하세요</p>
                </div>

                {(() => {
                  const TOP_COLS = ['번호', '주문번호', '배송업체', '송장번호', '택배사', '운송장번호', '분리배송 Y/N']
                  const topCols  = TOP_COLS.filter(c => invoiceColumns.includes(c))
                  const restCols = invoiceColumns.filter(c => !TOP_COLS.includes(c))
                  const ColOptions = () => (
                    <>
                      <option value="">— 선택 안 함 —</option>
                      {topCols.map(c => <option key={c} value={c}>{c}</option>)}
                      {topCols.length > 0 && restCols.length > 0 && (
                        <option disabled>──────────</option>
                      )}
                      {restCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </>
                  )
                  const dropdownRows = [
                    { label: '주문번호',   required: false, value: colOrderNumber,      set: setColOrderNumber },
                    { label: '택배사',     required: true,  value: colCarrier,          set: setColCarrier,
                      hint: '한글명(CJ대한통운 등) 또는 쿠팡 코드(CJGLS 등) 모두 가능' },
                    { label: '운송장번호', required: true,  value: colInvoice,          set: setColInvoice },
                  ]
                  return (
                    <>
                      {/* 번호: 자동 행번호 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">
                          번호 <span className="text-slate-600">(선택)</span>
                        </label>
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-[11px] font-bold text-cyan-300 bg-cyan-500/25 px-2 py-0.5 rounded-md tracking-wide">자동</span>
                          <span className="text-sm text-cyan-300">행 번호 (1, 2, 3...)</span>
                        </div>
                      </div>

                      {/* 나머지 드롭다운 */}
                      {dropdownRows.map(({ label, required, value, set, hint }: any) => (
                        <div key={label} className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-400">
                            {label} {required && <span className="text-red-400">*</span>}
                            {!required && <span className="text-slate-600 ml-1">(선택)</span>}
                          </label>
                          <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50">
                            <ColOptions />
                          </select>
                          {hint && <p className="text-xs text-slate-600">{hint}</p>}
                        </div>
                      ))}

                      {/* 분리배송: 자동 N */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">
                          분리배송 <span className="text-slate-600">(선택)</span>
                        </label>
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-[11px] font-bold text-cyan-300 bg-cyan-500/25 px-2 py-0.5 rounded-md tracking-wide">자동</span>
                          <span className="text-sm text-cyan-300">송장 있는 행 → N 자동 적용</span>
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* 미리보기 */}
                {colShipmentBox && colCarrier && colInvoice && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-500">미리보기 (상위 3행)</p>
                    <div className="overflow-x-auto rounded-xl border border-dark-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-dark-border bg-dark-hover">
                            <th className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">묶음배송번호</th>
                            <th className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">택배사</th>
                            <th className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">송장번호</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceRows.slice(0, 3).map((row, i) => {
                            const rawCarrier = String(row[colCarrier] ?? '')
                            const code = CARRIER_MAP[rawCarrier]
                            return (
                              <tr key={i} className="border-b border-dark-border/50 last:border-0">
                                <td className="px-3 py-2 text-slate-300 font-mono">{String(row[colShipmentBox] ?? '')}</td>
                                <td className="px-3 py-2 text-slate-300">
                                  {rawCarrier}
                                  {code && <span className="ml-1.5 text-primary-400 font-mono">→ {code}</span>}
                                </td>
                                <td className="px-3 py-2 text-slate-300 font-mono">{String(row[colInvoice] ?? '')}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500">총 <span className="text-slate-300 font-semibold">{invoiceRows.length}건</span> 전송 예정</p>
                  </div>
                )}
              </div>
            )}

            {/* 전송 결과 */}
            {sendResult && (
              <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${
                sendResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {sendResult.ok
                  ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  : <XCircle size={16} className="text-red-400 shrink-0" />
                }
                <p className={`text-sm font-semibold ${sendResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sendResult.message}
                </p>
              </div>
            )}

            {/* 전송 버튼 */}
            <button
              disabled={!canSend || isSending}
              onClick={handleSendShipments}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20"
            >
              {isSending
                ? <><Loader2 size={15} className="animate-spin" /> 쿠팡 전송 중...</>
                : <><Send size={15} /> 쿠팡에 송장번호 전송</>
              }
            </button>

            {/* 초기화 */}
            {(invoiceFileName || sendResult) && (
              <button
                onClick={() => {
                  setInvoiceFileName(''); setInvoiceRows([]); setInvoiceColumns([])
                  setColNumber(''); setColShipmentBox(''); setColOrderNumber('')
                  setColCarrier(''); setColInvoice(''); setColSeparateDelivery('')
                  setSendResult(null)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all"
              >
                <RotateCcw size={13} /> 초기화
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
