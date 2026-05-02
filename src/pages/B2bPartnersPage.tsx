import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Database, Plus, Pencil, Trash2, Tag, X,
  CheckCircle2, FileSpreadsheet, AlertCircle, Store, Truck, Zap,
  ChevronDown, ChevronUp, Monitor, ArrowLeft, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSettingsStore, type CoupangPartner, type MarketTemplate, type SupplierMappingPreset, type MarketType, MARKET_TYPES } from '../stores/settingsStore'
import { FileUploader } from '../components/FileUploader'
import { ColumnMapper } from '../components/ColumnMapper'
import { readExcelFile } from '../utils/excelReader'
import type { ColumnMapping } from '../utils/fillMapper'

// B2B 주문 매핑 기준 (쿠팡 주문 컬럼)
const ORDER_HEADERS = [
  '주문번호', '업체주문번호', '등록상품명', '업체상품코드', '옵션명',
  '구매수', '수취인이름', '수취인주소', '수취인전화번호', '배송메시지',
  '판매금액', '결제금액', '주문상태', '주문일시',
]

// 송장 매핑 기준 (B2B 송장 파일 컬럼)
const INVOICE_HEADERS = [
  '묶음배송번호', '주문번호', '업체상품코드', '등록상품명',
  '수취인이름', '택배사', '운송장번호', '옵션ID',
]

type Tab = 'b2b' | 'invoice' | 'supplier'

// 송장 매칭에서 쓰는 표준 주문 컬럼들
const STANDARD_ORDER_COLS = [
  '수취인이름', '수취인전화번호', '수취인주소', '주문번호',
  '업체상품코드', '옵션명', '배송메시지',
]

interface SupplierForm {
  name:        string
  file:        File | null
  headers:     string[]
  rows:        Record<string, unknown>[]
  keyPairs:    Array<{ orderCol: string; supplierCol: string }>
  invoiceCol:  string
  carrierCol:  string
}

const emptySupplierForm = (): SupplierForm => ({
  name: '', file: null, headers: [], rows: [],
  keyPairs: [{ orderCol: '수취인이름', supplierCol: '' }],
  invoiceCol: '', carrierCol: '',
})

interface FormState {
  name:                string
  prefix:              string
  b2bFile:             File | null
  headers:             string[]
  fileData:            string
  selectedMarketType:  MarketType
  marketFile:          File | null
  marketHeaders:       string[]
  marketFileData:      string
  mapping:             ColumnMapping
  appendValues:        Record<string, string>
  loadedPresetId:      string | null
}

const emptyForm = (): FormState => ({
  name: '', prefix: '', b2bFile: null,
  headers: [], fileData: '',
  selectedMarketType: '쿠팡',
  marketFile: null, marketHeaders: [], marketFileData: '',
  mapping: {}, appendValues: {}, loadedPresetId: null,
})

// ─── 공통 파트너 카드 ──────────────────────────────────────────────────────────

