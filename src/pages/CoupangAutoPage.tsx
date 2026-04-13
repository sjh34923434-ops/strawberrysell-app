import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, AlertCircle,
  Clock, CheckCircle2, Loader2, Download,
  RotateCcw, Package, RefreshCw, Building2,
  FlaskConical, FileSpreadsheet, Users,
} from 'lucide-react'
import { useBusinessStore } from '../stores/businessStore'
import { useSettingsStore } from '../stores/settingsStore'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

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

// 가상 주문 데이터 (DEV 테스트용)
const MOCK_ORDERS = [
  { 번호: 1,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-001', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',    옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 45000 },
  { 번호: 2,  묶음배송번호: 'B-002', 주문번호: 'C-20240101-002', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',    옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 18000 },
  { 번호: 3,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-003', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',    옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 2, 주문상태: '상품준비중', 금액: 30000 },
  { 번호: 4,  묶음배송번호: 'B-003', 주문번호: 'C-20240101-004', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',   옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 5, 주문상태: '배송준비중', 금액: 75000 },
  { 번호: 5,  묶음배송번호: 'B-002', 주문번호: 'C-20240101-005', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',    옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 2, 주문상태: '결제완료',   금액: 36000 },
  { 번호: 6,  묶음배송번호: 'B-004', 주문번호: 'C-20240101-006', 업체상품코드: 'A00000004', 등록상품명: '딸기 선물세트', 옵션ID: 'OPT-004', 거래처명: '거래처D(달롬)', 수량: 1, 주문상태: '상품준비중', 금액: 22000 },
  { 번호: 7,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-007', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',    옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 4, 주문상태: '배송준비중', 금액: 60000 },
  { 번호: 8,  묶음배송번호: 'B-003', 주문번호: 'C-20240101-008', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',   옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 2, 주문상태: '배송중',     금액: 30000 },
  { 번호: 9,  묶음배송번호: 'B-005', 주문번호: 'C-20240101-009', 업체상품코드: 'A00000005', 등록상품명: '딸기잼',      옵션ID: 'OPT-005', 거래처명: '거래처E(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 15000 },
  { 번호: 10, 묶음배송번호: 'B-002', 주문번호: 'C-20240101-010', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',    옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 54000 },
  { 번호: 11, 묶음배송번호: 'B-004', 주문번호: 'C-20240101-011', 업체상품코드: 'A00000004', 등록상품명: '딸기 선물세트', 옵션ID: 'OPT-004', 거래처명: '거래처D(달롬)', 수량: 2, 주문상태: '배송준비중', 금액: 44000 },
  { 번호: 12, 묶음배송번호: 'B-001', 주문번호: 'C-20240101-012', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',    옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 1, 주문상태: '배송중',     금액: 15000 },
  { 번호: 13, 묶음배송번호: 'B-005', 주문번호: 'C-20240101-013', 업체상품코드: 'A00000005', 등록상품명: '딸기잼',      옵션ID: 'OPT-005', 거래처명: '거래처E(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 45000 },
  { 번호: 14, 묶음배송번호: 'B-003', 주문번호: 'C-20240101-014', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',   옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 15000 },
  { 번호: 15, 묶음배송번호: 'B-002', 주문번호: 'C-20240101-015', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',    옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 2, 주문상태: '배송준비중', 금액: 36000 },
]

// 추천 분류 컬럼 (쿠팡 주문 기준)
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
                :          'bg-dark-hover dark:bg-dark-hover bg-gray-200 text-slate-500'}
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
                ${current > num ? 'bg-emerald-500/50' : 'bg-dark-border dark:bg-dark-border bg-gray-200'}`} />
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

  const [step, setStep] = useState<Step>(1)

  // Step 1 상태
  const [selectedBizId,  setSelectedBizId]  = useState<string>('')
  const [selectedConnId, setSelectedConnId] = useState<string>('')
  const [orderStatus,    setOrderStatus]    = useState<string>('ALL')
  const [startDate,      setStartDate]      = useState<string>('')
  const [endDate,        setEndDate]        = useState<string>('')
  const [isFetching,     setIsFetching]     = useState(false)
  const [fetchedOrders,  setFetchedOrders]  = useState<typeof MOCK_ORDERS | null>(null)
  const [isMockMode,     setIsMockMode]     = useState(false)

  // Step 2 상태
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [classifyColumn,   setClassifyColumn]   = useState<string>('업체상품코드')
  const [isMatching,       setIsMatching]        = useState(false)

  useEffect(() => { fetchBiz() }, [])

  // 쿠팡 연결된 사업자/연동만 필터
  const coupangBizList = businesses.map(b => ({
    ...b,
    coupangConns: b.connections.filter(c => c.marketplace === 'coupang'),
  })).filter(b => b.coupangConns.length > 0)

  const selectedBiz  = coupangBizList.find(b => b.id === selectedBizId)
  const selectedConn = selectedBiz?.coupangConns.find(c => c.id === selectedConnId)

  // 일괄매칭 프리셋만 필터
  const multiMatchPresets = mappingPresets.filter((p: any) => p.mode === 'multi' || !p.mode)

  const handleBizChange = (bizId: string) => {
    setSelectedBizId(bizId)
    const biz = coupangBizList.find(b => b.id === bizId)
    setSelectedConnId(biz?.coupangConns[0]?.id ?? '')
    setFetchedOrders(null)
    setIsMockMode(false)
  }

  const canFetch = !!selectedConnId && !!startDate && !!endDate

  // DEV 가상 주문 가져오기
  const handleMockFetch = async () => {
    setIsFetching(true)
    setFetchedOrders(null)
    await new Promise(r => setTimeout(r, 1200))
    setFetchedOrders(MOCK_ORDERS)
    setIsMockMode(true)
    setIsFetching(false)
  }

  // 실제 API fetch (TODO: 구현 예정)
  const handleFetch = async () => {
    setIsFetching(true)
    setFetchedOrders(null)
    await new Promise(r => setTimeout(r, 1500))
    setIsFetching(false)
  }

  // Step 2 매칭 실행 (DEV: 가상)
  const handleMatch = async () => {
    setIsMatching(true)
    await new Promise(r => setTimeout(r, 1500))
    setIsMatching(false)
    setStep(3)
  }

  // 선택한 컬럼 기준으로 거래처별 집계
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

  // 주문에서 컬럼 목록 추출
  const orderColumns = fetchedOrders && fetchedOrders.length > 0
    ? Object.keys(fetchedOrders[0])
    : []
  const recommendedCols = orderColumns.filter(c => RECOMMENDED_CLASSIFY_COLS.includes(c))
  const otherCols       = orderColumns.filter(c => !RECOMMENDED_CLASSIFY_COLS.includes(c))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6 animate-fade-in">

        {/* 헤더 */}
        <div>
          <h1 className="text-xl font-bold text-slate-100 dark:text-slate-100 text-gray-900 flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-400" />
            쿠팡 자동매칭
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            쿠팡 API로 주문을 가져와 거래처별로 자동 분류·출력합니다
          </p>
        </div>

        {/* API 인증 대기 배너 */}
        {!isMockMode && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">쿠팡 API 인증 확인 중</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                쿠팡 Wing에서 API 인증이 승인되면 주문 가져오기가 활성화됩니다. (보통 1영업일 소요)
              </p>
            </div>
          </div>
        )}

        {/* DEV 테스트 모드 배너 */}
        {isMockMode && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
            <FlaskConical size={16} className="text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-400">테스트 모드</p>
              <p className="text-xs text-violet-300/80 mt-0.5">
                가상 주문 데이터로 전체 흐름을 테스트하고 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* 단계 인디케이터 */}
        <StepIndicator current={step} />

        {/* ── STEP 1 ────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-2xl border border-dark-border dark:border-dark-border border-gray-200 bg-dark-card dark:bg-dark-card bg-white p-5 space-y-5">

              {/* 사업자 선택 */}
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
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 text-slate-200 dark:text-slate-200 text-gray-800 focus:outline-none focus:border-primary-500/50"
                  >
                    <option value="">— 사업자를 선택하세요 —</option>
                    {coupangBizList.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 날짜 범위 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">주문 기간</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    max={today}
                    onChange={e => setStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50"
                  />
                  <span className="text-slate-500 text-xs">~</span>
                  <input
                    type="date"
                    value={endDate}
                    max={today}
                    onChange={e => setEndDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50"
                  />
                </div>
              </div>

              {/* 주문 상태 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Package size={12} /> 주문 상태
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ORDER_STATUSES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setOrderStatus(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${orderStatus === value
                          ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                          : 'bg-dark-hover dark:bg-dark-hover bg-gray-100 border-dark-border dark:border-dark-border border-gray-200 text-slate-400 hover:border-primary-500/30 hover:text-primary-400'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 가져오기 결과 */}
              {fetchedOrders !== null && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
                  <CheckCircle2 size={14} />
                  주문 <span className="font-bold">{fetchedOrders.length}건</span> 가져왔습니다
                  {isMockMode && <span className="text-xs text-violet-400 ml-1">(가상 데이터)</span>}
                </div>
              )}
            </div>

            {/* 실제 가져오기 버튼 */}
            <button
              disabled={!canFetch || isFetching || coupangBizList.length === 0}
              onClick={handleFetch}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20"
            >
              {isFetching
                ? <><Loader2 size={15} className="animate-spin" /> 주문 가져오는 중...</>
                : <><RefreshCw size={15} /> 쿠팡 주문 가져오기</>
              }
            </button>

            {/* DEV 테스트 버튼 */}
            {import.meta.env.DEV && (
              <button
                disabled={isFetching}
                onClick={handleMockFetch}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isFetching
                  ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</>
                  : <><FlaskConical size={14} /> 가상 주문 15건으로 테스트</>
                }
              </button>
            )}

            {/* 다음 단계 */}
            <button
              disabled={fetchedOrders === null}
              onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20"
            >
              다음: 파트너 설정 →
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-dark-border dark:border-dark-border border-gray-200 text-slate-300 dark:text-slate-300 text-gray-700 hover:bg-dark-muted transition-all"
            >
              ← 뒤로가기
            </button>
          </div>
        )}

        {/* ── STEP 2 ────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">

            {/* 주문 요약 */}
            <div className="rounded-2xl border border-dark-border bg-dark-card p-4">
              <p className="text-xs text-slate-500 mb-3">가져온 주문 요약</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-100">{fetchedOrders?.length ?? 0}</p>
                  <p className="text-xs text-slate-500">총 주문</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-100">{partnerSummary.length}</p>
                  <p className="text-xs text-slate-500">거래처 수</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-100">
                    {fetchedOrders?.reduce((s, o) => s + o.수량, 0) ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">총 수량</p>
                </div>
              </div>
            </div>

            {/* 파트너 매핑 프리셋 선택 */}
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
                      <button
                        key={p.id}
                        onClick={() => setSelectedPresetId(p.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                          ${selectedPresetId === p.id
                            ? 'border-primary-500/50 bg-primary-500/10'
                            : 'border-dark-border bg-dark-hover hover:border-primary-500/30'
                          }`}
                      >
                        <div className={`w-3 h-3 rounded-full border-2 shrink-0
                          ${selectedPresetId === p.id ? 'border-primary-400 bg-primary-400' : 'border-slate-600'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            컬럼 {Object.keys(p.mapping || {}).length}개 매핑
                          </p>
                        </div>
                        {selectedPresetId === p.id && (
                          <CheckCircle2 size={14} className="text-primary-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 분류 기준 컬럼 선택 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">
                  분류 기준 컬럼 선택 <span className="text-slate-600">(총 {orderColumns.length}개 감지됨)</span>
                </label>
                <select
                  value={classifyColumn}
                  onChange={e => setClassifyColumn(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50"
                >
                  <option value="">— 컬럼을 선택하세요 —</option>
                  {recommendedCols.length > 0 && (
                    <optgroup label="추천 컬럼">
                      {recommendedCols.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  )}
                  {otherCols.length > 0 && (
                    <optgroup label="전체 컬럼">
                      {otherCols.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {classifyColumn && (
                  <p className="text-xs text-slate-500">
                    선택된 컬럼 <span className="text-primary-400 font-medium">"{classifyColumn}"</span> 값 기준으로 거래처별 분류합니다
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all"
              >
                ← 이전
              </button>
              <button
                disabled={!classifyColumn || (!selectedPresetId && multiMatchPresets.length > 0) || isMatching}
                onClick={handleMatch}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isMatching
                  ? <><Loader2 size={14} className="animate-spin" /> 매칭 중...</>
                  : '매칭 실행 →'
                }
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">

            {/* 결과 요약 */}
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

            {/* 거래처별 결과 */}
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

            {/* 전체 다운로드 */}
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/20">
              <Download size={15} /> 전체 ZIP 다운로드
            </button>

            {isMockMode && (
              <p className="text-center text-xs text-violet-400/70">
                * 테스트 모드 — 실제 파일이 생성되지 않습니다
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all"
              >
                ← 이전
              </button>
              <button
                onClick={() => { setStep(1); setFetchedOrders(null); setIsMockMode(false); setSelectedPresetId('') }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all"
              >
                <RotateCcw size={13} /> 처음부터
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