function PartnerCard({
  id, prefix, name, fileName, mappingCount, hasFile,
  onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
  sortable = false,
}: {
  id?: string; prefix?: string; name: string; fileName?: string; mappingCount: number; hasFile: boolean
  onEdit: () => void; onDelete: () => void
  onMoveUp?: () => void; onMoveDown?: () => void
  isFirst?: boolean; isLast?: boolean
  sortable?: boolean
}) {
  // sortable이 true이고 id가 있을 때만 드래그 활성화
  const sortableState = useSortable({ id: id ?? '__nope__', disabled: !sortable || !id })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortableState
  const style = sortable ? { transform: CSS.Transform.toString(transform), transition } : undefined

  const showMoveButtons = !!onMoveUp || !!onMoveDown
  return (
    <div
      ref={sortable ? setNodeRef : undefined}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border bg-dark-card transition-all group ${
        isDragging
          ? 'border-primary-500/60 opacity-70 shadow-2xl scale-[1.01] z-10'
          : 'border-dark-border hover:border-primary-500/30'
      }`}
    >
      {/* 드래그 핸들 (sortable 모드에서만) */}
      {sortable && (
        <button
          {...attributes}
          {...listeners}
          title="끌어서 순서 변경"
          tabIndex={-1}
          className="shrink-0 p-1 rounded-md text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 cursor-grab active:cursor-grabbing touch-none transition-colors"
        >
          <GripVertical size={14} />
        </button>
      )}

      {/* 순서 변경 버튼 (항상 노출 - 키보드/터치 보조) */}
      {showMoveButtons && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            title="위로 이동"
            className="p-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 hover:border-sky-400/60 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            <ArrowUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            title="아래로 이동"
            className="p-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 hover:border-amber-400/60 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            <ArrowDown size={12} />
          </button>
        </div>
      )}

      <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex flex-col items-center justify-center shrink-0 gap-0">
        {prefix ? (
          <>
            <span className="text-[10px] font-bold text-primary-400 leading-none">{prefix}</span>
            <span className="text-[8px] text-slate-600">접두어</span>
          </>
        ) : (
          <Store size={14} className="text-primary-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-200">{name}</p>
          {fileName ? (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <FileSpreadsheet size={11} /> {fileName}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500/70">
              <AlertCircle size={11} /> 파일 미등록
            </span>
          )}
          {hasFile && (
            <span className="flex items-center gap-1 text-xs text-emerald-400/70">
              <CheckCircle2 size={11} /> 매핑 {mappingCount}개
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}
          className="p-2 rounded-lg text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete}
          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export function B2bPartnersPage() {
  const {
    coupangPartners, saveCoupangPartner, updateCoupangPartner, deleteCoupangPartner, moveCoupangPartner, reorderCoupangPartners, savePerMarketMapping, deletePerMarketMapping,
    marketTemplates, saveMarketTemplate, updateMarketTemplate, deleteMarketTemplate,
    supplierMappingPresets, saveSupplierMappingPreset, updateSupplierMappingPreset, deleteSupplierMappingPreset,
  } = useSettingsStore()

  const location = useLocation()
  const navigate = useNavigate()

  const [tab,       setTab]       = useState<Tab>('b2b')
  const [formOpen,  setFormOpen]  = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form,      setForm]      = useState<FormState>(emptyForm())

  // 거래처 송장 매핑 프리셋 전용 상태
  const [sFormOpen,  setSFormOpen]  = useState(false)
  const [sEditingId, setSEditingId] = useState<string | null>(null)
  const [sForm,      setSForm]      = useState<SupplierForm>(emptySupplierForm())

  // 송장 매칭 프리셋은 고급 기능 — 기존 프리셋이 있거나 사용자가 명시적으로 펼쳤을 때만 노출
  const [showAdvanced, setShowAdvanced] = useState(false)
  const showSupplierTab = showAdvanced || supplierMappingPresets.length > 0
  useEffect(() => {
    if (tab === 'supplier' && !showSupplierTab) setTab('b2b')
  }, [tab, showSupplierTab])

  const isB2b = tab === 'b2b'

  // ── 거래처 드래그 정렬 ──
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const handlePartnerDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = coupangPartners.map(p => p.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    reorderCoupangPartners(arrayMove(ids, oldIndex, newIndex))
  }

  // ── supplier 탭 핸들러 ──
  const openAddSupplier = () => { setSEditingId(null); setSForm(emptySupplierForm()); setSFormOpen(true) }

  const openEditSupplier = (p: SupplierMappingPreset) => {
    setSEditingId(p.id)
    setSForm({ name: p.name, file: null, headers: p.headers, rows: [], keyPairs: p.keyPairs, invoiceCol: p.invoiceCol, carrierCol: p.carrierCol })
    setSFormOpen(true)
  }

  const closeSupplierForm = () => { setSFormOpen(false); setSEditingId(null); setSForm(emptySupplierForm()) }

  const handleSupplierFile = async (file: File | null) => {
    setSForm(f => ({ ...f, file, headers: [], rows: [], invoiceCol: '', carrierCol: '', keyPairs: [{ orderCol: '수취인이름', supplierCol: '' }] }))
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      const rows = parsed.rows as Record<string, unknown>[]
      const pickCol = (pat: RegExp) => {
        const matches = parsed.headers.filter(h => pat.test(h))
        if (!matches.length) return ''
        return matches.find(c => rows.some(r => String(r[c] ?? '').trim())) ?? matches[0]
      }
      // 자동 키쌍 감지
      const nameCol  = pickCol(/수령인이름|수령인명|받는분이름|받는분명|^수령인$/)
      const phoneCol = pickCol(/수령인전화|수령인.*핸드폰|수령인.*폰|수령인.*번호|수령인.*연락처/)
      const pairs: Array<{ orderCol: string; supplierCol: string }> = []
      if (nameCol)  pairs.push({ orderCol: '수취인이름', supplierCol: nameCol })
      if (phoneCol) pairs.push({ orderCol: '수취인전화번호', supplierCol: phoneCol })
      if (!pairs.length) pairs.push({ orderCol: '수취인이름', supplierCol: parsed.headers[0] ?? '' })
      setSForm(f => ({
        ...f,
        headers:    parsed.headers,
        rows,
        keyPairs:   pairs,
        invoiceCol: pickCol(/운송장|송장번호|invoice/i),
        carrierCol: pickCol(/택배사|배송업체|배송사|carrier/i),
      }))
    } catch (err) { console.error(err) }
  }

  const handleSaveSupplier = () => {
    if (!sForm.name.trim() || !sForm.headers.length || !sForm.invoiceCol) return
    if (sEditingId) {
      updateSupplierMappingPreset(sEditingId, { name: sForm.name.trim(), keyPairs: sForm.keyPairs, invoiceCol: sForm.invoiceCol, carrierCol: sForm.carrierCol })
    } else {
      saveSupplierMappingPreset(sForm.name.trim(), sForm.headers, sForm.keyPairs, sForm.invoiceCol, sForm.carrierCol)
    }
    closeSupplierForm()
  }

  const canSaveSupplier = sForm.name.trim() && (sForm.headers.length > 0 || sEditingId) && sForm.invoiceCol

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setFormOpen(true) }

  const openEditB2b = (p: CoupangPartner) => {
    setEditingId(p.id)
    // 쿠팡 탭 기본 로드: marketMappings['쿠팡'] 있으면 그 데이터, 없으면 레거시 mapping 사용
    const coupangMM = p.marketMappings?.find(m => m.marketType === '쿠팡')
    setForm({ name: p.partnerName, prefix: p.prefix, b2bFile: null,
      headers: p.b2bHeaders, fileData: p.b2bFileData ?? '',
      selectedMarketType: '쿠팡',
      marketFile: null,
      marketHeaders: coupangMM?.marketHeaders ?? p.marketHeaders ?? [],
      marketFileData: coupangMM?.marketFileData ?? p.marketFileData ?? '',
      mapping: coupangMM?.mapping ?? p.mapping,
      appendValues: coupangMM?.appendValues ?? p.appendValues,
      loadedPresetId: p.id })
    setFormOpen(true)
  }

  const openEditMarket = (t: MarketTemplate) => {
    setEditingId(t.id)
    setForm({ name: t.marketName, prefix: '', b2bFile: null,
      headers: t.headers, fileData: t.fileData ?? '',
      marketFile: null, marketHeaders: t.marketHeaders ?? [], marketFileData: t.marketFileData ?? '',
      mapping: t.mapping, appendValues: t.appendValues, loadedPresetId: t.id })
    setFormOpen(true)
  }

  const closeForm = () => { setFormOpen(false); setEditingId(null); setForm(emptyForm()) }

  const handleFile = async (file: File | null) => {
    setForm(f => ({ ...f, b2bFile: file, headers: [], fileData: '', mapping: {}, appendValues: {} }))
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const init: ColumnMapping = {}
        parsed.headers.forEach(h => { init[h] = null })
        setForm(f => ({ ...f, headers: parsed.headers, fileData: (e.target?.result as string) ?? '', mapping: init }))
      }
      reader.readAsDataURL(file)
    } catch (err) { console.error(err) }
  }

  const handleMarketFile = async (file: File | null) => {
    setForm(f => ({ ...f, marketFile: file, marketHeaders: [], marketFileData: '' }))
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setForm(f => ({ ...f, marketHeaders: parsed.headers, marketFileData: (e.target?.result as string) ?? '' }))
      }
      reader.readAsDataURL(file)
    } catch (err) { console.error(err) }
  }

  // 마켓 탭 전환 시 해당 마켓의 저장된 매핑 로드
  const handleMarketTypeChange = (mt: MarketType) => {
    if (!editingId) { setForm(f => ({ ...f, selectedMarketType: mt, marketFile: null, marketHeaders: [], marketFileData: '', mapping: {}, appendValues: {} })); return }
    const partner = coupangPartners.find(p => p.id === editingId)
    const mm = partner?.marketMappings?.find(m => m.marketType === mt)
    setForm(f => ({
      ...f,
      selectedMarketType: mt,
      marketFile: null,
      marketHeaders: mm?.marketHeaders ?? [],
      marketFileData: mm?.marketFileData ?? '',
      mapping: mm?.mapping ?? {},
      appendValues: mm?.appendValues ?? {},
      loadedPresetId: editingId,
    }))
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (isB2b && !form.prefix.trim()) return

    if (isB2b) {
      const existing = editingId ? coupangPartners.find(p => p.id === editingId) : null
      // 현재 마켓 탭의 매핑을 marketMappings에 업데이트
      const currentMM = {
        marketType:      form.selectedMarketType,
        marketFileName:  form.marketFile?.name ?? existing?.marketMappings?.find(m => m.marketType === form.selectedMarketType)?.marketFileName,
        marketFileData:  form.marketFileData || existing?.marketMappings?.find(m => m.marketType === form.selectedMarketType)?.marketFileData,
        marketHeaders:   form.marketHeaders.length > 0 ? form.marketHeaders : (existing?.marketMappings?.find(m => m.marketType === form.selectedMarketType)?.marketHeaders ?? []),
        mapping:         form.mapping,
        appendValues:    form.appendValues,
      }
      const prevMMs = existing?.marketMappings ?? []
      const newMMs = [...prevMMs.filter(m => m.marketType !== form.selectedMarketType), currentMM]
      // 쿠팡 탭이면 레거시 필드도 함께 저장
      const isCoupang = form.selectedMarketType === '쿠팡'
      const data = {
        partnerName:     form.name.trim(), prefix: form.prefix.trim().toUpperCase(),
        b2bFileName:     form.b2bFile?.name ?? existing?.b2bFileName,
        b2bFileData:     form.fileData || existing?.b2bFileData,
        b2bHeaders:      form.headers.length > 0 ? form.headers : (existing?.b2bHeaders ?? []),
        marketFileName:  isCoupang ? (form.marketFile?.name ?? existing?.marketFileName) : existing?.marketFileName,
        marketFileData:  isCoupang ? (form.marketFileData || existing?.marketFileData) : existing?.marketFileData,
        marketHeaders:   isCoupang ? (form.marketHeaders.length > 0 ? form.marketHeaders : (existing?.marketHeaders ?? [])) : (existing?.marketHeaders ?? []),
        mapping:         isCoupang ? form.mapping : (existing?.mapping ?? {}),
        appendValues:    isCoupang ? form.appendValues : (existing?.appendValues ?? {}),
        marketMappings:  newMMs,
      }
      editingId ? updateCoupangPartner(editingId, data) : saveCoupangPartner(data)
    } else {
      const existing = editingId ? marketTemplates.find(t => t.id === editingId) : null
      const data = {
        marketName:      form.name.trim(),
        fileName:        form.b2bFile?.name ?? existing?.fileName,
        fileData:        form.fileData || existing?.fileData,
        headers:         form.headers.length > 0 ? form.headers : (existing?.headers ?? []),
        marketFileName:  form.marketFile?.name ?? existing?.marketFileName,
        marketFileData:  form.marketFileData || existing?.marketFileData,
        marketHeaders:   form.marketHeaders.length > 0 ? form.marketHeaders : (existing?.marketHeaders ?? []),
        mapping: form.mapping, appendValues: form.appendValues,
      }
      editingId ? updateMarketTemplate(editingId, data) : saveMarketTemplate(data)
    }
    closeForm()
  }

  const canSave = form.name.trim() && (isB2b ? form.prefix.trim() : true)

  const existingFileName = editingId
    ? isB2b
      ? coupangPartners.find(p => p.id === editingId)?.b2bFileName
      : marketTemplates.find(t => t.id === editingId)?.fileName
    : undefined

  const existingMarketFileName = editingId
    ? isB2b
      ? coupangPartners.find(p => p.id === editingId)?.marketFileName
      : marketTemplates.find(t => t.id === editingId)?.marketFileName
    : undefined

  const fallbackOrderHeaders = isB2b ? ORDER_HEADERS : INVOICE_HEADERS
  const orderHeaders = form.marketHeaders.length > 0 ? form.marketHeaders : fallbackOrderHeaders

  // 온보딩 체크리스트 deep-link 처리
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const action = params.get('action')
    if (!action) return

    if (action === 'add-partner') {
      setTab('b2b')
      openAdd()
    } else if (action === 'edit-partner') {
      setTab('b2b')
      if (coupangPartners.length > 0) {
        openEditB2b(coupangPartners[0])
        if (params.get('focus') === 'mapping') {
          setTimeout(() => {
            document.getElementById('mapping-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 300)
        }
      } else {
        openAdd()
      }
    }
    navigate('/b2b-partners', { replace: true })
  }, [location.search])

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6 animate-fade-in">

        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Database size={20} className="text-emerald-400" />
              거래처 B2B 관리
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              1회 등록 → 모든 매칭 탭 자동 적용
            </p>
          </div>
          {tab !== 'supplier' && !formOpen && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all shadow-lg shadow-primary-500/20">
              <Plus size={15} /> {isB2b ? '거래처 추가' : '마켓 추가'}
            </button>
          )}
          {tab === 'supplier' && !sFormOpen && (
            <button onClick={openAddSupplier}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-lg shadow-amber-500/20">
              <Plus size={15} /> 거래처 추가
            </button>
          )}
        </div>

        {/* 쿠팡 안내 배너 */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/25">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            <span className="font-semibold">쿠팡만 사용</span>하시면 <span className="font-semibold text-emerald-100">B2B 주문 양식</span>만 등록하면 끝!
            <span className="text-emerald-300/70"> · 송장 매칭 프리셋·마켓 송장등록 양식은 표준 파일이면 자동 인식</span>
          </p>
        </div>

        {/* 다중 PC 사용 안내 */}
        <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl bg-primary-500/8 border border-primary-500/25">
          <Monitor size={14} className="text-primary-400 shrink-0 mt-0.5" />
          <p className="text-xs text-primary-200/90 leading-relaxed">
            <span className="font-semibold">2대 이상의 PC에서 사용하시나요?</span>
            <span className="text-primary-300/80"> 등록한 거래처는 PC별로 따로 저장되니, </span>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="font-semibold text-primary-100 underline underline-offset-2 hover:text-white transition-colors"
            >
              설정 → 거래처 백업·가져오기
            </button>
            <span className="text-primary-300/80">에서 .json 파일로 옮길 수 있습니다. </span>
            <button
              type="button"
              onClick={() => navigate('/help')}
              className="text-primary-100 underline underline-offset-2 hover:text-white transition-colors"
            >
              자세한 방법 보기 →
            </button>
          </p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 p-1 rounded-xl bg-dark-hover border border-dark-border">
          <button
            onClick={() => { setTab('b2b'); closeForm() }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all border
              ${tab === 'b2b'
                ? 'bg-primary-500/15 border-primary-500/40 text-primary-300 shadow-sm shadow-primary-500/10'
                : 'border-transparent text-slate-500 hover:text-primary-300 hover:bg-primary-500/5'}`}
          >
            <FileSpreadsheet size={15} /> B2B 주문 양식
          </button>
          <button
            onClick={() => { setTab('invoice'); closeForm() }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all border
              ${tab === 'invoice'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
                : 'border-transparent text-slate-500 hover:text-amber-300 hover:bg-amber-500/5'}`}
          >
            <Store size={15} /> 마켓 송장등록 양식
          </button>
          {showSupplierTab && (
            <button
              onClick={() => { setTab('supplier'); closeForm() }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all border
                ${tab === 'supplier'
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-sm shadow-sky-500/10'
                  : 'border-transparent text-slate-500 hover:text-sky-300 hover:bg-sky-500/5'}`}
            >
              <Truck size={15} /> 송장 매칭 프리셋
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300">고급</span>
              {supplierMappingPresets.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-600/40 text-slate-300">{supplierMappingPresets.length}</span>
              )}
            </button>
          )}
        </div>

        {/* 고급 기능 토글 — 프리셋 없는 사용자에게만 노출 */}
        {!showSupplierTab && (
          <button
            onClick={() => { setShowAdvanced(true); setTab('supplier') }}
            className="flex items-center gap-1.5 mx-auto text-[11px] text-slate-500 hover:text-amber-400 transition-colors"
          >
            <Truck size={11} /> 고급: 송장 매칭 프리셋 표시
            <span className="text-slate-600">— 거래처 송장 파일 컬럼명이 특이할 때만 사용</span>
          </button>
        )}

        {/* 탭 설명 */}
        {!formOpen && !sFormOpen && (
          <div className={`px-4 py-3 rounded-xl text-xs leading-relaxed border
            ${tab === 'b2b'
              ? 'bg-primary-500/5 border-primary-500/20 text-primary-400/80'
              : tab === 'invoice'
                ? 'bg-amber-500/5 border-amber-500/20 text-amber-400/80'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-400/80'}`}>
            {tab === 'b2b' ? (
              <>
                <span className="font-semibold text-primary-400">B2B 주문 양식</span>은 거래처(도매처)에 보내는 발주서예요.
                <span className="text-red-400">접두어</span>를 등록하면 <span className="text-red-400">업체상품코드</span> 기준으로 <span className="text-slate-300">자동 분류</span>되며, <span className="text-slate-300">컬럼 설정</span>을 저장해두면 매번 자동 적용됩니다.
              </>
            ) : tab === 'invoice' ? (
              <>
                <span className="font-semibold text-amber-400">마켓 송장등록 양식</span>은 <span className="text-red-400">자체 업로드 양식을 요구하는 까다로운 마켓</span>(컬럼명/순서가 다른 경우)에만 필요해요.
                양식을 등록해두면 매칭 결과가 해당 마켓 양식에 맞게 <span className="text-slate-300">자동 변환</span>됩니다.
                <span className="block mt-1.5 text-xs text-slate-400">※ 쿠팡은 API 전송이라 불필요하고, 대부분의 마켓은 주문 엑셀 그대로 올리면 되므로 등록 안 해도 됩니다.</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-amber-400">송장 매칭 프리셋</span>은 거래처가 보내주는 <span className="text-red-400">운송장 파일의 컬럼명이 특이할 때</span>(예: "고객성함", "연락처", "택배번호") 매칭 규칙을 저장하는 기능이에요.
                한 번 등록하면 다음부터는 <span className="text-slate-300">파일 올릴 때 자동 인식 → 자동 실행</span>됩니다.
                <span className="block mt-1.5 text-xs text-slate-400">※ 거래처 파일 컬럼명이 "수령인명/전화번호/운송장번호"처럼 표준적이면 자동 감지로 잘 잡히므로 등록 안 해도 됩니다.</span>
              </>
            )}
          </div>
        )}

        {/* ── supplier 탭 목록 ── */}
        {tab === 'supplier' && !sFormOpen && (
          <div className="space-y-3">
            {supplierMappingPresets.length === 0 ? (
              <EmptyState
                icon={<Truck size={36} className="mx-auto text-slate-600" />}
                label="등록된 송장 매칭 프리셋이 없어요"
                desc={'거래처 배송목록 파일을 등록해두면\n송장번호 추가 탭에서 자동으로 인식됩니다'}
                onAdd={openAddSupplier}
                addLabel="첫 프리셋 등록하기"
              />
            ) : (
              <>
                {supplierMappingPresets.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-4 rounded-2xl border border-dark-border bg-dark-card hover:border-amber-500/30 transition-all group">
                    <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center shrink-0 gap-0.5">
                      <Truck size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                        {p.usageCount > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            <Zap size={9} /> {p.usageCount}회 사용
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">컬럼 {p.headers.length}개</span>
                        <span className="text-xs text-slate-600">키: {p.keyPairs.map(k => k.supplierCol).join(', ')}</span>
                        <span className="text-xs text-emerald-400/70">운송장: {p.invoiceCol}</span>
                        {p.carrierCol && <span className="text-xs text-sky-400/70">택배사: {p.carrierCol}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditSupplier(p)}
                        className="p-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deleteSupplierMappingPreset(p.id)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                <AddMoreButton label="프리셋 추가" onClick={openAddSupplier} />
              </>
            )}
          </div>
        )}

        {/* ── supplier 탭 폼 ── */}
        {tab === 'supplier' && sFormOpen && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-base font-semibold text-slate-200">
                  {sEditingId ? '프리셋 수정' : '송장 매칭 프리셋 추가'}
                </p>
                <p className="text-xs text-slate-500">
                  B2B 거래처에서 송장번호가 포함되어 내려받은 엑셀의 컬럼 매핑을 저장합니다
                </p>
              </div>
              <button onClick={closeSupplierForm} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
              {/* 거래처 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">거래처 이름</label>
                <input type="text" placeholder="예: A거래처, 쿠팡물류, CJ대한통운"
                  value={sForm.name} onChange={e => setSForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* 거래처 배송목록 파일 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <FileSpreadsheet size={11} className="text-amber-400" />
                  거래처 배송목록 파일 (운송장번호 포함)
                  {sEditingId && !sForm.file && <span className="text-slate-600 font-normal">(새 파일 업로드 시 교체)</span>}
                </label>
                <FileUploader label="" file={sForm.file} onFileChange={handleSupplierFile} compact />
                {sForm.headers.length > 0 && (
                  <p className="text-xs text-amber-400/70">컬럼 {sForm.headers.length}개 인식</p>
                )}
              </div>
            </div>

            {/* 컬럼 설정 (파일 업로드 후 또는 수정 시) */}
            {(sForm.headers.length > 0 || sEditingId) && (
              <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4 animate-fade-in">
                <p className="text-sm font-semibold text-slate-200">매칭 컬럼 설정</p>

                {/* 키 쌍 */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">교차 검증 컬럼 — 주문과 거래처 파일을 연결하는 기준</p>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 px-1">
                    <span className="text-[10px] text-slate-600 text-center">주문 컬럼</span><span />
                    <span className="text-[10px] text-slate-600 text-center">거래처 파일 컬럼</span><span />
                  </div>
                  {sForm.keyPairs.map((pair, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                      <select value={pair.orderCol}
                        onChange={e => setSForm(f => ({ ...f, keyPairs: f.keyPairs.map((p, i) => i === idx ? { ...p, orderCol: e.target.value } : p) }))}
                        className="px-2.5 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                        {STANDARD_ORDER_COLS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="text-xs font-bold px-1 text-slate-500">=</span>
                      <select value={pair.supplierCol}
                        onChange={e => setSForm(f => ({ ...f, keyPairs: f.keyPairs.map((p, i) => i === idx ? { ...p, supplierCol: e.target.value } : p) }))}
                        className="px-2.5 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                        <option value="">— 선택 —</option>
                        {sForm.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <button onClick={() => setSForm(f => ({ ...f, keyPairs: f.keyPairs.filter((_, i) => i !== idx) }))}
                        disabled={sForm.keyPairs.length === 1}
                        className="p-1.5 rounded text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setSForm(f => ({ ...f, keyPairs: [...f.keyPairs, { orderCol: '수취인전화번호', supplierCol: '' }] }))}
                    className="flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-300 transition-colors px-1 pt-1">
                    <Plus size={12} /> 검증 컬럼 추가
                  </button>
                </div>

                <div className="border-t border-dark-border/50" />

                {/* 운송장/택배사 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">택배사 컬럼</label>
                    <select value={sForm.carrierCol} onChange={e => setSForm(f => ({ ...f, carrierCol: e.target.value }))}
                      className="w-full px-2.5 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                      <option value="">— 선택 안 함 —</option>
                      {sForm.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">운송장번호 컬럼 *</label>
                    <select value={sForm.invoiceCol} onChange={e => setSForm(f => ({ ...f, invoiceCol: e.target.value }))}
                      className="w-full px-2.5 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                      <option value="">— 선택 —</option>
                      {sForm.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={closeSupplierForm}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all">
                취소
              </button>
              <button onClick={handleSaveSupplier} disabled={!canSaveSupplier}
                className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20">
                {sEditingId ? '수정 완료' : '프리셋 저장'}
              </button>
            </div>
          </div>
        )}

        {/* ── b2b/invoice 탭 목록 ── */}
        {tab !== 'supplier' && !formOpen && (
          <div className="space-y-3">
            {isB2b ? (
              coupangPartners.length === 0 ? (
                <EmptyState
                  icon={<FileSpreadsheet size={36} className="mx-auto text-slate-600" />}
                  label="등록된 거래처가 없어요"
                  desc="거래처를 등록하면 모든 매칭 탭에서&#10;B2B 파일을 자동으로 채워줍니다"
                  onAdd={openAdd}
                  addLabel="첫 거래처 등록하기"
                />
              ) : (
                <>
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handlePartnerDragEnd}>
                    <SortableContext items={coupangPartners.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {coupangPartners.map((p, idx) => (
                          <PartnerCard
                            key={p.id} id={p.id} sortable
                            prefix={p.prefix} name={p.partnerName}
                            fileName={p.b2bFileName} mappingCount={Object.values(p.mapping).filter(Boolean).length}
                            hasFile={p.b2bHeaders.length > 0}
                            onEdit={() => openEditB2b(p)}
                            onDelete={() => deleteCoupangPartner(p.id)}
                            onMoveUp={() => moveCoupangPartner(p.id, 'up')}
                            onMoveDown={() => moveCoupangPartner(p.id, 'down')}
                            isFirst={idx === 0}
                            isLast={idx === coupangPartners.length - 1}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <AddMoreButton label="거래처 추가" onClick={openAdd} />
                </>
              )
            ) : (
              marketTemplates.length === 0 ? (
                <EmptyState
                  icon={<Store size={36} className="mx-auto text-slate-600" />}
                  label="등록된 마켓 양식이 없어요"
                  desc="쿠팡·스마트스토어 등 마켓별&#10;송장 업로드 양식을 등록해 두세요"
                  onAdd={openAdd}
                  addLabel="첫 마켓 양식 등록하기"
                />
              ) : (
                <>
                  {marketTemplates.map(t => (
                    <PartnerCard
                      key={t.id} name={t.marketName}
                      fileName={t.fileName} mappingCount={Object.values(t.mapping).filter(Boolean).length}
                      hasFile={t.headers.length > 0}
                      onEdit={() => openEditMarket(t)}
                      onDelete={() => deleteMarketTemplate(t.id)}
                    />
                  ))}
                  <AddMoreButton label="마켓 추가" onClick={openAdd} />
                </>
              )
            )}
          </div>
        )}

        {/* ── b2b/invoice 탭 추가 / 수정 폼 ── */}
        {tab !== 'supplier' && formOpen && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-slate-200">
                {editingId
                  ? (isB2b ? '거래처 수정' : '마켓 양식 수정')
                  : (isB2b ? '거래처 추가' : '마켓 양식 추가')}
              </p>
              <button onClick={closeForm} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
              <div className={`grid gap-4 ${isB2b ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 h-4">
                    <Store size={11} /> {isB2b ? '거래처명' : '마켓명'}
                  </label>
                  <input
                    type="text"
                    placeholder={isB2b ? '예: 달롬A, 서울물산' : '예: 쿠팡, 스마트스토어'}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary-500/50"
                  />
                </div>
                {isB2b && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5 h-4">
                      <Tag size={11} /><span className="text-slate-300 font-semibold">접두어 매칭 </span><span className="text-red-400">업체상품코드 앞 두 글자 반드시 동일</span>
                    </label>
                    <input
                      type="text" placeholder="예: DA, SB, KT"
                      value={form.prefix}
                      onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                      maxLength={10}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary-500/50 uppercase font-mono tracking-wider"
                    />
                  </div>
                )}
              </div>

              {/* 마켓별 주문 원본 엑셀 업로드 — B2B 주문 양식 탭에서만 표시 */}
              {isB2b && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <FileSpreadsheet size={11} className="text-amber-400" />
                      마켓 주문 원본 엑셀
                      <span className="text-slate-600 font-normal">(마켓에서 다운받은 주문서)</span>
                    </label>
                    {/* 마켓 타입 탭 */}
                    <div className="flex flex-wrap gap-1.5">
                      {MARKET_TYPES.map(mt => {
                        const partner = editingId ? coupangPartners.find(p => p.id === editingId) : null
                        const hasMM = partner?.marketMappings?.some(m => m.marketType === mt && (m.marketHeaders?.length ?? 0) > 0)
                        return (
                          <button
                            key={mt}
                            type="button"
                            onClick={() => handleMarketTypeChange(mt)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                              ${form.selectedMarketType === mt
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-dark-hover text-slate-400 border-dark-border hover:border-amber-500/30 hover:text-amber-300'}`}
                          >
                            {mt}
                            {hasMM && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                    {/* 선택된 마켓의 파일 업로드 */}
                    {(() => {
                      const partner = editingId ? coupangPartners.find(p => p.id === editingId) : null
                      const savedMM = partner?.marketMappings?.find(m => m.marketType === form.selectedMarketType)
                      const savedFileName = savedMM?.marketFileName
                      return (
                        <>
                          {editingId && !form.marketFile && savedFileName && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                              <CheckCircle2 size={12} />
                              기존 파일 유지: <span className="font-medium">{savedFileName}</span>
                              <span className="text-slate-500 ml-1">(새 파일 업로드 시 교체)</span>
                            </div>
                          )}
                          <FileUploader label="" file={form.marketFile} onFileChange={handleMarketFile} compact />
                          {form.marketHeaders.length > 0 && (
                            <p className="text-xs text-amber-400/70">
                              컬럼 {form.marketHeaders.length}개 인식 — 이 컬럼이 매핑 왼쪽({form.selectedMarketType} 주문 컬럼)으로 사용됩니다
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <div className="border-t border-dark-border" />
                </>
              )}

              {editingId && !form.b2bFile && existingFileName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                  <CheckCircle2 size={12} />
                  기존 파일 유지: <span className="font-medium">{existingFileName}</span>
                  <span className="text-slate-500 ml-1">(새 파일 업로드 시 교체)</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  {isB2b ? 'B2B 발주서 엑셀 파일' : '마켓 송장등록 엑셀 양식'}
                </label>
                <FileUploader label="" file={form.b2bFile} onFileChange={handleFile} compact />
              </div>
            </div>

            {/* 컬럼 매핑 */}
            {form.headers.length > 0 && (
              <div id="mapping-section" className="rounded-2xl border border-dark-border bg-dark-card p-5 animate-fade-in">
                <ColumnMapper
                  orderHeaders={orderHeaders}
                  b2bHeaders={form.headers}
                  mapping={form.mapping}
                  appendValues={form.appendValues}
                  b2bFileName={form.b2bFile?.name}
                  b2bFileData={form.fileData}
                  loadedPresetId={form.loadedPresetId ?? undefined}
                  selectedMarketType={isB2b ? form.selectedMarketType : undefined}
                  mode={isB2b ? 'order' : 'invoice'}
                  onMappingChange={mapping => setForm(f => ({ ...f, mapping }))}
                  onAppendValuesChange={appendValues => setForm(f => ({ ...f, appendValues }))}
                  onPresetLoaded={id => setForm(f => ({ ...f, loadedPresetId: id }))}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={closeForm}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all">
                취소
              </button>
              <button onClick={handleSave} disabled={!canSave}
                className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20">
                {editingId ? '수정 완료' : (isB2b ? '거래처 저장' : '마켓 양식 저장')}
              </button>
            </div>
          </div>
        )}

        {/* 3가지 양식 차이 안내 (항상 하단 표시) */}
        <FormatGuideBanner />

        {/* 대시보드로 돌아가기 */}
        <div className="flex justify-center pt-4 pb-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-dark-hover hover:bg-slate-700 text-slate-300 border border-dark-border transition-all"
          >
            <ArrowLeft size={14} /> 대시보드로 돌아가기
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── 3가지 양식 차이 안내 배너 ────────────────────────────────────────────────

function FormatGuideBanner() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-dark-border bg-dark-card/40 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-dark-hover/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <span className="text-sm font-semibold text-slate-200">3가지 양식 차이 — 헷갈리시면 클릭</span>
        </div>
        {open
          ? <ChevronUp size={16} className="text-slate-500" />
          : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 animate-fade-in border-t border-dark-border">

          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-300/90">
            ✓ 쿠팡만 사용하시면 <span className="font-semibold">마켓 송장등록 양식 등록 불필요</span> (API 자동 전송)
          </div>

          {/* 비교 표 */}
          <div className="rounded-xl border border-dark-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-dark-hover">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">양식</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">방향</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">용도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                <tr>
                  <td className="px-3 py-2.5 text-primary-400 font-semibold">B2B 주문 양식</td>
                  <td className="px-3 py-2.5 text-slate-400">출력</td>
                  <td className="px-3 py-2.5 text-slate-300">거래처(도매처)에 보낼 발주서 양식</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-amber-400 font-semibold">송장 매칭 프리셋</td>
                  <td className="px-3 py-2.5 text-slate-400">입력</td>
                  <td className="px-3 py-2.5 text-slate-300">거래처에서 받은 엑셀에서 송장번호 추출</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-amber-400 font-semibold">마켓 송장등록 양식</td>
                  <td className="px-3 py-2.5 text-slate-400">출력</td>
                  <td className="px-3 py-2.5 text-slate-300">마켓에 업로드할 양식으로 변환</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 운송장 흐름 다이어그램 */}
          <div className="rounded-xl bg-dark-hover/40 border border-dark-border p-4 space-y-2 text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-slate-200 mb-1.5">📦 운송장 매칭 흐름</p>
            <p>① 거래처가 송장번호 들어간 엑셀을 보냄</p>
            <p className="pl-3 text-amber-400/80">↓ <span className="font-semibold">송장 매칭 프리셋</span>이 컬럼 자동 인식 → 송장번호 추출</p>
            <p>② 원 주문과 송장번호 매칭</p>
            <p className="pl-3 text-slate-500">↓</p>
            <p>③ 결과 출력</p>
            <p className="pl-3 text-emerald-400/80">├─ 쿠팡: API로 자동 전송 (양식 불필요)</p>
            <p className="pl-3 text-amber-400/80">└─ 까다로운 마켓: <span className="font-semibold">마켓 송장등록 양식</span> 형식으로 엑셀 다운로드</p>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── 작은 공통 컴포넌트 ───────────────────────────────────────────────────────

function EmptyState({ icon, label, desc, onAdd, addLabel }: {
  icon: React.ReactNode; label: string; desc: string; onAdd: () => void; addLabel: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-dark-border bg-dark-card/40 py-14 text-center space-y-3">
      {icon}
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{desc}</p>
      <button onClick={onAdd}
        className="mx-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  )
}

function AddMoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-dashed border-dark-border text-slate-500 hover:border-primary-500/40 hover:text-primary-400 transition-all">
      <Plus size={14} /> {label}
    </button>
  )
}
