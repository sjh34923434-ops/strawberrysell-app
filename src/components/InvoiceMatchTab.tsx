import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileSpreadsheet, Truck, Play, Loader2, CheckCircle2, AlertCircle,
  RotateCcw, Plus, X, ChevronDown, ChevronUp, Upload, Save, Zap, BookMarked, Download,
} from 'lucide-react'
import { useSettingsStore, type SavedOrderSource, type MarketType } from '../stores/settingsStore'
import { useBusinessStore } from '../stores/businessStore'
import { coupangApi } from '../api/client'
import { Send } from 'lucide-react'
import { DownloadButton } from './DownloadButton'
import { downloadFilledB2b } from '../utils/excelWriter'
import { readExcelFile, type ParsedExcel } from '../utils/excelReader'
import { fillB2bFromOrder, autoMatchColumns, ROW_NUMBER_KEY, type ColumnMapping } from '../utils/fillMapper'

const COUPANG_CARRIER_MAP: Record<string, string> = {
  'CJ대한통운': 'CJGLS',
  'CJ': 'CJGLS',
  '한진택배':   'HANJIN',
  '한진':       'HANJIN',
  '롯데택배':   'LOTTE',
  '롯데':       'LOTTE',
  '우체국택배': 'EPOST',
  '우체국':     'EPOST',
  '로젠택배':   'KGB',
  '로젠':       'KGB',
  '경동택배':   'KDEXP',
  '경동':       'KDEXP',
  '대신택배':   'DAESIN',
  '일양택배':   'ILYANG',
  '천일택배':   'CHUNIL',
}

interface InvoiceMatchTabProps {
  source:      SavedOrderSource
  marketType?: MarketType
}

const SOURCE_LABEL: Record<SavedOrderSource, string> = {
  'coupang-api':  '쿠팡 자동매칭',
  'matching':     '주문매칭',
  'multi-match':  '일괄매칭',
}

// 다운로드 파일명용 마켓별 영문 코드
const MARKET_EN: Record<string, string> = {
  '쿠팡':       'Coupang',
  '스마트스토어': 'Smartstore',
  '11번가':     '11st',
  'G마켓':      'Gmarket',
  '옥션':       'Auction',
  '인터파크':   'Interpark',
  '티몬':       'Tmon',
  '위메프':     'Wemakeprice',
  '카카오쇼핑': 'Kakao',
  '쿠팡이츠':   'CoupangEats',
}
const marketToEn = (name: string) => MARKET_EN[name] ?? name.replace(/[^\w]/g, '_')

const KEY_DETECT_PATTERNS = [
  /수취인이름|수취인명|수령인명|수령인이름|받는분이름|받는분명|^수령인$/,
  /수취인전화|수취인.*번호|수령인전화|수령인.*핸드폰|수령인.*폰|수령인.*번호|수령인.*연락처|받는분.*전화|받는분.*번호/,
  /^업체상품코드$|vendorItemId/i,
]

const normalizeKeyVal = (raw: unknown): string => {
  let v = String(raw ?? '').normalize('NFC').replace(/[\s\-]/g, '').toLowerCase()
  if (/^\d+$/.test(v)) v = v.replace(/^0+/, '') || '0'
  return v
}

const makeCompositeKey = (row: Record<string, unknown>, cols: string[]) =>
  cols.map(c => normalizeKeyVal(row[c])).join('§')

interface KeyPair { orderCol: string; supplierCol: string }

interface SupplierEntry {
  id:          string
  file:        File
  data:        ParsedExcel
  keyPairs:    KeyPair[]
  invoiceCol:  string
  carrierCol:  string
  expanded:    boolean
  presetId?:   string
  presetName?: string
}

function pickCol(headers: string[], pattern: RegExp, rows: Record<string, unknown>[]): string {
  const matches = headers.filter(c => pattern.test(c))
  if (matches.length === 0) return ''
  if (matches.length === 1) return matches[0]
  return matches.find(c => rows.some(r => String(r[c] ?? '').trim() !== '')) ?? matches[0]
}

const OPTION_ID_PAT = /^옵션\s*id$|^옵션아이디$|^option\s*id$/i

function autoDetect(
  orderHeaders: string[],
  supplierHeaders: string[],
  supplierRows: Record<string, unknown>[] = [],
): { keyPairs: KeyPair[]; invoiceCol: string; carrierCol: string } {
  const pairs: KeyPair[] = []
  for (const pat of KEY_DETECT_PATTERNS) {
    const oCol = orderHeaders.find(c => pat.test(c))
    const sCol = pickCol(supplierHeaders, pat, supplierRows)
    if (oCol && sCol) pairs.push({ orderCol: oCol, supplierCol: sCol })
  }
  if (pairs.length === 0) pairs.push({ orderCol: orderHeaders[0] ?? '', supplierCol: supplierHeaders[0] ?? '' })
  // 주문 데이터에 옵션ID 컬럼이 있으면 자동으로 단독 검증 추가 (B2B 매핑 없음)
  const optionIdCol = orderHeaders.find(c => OPTION_ID_PAT.test(c))
  if (optionIdCol) pairs.push({ orderCol: optionIdCol, supplierCol: '' })
  const invoiceCol = pickCol(supplierHeaders, /운송장|송장번호|invoice/i, supplierRows)
  const carrierCol = pickCol(supplierHeaders, /택배사|배송업체|배송사|carrier/i, supplierRows)
  return { keyPairs: pairs, invoiceCol, carrierCol }
}

const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function InvoiceMatchTab({ source, marketType }: InvoiceMatchTabProps) {
  const {
    savedOrders,
    saveOrder,
    supplierMappingPresets,
    saveSupplierMappingPreset,
    updateSupplierMappingPreset,
    touchSupplierMappingPreset,
    findSupplierMappingPreset,
    marketTemplates,
  } = useSettingsStore()

  const filtered = savedOrders.filter(o => o.source === source)

  const [savedOrderId,  setSavedOrderId]  = useState('')
  const [entries,       setEntries]       = useState<SupplierEntry[]>([])
  const [isDragging,    setIsDragging]    = useState(false)
  const [isProcessing,  setIsProcessing]  = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [warnings,      setWarnings]      = useState<Array<{ fileName: string; message: string }>>([])
  const [autoRunCount,  setAutoRunCount]  = useState<number | null>(null)  // 카운트다운 (초)
  const [saveModal,     setSaveModal]     = useState<{ entryId: string; name: string } | null>(null)
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)
  const [result, setResult] = useState<{
    rows: Record<string, unknown>[]
    headers: string[]
    matched: number
    unmatched: number
    perFile: Array<{ name: string; matched: number }>
    diagnosis: Array<{
      fileName: string
      cols: Array<{ col: string; orderVal: string; supplierVal: string; ok: boolean }>
    }>
  } | null>(null)

  const [isUploadingOrder, setIsUploadingOrder] = useState(false)
  const [orderDragging,    setOrderDragging]    = useState(false)

  // 쿠팡 전송 상태
  const { businesses, fetch: fetchBiz } = useBusinessStore()
  const [sendBizId,  setSendBizId]  = useState('')
  const [sendConnId, setSendConnId] = useState('')
  const [isSending,  setIsSending]  = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: number; fail: number; message?: string } | null>(null)

  useEffect(() => { if (source === 'coupang-api') fetchBiz() }, [source, fetchBiz])

  const coupangBizList = businesses
    .map(b => ({ ...b, coupangConns: b.connections.filter(c => c.marketplace === 'coupang') }))
    .filter(b => b.coupangConns.length > 0)

  useEffect(() => {
    if (source !== 'coupang-api' || sendBizId) return
    const first = coupangBizList[0]
    if (first) { setSendBizId(first.id); setSendConnId(first.coupangConns[0]?.id ?? '') }
  }, [source, coupangBizList.length, sendBizId])

  const handleSendToCoupang = async () => {
    if (!result || !sendBizId || !sendConnId) return
    const shipmentCol = result.headers.find(h => /묶음배송번호|출고번호|shipmentBoxId/i.test(h))
    const carrierCol  = result.headers.find(h => /^택배사$/.test(h))
    const invoiceCol  = result.headers.find(h => /^운송장번호$/.test(h))
    const orderIdCol  = result.headers.find(h => /^주문번호$|^orderId$/i.test(h)) ?? null
    const vendorItemCol = result.headers.find(h => /^업체상품코드$|vendorItemId/i.test(h)) ?? null
    if (!shipmentCol || !carrierCol || !invoiceCol) {
      setSendResult({ ok: 0, fail: 0, message: '묶음배송번호/택배사/운송장번호 컬럼을 찾을 수 없습니다.' })
      return
    }
    const shipments = result.rows
      .filter(r => String(r[invoiceCol] ?? '').trim() !== '' && String(r[shipmentCol] ?? '').trim() !== '')
      .map(r => {
        const carrierRaw = String(r[carrierCol] ?? '').trim()
        const code = COUPANG_CARRIER_MAP[carrierRaw] ?? COUPANG_CARRIER_MAP[carrierRaw.replace(/택배$/, '')] ?? carrierRaw
        const orderId      = orderIdCol    ? String(r[orderIdCol] ?? '').trim()    : ''
        const vendorItemId = vendorItemCol ? String(r[vendorItemCol] ?? '').trim() : ''
        return {
          shipmentBoxId:        String(r[shipmentCol]),
          ...(orderId      ? { orderId }      : {}),
          ...(vendorItemId ? { vendorItemId } : {}),
          deliveryCompanyCode:  code,
          invoiceNumber:        String(r[invoiceCol]),
        }
      })
    if (shipments.length === 0) {
      setSendResult({ ok: 0, fail: 0, message: '전송할 운송장이 없습니다.' })
      return
    }
    setIsSending(true); setSendResult(null)
    try {
      const res = await coupangApi.confirmShipments(sendBizId, sendConnId, shipments)
      setSendResult({ ok: shipments.length, fail: 0, message: res.message ?? '전송 완료' })
    } catch (err) {
      setSendResult({ ok: 0, fail: shipments.length, message: err instanceof Error ? err.message : '전송 실패' })
    } finally {
      setIsSending(false)
    }
  }

  const resultRef        = useRef<HTMLDivElement>(null)
  const fileInputRef     = useRef<HTMLInputElement>(null)
  const orderFileInputRef = useRef<HTMLInputElement>(null)
  const autoRunTimer     = useRef<ReturnType<typeof setInterval> | null>(null)

  const savedOrder = savedOrders.find(o => o.id === savedOrderId)

  // 자동실행 카운트다운 클린업
  useEffect(() => () => { if (autoRunTimer.current) clearInterval(autoRunTimer.current) }, [])

  // savedOrderId 변경 시 keyPairs의 orderCol 재감지 (프리셋은 유지)
  useEffect(() => {
    if (!savedOrder || entries.length === 0) return
    setEntries(prev => prev.map(e => {
      if (e.presetId) {
        // 프리셋 있으면 orderCol만 현재 주문 헤더로 재매핑
        const preset = supplierMappingPresets.find(p => p.id === e.presetId)
        if (preset) {
          const fallbackOrderCol = autoDetect(savedOrder.headers, e.data.headers, e.data.rows as Record<string, unknown>[]).keyPairs[0]?.orderCol ?? ''
          const kp = preset.keyPairs.map(p => ({
            orderCol: savedOrder.headers.includes(p.orderCol) ? p.orderCol : fallbackOrderCol,
            supplierCol: p.supplierCol,
          }))
          return { ...e, keyPairs: kp }
        }
      }
      return { ...e, ...autoDetect(savedOrder.headers, e.data.headers, e.data.rows as Record<string, unknown>[]) }
    }))
    setResult(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOrderId])

  // 모든 파일이 프리셋으로 자동인식 + 주문 선택 완료 → 자동실행 카운트다운
  useEffect(() => {
    if (autoRunTimer.current) { clearInterval(autoRunTimer.current); autoRunTimer.current = null }
    if (
      entries.length > 0 &&
      savedOrderId &&
      entries.every(e => !!e.presetId) &&
      !isProcessing &&
      !result
    ) {
      setAutoRunCount(3)
      autoRunTimer.current = setInterval(() => {
        setAutoRunCount(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(autoRunTimer.current!)
            autoRunTimer.current = null
            return null
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setAutoRunCount(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map(e => e.presetId).join(','), savedOrderId, isProcessing, result])

  // 카운트다운 0 → 자동실행
  useEffect(() => {
    if (autoRunCount === null && autoRunTimer.current === null && entries.length > 0 && entries.every(e => !!e.presetId) && savedOrderId && !isProcessing && !result) {
      // 카운트다운이 자연종료 (0 도달) → 실행
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunCount])

  const cancelAutoRun = () => {
    if (autoRunTimer.current) { clearInterval(autoRunTimer.current); autoRunTimer.current = null }
    setAutoRunCount(null)
  }

  const addFiles = useCallback(async (files: File[]) => {
    setError(null); setResult(null); setWarnings([])
    const order = savedOrders.find(o => o.id === savedOrderId)
    for (const file of files) {
      try {
        const data = await readExcelFile(file)
        const rows = data.rows as Record<string, unknown>[]
        if (data.warning) setWarnings(prev => [...prev, { fileName: file.name, message: data.warning! }])

        // 프리셋 자동 매칭
        const preset = findSupplierMappingPreset(data.headers, marketType)
        let detected: { keyPairs: KeyPair[]; invoiceCol: string; carrierCol: string }
        let presetId: string | undefined
        let presetName: string | undefined

        if (preset) {
          // 프리셋 keyPairs의 orderCol을 현재 주문 헤더에 맞게 검증
          const fallback = order ? autoDetect(order.headers, data.headers, rows).keyPairs[0]?.orderCol ?? '' : ''
          const kp = preset.keyPairs.map(p => ({
            orderCol: (order && order.headers.includes(p.orderCol)) ? p.orderCol : fallback,
            supplierCol: p.supplierCol,
          }))
          detected = { keyPairs: kp, invoiceCol: preset.invoiceCol, carrierCol: preset.carrierCol }
          presetId   = preset.id
          presetName = preset.name
          touchSupplierMappingPreset(preset.id)
        } else if (order) {
          detected = autoDetect(order.headers, data.headers, rows)
        } else {
          detected = {
            keyPairs:   [{ orderCol: '', supplierCol: data.headers[0] ?? '' }],
            invoiceCol: pickCol(data.headers, /운송장|송장번호/i, rows),
            carrierCol: pickCol(data.headers, /택배사/i, rows),
          }
        }

        setEntries(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`, file, data, ...detected,
          expanded: false, // 항상 닫힌 상태로 시작
          presetId, presetName,
        }])
      } catch (err) {
        setError(err instanceof Error ? err.message : '파일 읽기 오류')
      }
    }
  }, [savedOrderId, savedOrders, findSupplierMappingPreset, touchSupplierMappingPreset])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name))
    if (files.length) addFiles(files)
  }, [addFiles])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    e.target.value = ''
  }

  const removeEntry = (id: string) => {
    const removed = entries.find(e => e.id === id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setResult(null)
    if (removed) setWarnings(prev => prev.filter(w => w.fileName !== removed.file.name))
  }
  const toggleExpanded = (id: string) => setEntries(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e))
  const updateEntry = (id: string, patch: Partial<SupplierEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
    const keys = Object.keys(patch)
    const onlyMeta = keys.length > 0 && keys.every(k => k === 'presetId' || k === 'presetName' || k === 'expanded')
    if (!onlyMeta) setResult(null)
  }

  const addKeyPair = (id: string) => {
    const entry = entries.find(e => e.id === id)
    if (!entry || !savedOrder) return
    updateEntry(id, { keyPairs: [...entry.keyPairs, { orderCol: savedOrder.headers[0] ?? '', supplierCol: entry.data.headers[0] ?? '' }], presetId: undefined, presetName: undefined })
  }
  const removeKeyPair = (id: string, idx: number) => {
    const entry = entries.find(e => e.id === id)
    if (!entry) return
    updateEntry(id, { keyPairs: entry.keyPairs.filter((_, i) => i !== idx), presetId: undefined, presetName: undefined })
  }
  const updateKeyPair = (id: string, idx: number, side: 'orderCol' | 'supplierCol', val: string) => {
    const entry = entries.find(e => e.id === id)
    if (!entry) return
    updateEntry(id, { keyPairs: entry.keyPairs.map((p, i) => i === idx ? { ...p, [side]: val } : p), presetId: undefined, presetName: undefined })
  }

  // 프리셋 저장
  const handleSavePreset = (entryId: string, name: string) => {
    const entry = entries.find(e => e.id === entryId)
    if (!entry || !name.trim()) return
    const saved = saveSupplierMappingPreset(name.trim(), entry.data.headers, entry.keyPairs, entry.invoiceCol, entry.carrierCol, marketType)
    updateEntry(entryId, { presetId: saved.id, presetName: saved.name })
    setSaveModal(null)
    setSavedFeedback(`"${saved.name}" 저장 완료!`)
    setTimeout(() => setSavedFeedback(null), 2500)
  }

  // 프리셋 업데이트 (설정 변경 후 덮어쓰기)
  const handleUpdatePreset = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId)
    if (!entry?.presetId) return
    updateSupplierMappingPreset(entry.presetId, { keyPairs: entry.keyPairs, invoiceCol: entry.invoiceCol, carrierCol: entry.carrierCol })
    setSavedFeedback(`"${entry.presetName}" 업데이트 완료!`)
    setTimeout(() => setSavedFeedback(null), 2500)
  }

  const handleMatch = async () => {
    cancelAutoRun()
    if (!savedOrder || entries.length === 0) return
    const invalidEntry = entries.find(e => e.keyPairs.length === 0 || !e.invoiceCol)
    if (invalidEntry) { setError(`"${invalidEntry.file.name}" — 운송장번호 컬럼을 선택해주세요.`); return }
    setIsProcessing(true); setError(null)
    try {
      await new Promise(r => setTimeout(r, 0))
      // bilateral: supplierCol이 있는 쌍 (B2B 인덱스 조회용)
      // unilateral: supplierCol이 없는 쌍 (주문 고유 식별용 — 예: 옵션ID)
      const VENDOR_CODE_RE = /업체상품코드/
      const orderVendorCol = savedOrder.headers.find(h => VENDOR_CODE_RE.test(h)) ?? null

      const shipmentBoxCol = savedOrder.headers.find(h => /묶음배송번호|출고번호|shipmentBoxId/i.test(h)) ?? null

      const indexes = entries.map(entry => {
        const userBilateral = entry.keyPairs.filter(p => p.supplierCol)
        // 양쪽 파일에 업체상품코드가 있는데 사용자 키에 빠져 있으면 자동으로 bilateral에 추가
        // (다른 상품인데 수령인만 같은 주문이 잘못 매칭되는 것을 방지)
        const supplierVendorCol = entry.data.headers.find(h => VENDOR_CODE_RE.test(h)) ?? null
        const bilateral: KeyPair[] = [...userBilateral]
        if (orderVendorCol && supplierVendorCol && !userBilateral.some(p => VENDOR_CODE_RE.test(p.orderCol))) {
          bilateral.push({ orderCol: orderVendorCol, supplierCol: supplierVendorCol })
        }
        const multiIdx = new Map<string, Record<string, unknown>[]>()
        for (const row of entry.data.rows) {
          const key = makeCompositeKey(row as Record<string, unknown>, bilateral.map(p => p.supplierCol))
          if (key.replace(/§/g, '').trim()) {
            const list = multiIdx.get(key) ?? []
            list.push(row as Record<string, unknown>)
            multiIdx.set(key, list)
          }
        }
        const assignCache  = new Map<string, Record<string, unknown>>()
        const lastAssigned = new Map<string, Record<string, unknown>>()
        // 폴백 시 묶음배송번호 일치 검증용: baseKey → 해당 baseKey로 직전 매칭된 주문의 묶음배송번호
        const lastShipmentBox = new Map<string, string>()
        // 업체상품코드 검증용: 거래처 파일에 있는 업체상품코드 값 Set
        const supplierVendorSet: Set<string> = supplierVendorCol
          ? new Set((entry.data.rows as Record<string, unknown>[]).map(r => normalizeKeyVal(r[supplierVendorCol])).filter(v => v !== ''))
          : new Set()
        return { bilateral, unilateral: entry.keyPairs.filter(p => !p.supplierCol), multiIdx, assignCache, lastAssigned, lastShipmentBox, supplierVendorSet }
      })

      const splitDeliveryCols = savedOrder.headers.filter(h => /분리배송.*[YyNn\/]|분리\s*배송\s*y/i.test(h))
      const applyAutoRules = (row: Record<string, unknown>): Record<string, unknown> => {
        if (splitDeliveryCols.length === 0) return row
        const patched = { ...row }
        for (const col of splitDeliveryCols) { if (String(patched[col] ?? '').trim() !== '') patched[col] = 'N' }
        return patched
      }

      const outputRows: Record<string, unknown>[] = []
      let totalMatched = 0
      const perFileMatched = entries.map(() => 0)
      let firstUnmatchedRow: Record<string, unknown> | null = null

      for (const orderRow of savedOrder.rows) {
        let matchedEi  = -1
        let matchedRow: Record<string, unknown> | undefined

        // Phase 1: 각 B2B 파일에서 새(fresh) 행 시도
        for (let ei = 0; ei < entries.length && matchedRow === undefined; ei++) {
          const { bilateral, unilateral, multiIdx, assignCache, lastAssigned, lastShipmentBox } = indexes[ei]
          const baseKey = makeCompositeKey(orderRow, bilateral.map(p => p.orderCol))
          const currShipBox = shipmentBoxCol ? String(orderRow[shipmentBoxCol] ?? '').trim() : ''

          if (unilateral.length > 0) {
            // 옵션ID 있음: fullKey 캐시로 같은 옵션ID → 같은 B2B 행, 다른 옵션ID → 다음 행
            const fullKey = baseKey + '∥' + makeCompositeKey(orderRow, unilateral.map(p => p.orderCol))
            if (assignCache.has(fullKey)) {
              matchedRow = assignCache.get(fullKey)!
              matchedEi  = ei
            } else {
              const list = multiIdx.get(baseKey)
              if (list && list.length > 0) {
                matchedRow = list.shift()!
                assignCache.set(fullKey, matchedRow)
                lastAssigned.set(baseKey, matchedRow)
                if (currShipBox) lastShipmentBox.set(baseKey, currShipBox)
                matchedEi = ei
              }
            }
          } else {
            // 옵션ID 없음: 순수 FIFO (assignCache 사용 안 함 — block 방지)
            const list = multiIdx.get(baseKey)
            if (list && list.length > 0) {
              matchedRow = list.shift()!
              lastAssigned.set(baseKey, matchedRow)
              if (currShipBox) lastShipmentBox.set(baseKey, currShipBox)
              matchedEi = ei
            }
          }
        }

        // Phase 2: 모든 파일에서 새 행 없음 → lastAssigned 폴백 (B2B 1행인데 주문 2행인 경우)
        // 단, (a) 거래처 파일에 업체상품코드가 있고 주문 행의 업체상품코드가 그 Set에 없으면 폴백 차단
        //     (b) 묶음배송번호가 있고 직전 매칭 주문과 다르면 (= 다른 출고건) 폴백 차단
        if (matchedRow === undefined) {
          for (let ei = 0; ei < entries.length && matchedRow === undefined; ei++) {
            const { bilateral, unilateral, lastAssigned, lastShipmentBox, assignCache, supplierVendorSet } = indexes[ei]
            // 업체상품코드 교차 검증
            if (supplierVendorSet.size > 0 && orderVendorCol) {
              const orderVendorVal = normalizeKeyVal(orderRow[orderVendorCol])
              if (orderVendorVal && !supplierVendorSet.has(orderVendorVal)) continue
            }
            const baseKey = makeCompositeKey(orderRow, bilateral.map(p => p.orderCol))
            // 묶음배송번호 검증: 다른 shipmentBox면 다른 출고건 → 폴백 금지
            if (shipmentBoxCol) {
              const currShipBox = String(orderRow[shipmentBoxCol] ?? '').trim()
              const lastShipBox = lastShipmentBox.get(baseKey)
              if (currShipBox && lastShipBox && currShipBox !== lastShipBox) continue
            }
            const fallback = lastAssigned.get(baseKey)
            if (fallback) {
              matchedRow = fallback
              matchedEi  = ei
              if (unilateral.length > 0) {
                const fullKey = baseKey + '∥' + makeCompositeKey(orderRow, unilateral.map(p => p.orderCol))
                assignCache.set(fullKey, fallback)
              }
            }
          }
        }

        if (matchedRow !== undefined) {
          const entry = entries[matchedEi]
          outputRows.push(applyAutoRules({
            ...orderRow,
            '택배사':    entry.carrierCol ? (matchedRow[entry.carrierCol] ?? '') : '',
            '운송장번호': matchedRow[entry.invoiceCol] ?? '',
          }))
          totalMatched++; perFileMatched[matchedEi]++
        } else {
          outputRows.push({ ...orderRow, '택배사': '', '운송장번호': '' })
          if (!firstUnmatchedRow) firstUnmatchedRow = orderRow
        }
      }

      const diagnosisRows = firstUnmatchedRow
        ? entries.map(entry => {
            const sampleRow = entry.data.rows[0] as Record<string, unknown> | undefined
            return {
              fileName: entry.file.name,
              cols: entry.keyPairs.map(pair => {
                const ov = String(firstUnmatchedRow![pair.orderCol] ?? '').trim()
                const sv = String(sampleRow?.[pair.supplierCol] ?? '').trim()
                return { col: pair.orderCol, orderVal: ov, supplierVal: sv, ok: normalizeKeyVal(ov) === normalizeKeyVal(sv) }
              }),
            }
          })
        : []

      // 원본에 택배사·운송장번호가 있으면 그 위치 그대로, 없으면 끝에 추가
      const headers = (savedOrder.headers.includes('택배사') && savedOrder.headers.includes('운송장번호'))
        ? savedOrder.headers
        : [...savedOrder.headers.filter(h => !['택배사', '운송장번호'].includes(h)), '택배사', '운송장번호']
      setResult({ rows: outputRows, headers, matched: totalMatched, unmatched: savedOrder.rows.length - totalMatched, perFile: entries.map((e, i) => ({ name: e.file.name, matched: perFileMatched[i] })), diagnosis: diagnosisRows })
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    } finally { setIsProcessing(false) }
  }

  const handleOrderFileUpload = async (file: File) => {
    setIsUploadingOrder(true); setError(null)
    try {
      const data = await readExcelFile(file)
      const rows = data.rows as Record<string, unknown>[]
      saveOrder(source, data.headers, rows, file.name)
      // 방금 저장된 항목 자동 선택 (savedOrders는 최신순 정렬이므로 첫 번째)
      // saveOrder가 동기적으로 store를 업데이트하므로 setTimeout으로 렌더 후 선택
      setTimeout(() => {
        const updated = useSettingsStore.getState().savedOrders
        const latest  = [...updated].filter(o => o.source === source).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]
        if (latest) { setSavedOrderId(latest.id); setResult(null) }
      }, 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 읽기 오류')
    } finally { setIsUploadingOrder(false) }
  }

  const handleReset = () => {
    cancelAutoRun()
    setSavedOrderId(''); setEntries([]); setResult(null); setError(null)
  }

  const readyToRun = entries.length > 0
  const canRun     = !!savedOrderId && !!savedOrder && entries.length > 0
  const allPreset  = entries.length > 0 && entries.every(e => !!e.presetId)

  // ─── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <Truck size={15} /> 송장번호 추가
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {SOURCE_LABEL[source]}에서 저장된 주문에 운송장번호를 매칭합니다
          </p>
        </div>
        {(savedOrderId || entries.length > 0) && (
          <button onClick={handleReset} className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
            <RotateCcw size={13} /> 처음부터
          </button>
        )}
      </div>

      {/* 저장 피드백 */}
      {savedFeedback && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 animate-slide-up">
          <CheckCircle2 size={13} /> {savedFeedback}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* 파일 형식 경고 (.xls 깨짐 등) */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-amber-200 whitespace-pre-line">
                <p className="font-semibold mb-1">⚠️ {w.fileName}</p>
                {w.message}
              </div>
              <button
                onClick={() => setWarnings(prev => prev.filter((_, idx) => idx !== i))}
                className="text-amber-400/60 hover:text-amber-300 text-xs px-2 py-0.5 rounded transition-colors"
              >
                닫기
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 프리셋 현황 배너 */}
      {supplierMappingPresets.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/8 border border-sky-500/20 text-xs text-sky-400">
          <BookMarked size={12} />
          거래처 프리셋 <span className="font-semibold">{supplierMappingPresets.length}개</span> 저장됨 — 등록된 거래처 파일은 자동 인식됩니다
        </div>
      )}

      {/* STEP 1: 주문 파일 업로드 또는 저장된 주문 선택 */}
      <div className="rounded-2xl border border-amber-500/30 bg-dark-card p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileSpreadsheet size={14} className="text-amber-400" /> 주문 파일 <span className="text-xs text-slate-500 font-normal">(마켓에서 주문받은 원본엑셀)</span>
        </p>

        {/* 직접 업로드 영역 */}
        <div
          onDragOver={e => { e.preventDefault(); setOrderDragging(true) }}
          onDragLeave={() => setOrderDragging(false)}
          onDrop={e => {
            e.preventDefault(); setOrderDragging(false)
            const file = Array.from(e.dataTransfer.files).find(f => /\.(xlsx|xls|csv)$/i.test(f.name))
            if (file) handleOrderFileUpload(file)
          }}
          onClick={() => orderFileInputRef.current?.click()}
          className={`flex items-center justify-center gap-3 px-6 py-[1.125rem] rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${orderDragging ? 'border-yellow-400 bg-yellow-400/20' : 'border-yellow-500/50 bg-yellow-500/10 hover:border-yellow-400 hover:bg-yellow-400/20'}`}
        >
          {isUploadingOrder
            ? <Loader2 size={22} className="text-yellow-300 animate-spin shrink-0" />
            : <Upload size={22} className="text-yellow-300 shrink-0" />
          }
          <span className="text-base font-medium text-yellow-200">
            {isUploadingOrder ? '파일 읽는 중...' : '주문 파일 드래그하거나 클릭하여 선택 · xlsx, xls, csv'}
          </span>
          <input
            ref={orderFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleOrderFileUpload(file)
              e.target.value = ''
            }}
          />
        </div>

        {/* 저장된 주문 선택 */}
        {filtered.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex-1 border-t border-dark-border" />
              <span>또는 저장된 주문 선택</span>
              <span className="flex-1 border-t border-dark-border" />
            </div>
            <select value={savedOrderId} onChange={e => { setSavedOrderId(e.target.value); setResult(null) }}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
              <option value="">— 저장된 주문 선택 —</option>
              {[...filtered].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">저장된 주문 <span className="text-slate-300 font-medium">{filtered.length}</span>개</span>
              {savedOrders.length >= 90 && (
                <span className="text-amber-400/80">
                  {savedOrders.length >= 100 ? '⚠ 100개 도달 — 새 저장 시 전체 초기화됩니다' : `⚠ 전체 ${savedOrders.length}/100개 — 100개 초과 시 전체 초기화`}
                </span>
              )}
            </div>
          </>
        )}
        {savedOrder && (
          <p className="text-xs text-slate-500">
            {savedOrder.rows.length.toLocaleString()}행 · 컬럼 {savedOrder.headers.length}개
            {savedOrder.fileName && <span className="ml-2 text-amber-400/80">📎 {savedOrder.fileName}</span>}
          </p>
        )}
      </div>

      {/* STEP 2: 거래처 파일들 */}
      <div className="rounded-2xl border border-amber-500/30 bg-dark-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Truck size={14} className="text-amber-400" /> 거래처 파일 (운송장번호 포함)
          </p>
          {entries.length > 0 && (
            <span className="text-xs text-slate-500">
              {entries.length}개 파일 · {entries.reduce((s, e) => s + e.data.rows.length, 0).toLocaleString()}행
            </span>
          )}
        </div>

        {/* 파일 카드 */}
        {entries.map((entry, ei) => (
          <div key={entry.id} className={`rounded-xl border overflow-hidden transition-colors
            ${entry.presetId ? 'border-sky-500/30 bg-sky-500/5' : 'border-dark-border bg-dark-hover/40'}`}>

            {/* 카드 헤더 */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5">
              <CheckCircle2 size={15} className={entry.presetId ? 'text-sky-400 shrink-0' : 'text-emerald-400 shrink-0'} />
              <FileSpreadsheet size={14} className={entry.presetId ? 'text-sky-400 shrink-0' : 'text-emerald-400 shrink-0'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-200 truncate">{entry.file.name}</p>
                  {entry.presetId && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                      <Zap size={9} /> {entry.presetName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{fmtSize(entry.file.size)} · {entry.data.rows.length.toLocaleString()}행 · 컬럼 {entry.data.headers.length}개</p>
              </div>
              <button onClick={() => toggleExpanded(entry.id)} className="p-1.5 rounded text-slate-500 hover:text-slate-300 transition-colors">
                {entry.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={() => removeEntry(entry.id)} className="p-1.5 rounded text-slate-600 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* 접힌 요약 */}
            {!entry.expanded && (() => {
              const autoVendor =
                !!savedOrder?.headers.some(h => /업체상품코드/.test(h)) &&
                !!entry.data.headers.some(h => /업체상품코드/.test(h)) &&
                !entry.keyPairs.some(p => /업체상품코드/.test(p.orderCol))
              return (
                <div className="px-3.5 pb-2.5 flex gap-3 text-xs text-slate-600 flex-wrap">
                  <span>키: {entry.keyPairs.map(p => p.supplierCol || '?').join(', ')}{autoVendor && <span className="text-emerald-400/70">, 업체상품코드(자동)</span>}</span>
                  <span>·</span>
                  <span className={!entry.invoiceCol ? 'text-red-400' : ''}>운송장: {entry.invoiceCol || '미설정'}</span>
                  {entry.carrierCol && <><span>·</span><span>택배사: {entry.carrierCol}</span></>}
                </div>
              )
            })()}

            {/* 펼친 설정 */}
            {entry.expanded && savedOrder && (
              <div className="px-3.5 pb-3.5 pt-0.5 space-y-3 border-t border-dark-border/50">
                {/* 복합키 쌍 */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs text-slate-500">교차 검증 컬럼</p>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 items-center px-0.5">
                    <span className="text-[10px] text-slate-600 text-center">저장된 주문 컬럼</span><span />
                    <span className="text-[10px] text-slate-600 text-center">거래처 파일 컬럼</span><span />
                  </div>
                  {entry.keyPairs.map((pair, idx) => {
                    const oSample = String(savedOrder.rows[0]?.[pair.orderCol] ?? '').trim()
                    const sSample = String(entry.data.rows[0]?.[pair.supplierCol] ?? '').trim()
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 items-center">
                          <select value={pair.orderCol} onChange={e => updateKeyPair(entry.id, idx, 'orderCol', e.target.value)}
                            className="px-2 py-1.5 rounded-lg text-xs bg-dark-surface border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                            {savedOrder.headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <span className="text-xs font-bold px-1 text-slate-500">=</span>
                          <select value={pair.supplierCol} onChange={e => updateKeyPair(entry.id, idx, 'supplierCol', e.target.value)}
                            className={`px-2 py-1.5 rounded-lg text-xs bg-dark-surface border text-slate-200 focus:outline-none focus:border-amber-500/50 ${!pair.supplierCol ? 'border-violet-500/40 text-violet-300' : 'border-dark-border'}`}>
                            <option value="">— 주문 단독 (B2B 매핑 없음) —</option>
                            {entry.data.headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <button onClick={() => removeKeyPair(entry.id, idx)} disabled={entry.keyPairs.length === 1}
                            className="p-1.5 rounded text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors"><X size={12} /></button>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 px-0.5">
                          <span className="text-[10px] px-2 truncate text-slate-600">예) {oSample || '(없음)'}</span><span />
                          <span className="text-[10px] px-2 truncate text-slate-600">예) {sSample || '(없음)'}</span><span />
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={() => addKeyPair(entry.id)}
                    className="flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-300 transition-colors px-1 pt-0.5">
                    <Plus size={11} /> 검증 컬럼 추가
                  </button>
                </div>

                {/* 운송장/택배사 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">택배사 컬럼</label>
                    <select value={entry.carrierCol} onChange={e => updateEntry(entry.id, { carrierCol: e.target.value, presetId: undefined, presetName: undefined })}
                      className="px-2 py-1.5 rounded-lg text-xs bg-dark-surface border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                      <option value="">— 선택 안 함 —</option>
                      {entry.data.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">운송장번호 컬럼 *</label>
                    <select value={entry.invoiceCol} onChange={e => updateEntry(entry.id, { invoiceCol: e.target.value, presetId: undefined, presetName: undefined })}
                      className="px-2 py-1.5 rounded-lg text-xs bg-dark-surface border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                      <option value="">— 선택 —</option>
                      {entry.data.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                {/* 저장 / 업데이트 버튼 */}
                <div className="flex items-center gap-2 pt-1">
                  {entry.presetId ? (
                    <button onClick={() => handleUpdatePreset(entry.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition-colors">
                      <Save size={11} /> 프리셋 업데이트
                    </button>
                  ) : (
                    <button onClick={() => setSaveModal({ entryId: entry.id, name: entry.file.name.replace(/\.[^.]+$/, '') })}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors">
                      <Save size={11} /> 이 거래처 설정 저장
                    </button>
                  )}
                  {ei === 0 && entries.length > 1 && (
                    <button onClick={() => {
                      const first = entries[0]
                      setEntries(prev => prev.map((e, i) => {
                        if (i === 0) return e
                        const invCol = e.data.headers.includes(first.invoiceCol) ? first.invoiceCol : pickCol(e.data.headers, /운송장|송장번호/i, e.data.rows as Record<string, unknown>[])
                        const carCol = e.data.headers.includes(first.carrierCol) ? first.carrierCol : pickCol(e.data.headers, /택배사/i, e.data.rows as Record<string, unknown>[])
                        const pairs  = first.keyPairs.map(p => ({ orderCol: p.orderCol, supplierCol: e.data.headers.includes(p.supplierCol) ? p.supplierCol : e.data.headers[0] ?? '' }))
                        return { ...e, keyPairs: pairs, invoiceCol: invCol, carrierCol: carCol, presetId: undefined, presetName: undefined }
                      }))
                      setResult(null)
                    }} className="flex items-center gap-1.5 text-xs text-sky-400/70 hover:text-sky-300 transition-colors px-1">
                      <Plus size={11} /> 나머지에 적용
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 파일 추가 드롭존 */}
        <label onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)}
          className={`flex items-center justify-center gap-2.5 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
            ${isDragging ? 'border-cyan-400 bg-cyan-500/[0.20] scale-[1.01]' : 'border-cyan-500/40 bg-cyan-500/[0.20] hover:border-cyan-400 hover:bg-cyan-500/[0.45]'}`}>
          <div className={`p-2 rounded-full ${isDragging ? 'bg-amber-500/20' : 'bg-dark-hover'}`}>
            <Upload size={16} className={isDragging ? 'text-amber-400' : 'text-slate-500'} />
          </div>
          <div>
            <p className="text-sm font-medium text-red-400">
              {entries.length === 0 ? '+ 파일 추가 — ' : '+ 파일 추가 — '}
              <span className="underline underline-offset-2">클릭하여 선택</span>
            </p>
            <p className="text-xs text-slate-600 mt-0.5">여러 파일 동시 선택 가능 · xlsx, xls, csv</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" multiple onChange={handleInputChange} className="hidden" />
        </label>
      </div>

      {/* 자동실행 카운트다운 배너 */}
      {autoRunCount !== null && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/15 border border-sky-500/30 animate-slide-up">
          <Zap size={16} className="text-sky-400 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-sky-200">프리셋 자동 인식 — {autoRunCount}초 후 자동 실행</p>
            <p className="text-xs text-sky-400/70">모든 거래처 파일이 저장된 프리셋으로 인식되었습니다</p>
          </div>
          <button onClick={handleMatch} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-400 transition-colors">
            지금 실행
          </button>
          <button onClick={cancelAutoRun} className="p-1.5 rounded text-sky-400/60 hover:text-sky-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 실행 버튼 */}
      {readyToRun && autoRunCount === null && (
        <div className="animate-slide-up">
          <button disabled={isProcessing || !canRun} onClick={handleMatch}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20">
            {isProcessing
              ? <><Loader2 size={15} className="animate-spin" /> 매칭 중...</>
              : !savedOrderId
                ? <><Play size={15} /> 운송장 매칭 실행 — 주문을 먼저 선택하세요</>
                : <><Play size={15} /> 운송장 매칭 실행 ({entries.length}개 파일)</>
            }
          </button>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div ref={resultRef} className="space-y-4 animate-slide-up">
          {result.matched === 0 ? (
            <div className="px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/25 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm font-semibold text-red-300">매칭된 행이 없습니다</p>
              </div>
              {result.diagnosis.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">첫 미매칭 주문 행을 각 파일의 첫 행과 비교 (참고용):</p>
                  {result.diagnosis.map((diag, fi) => (
                    <div key={fi} className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-medium truncate">{diag.fileName}</p>
                      {diag.cols.map((d, i) => (
                        <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                          ${d.ok ? 'bg-emerald-500/8 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                          <span className={`font-bold shrink-0 mt-0.5 ${d.ok ? 'text-emerald-400' : 'text-red-400'}`}>{d.ok ? '✓' : '✗'}</span>
                          <div className="min-w-0">
                            <span className="text-slate-400 font-medium">{d.col}</span>
                            <div className="flex gap-2 mt-0.5 flex-wrap">
                              <span className="text-slate-300">주문: <span className="font-mono text-amber-300/80">"{d.orderVal || '(없음)'}"</span></span>
                              <span className="text-slate-600">vs</span>
                              <span className="text-slate-300">거래처 첫행: <span className="font-mono text-sky-300/80">"{d.supplierVal || '(없음)'}"</span></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <p className="text-xs text-slate-600">※ 거래처 파일의 첫 번째 행과만 비교합니다. 실제 데이터에 매칭 행이 있는지 확인하세요.</p>
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-xl overflow-hidden border ${result.unmatched > 0 ? 'border-amber-400/40' : 'border-emerald-400/50'}`}>
              <div className={`flex items-start gap-3 px-4 py-3.5 ${result.unmatched > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/30'}`}>
                <CheckCircle2 size={18} className={`shrink-0 mt-0.5 ${result.unmatched > 0 ? 'text-amber-300' : 'text-emerald-300'}`} />
                <div>
                  <p className={`text-sm font-semibold ${result.unmatched > 0 ? 'text-amber-200' : 'text-emerald-200'}`}>운송장 매칭 완료!</p>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    매칭 <span className="font-bold">{result.matched}건</span>
                    {result.unmatched > 0 && <> · 미매칭 <span className="font-bold text-amber-300">{result.unmatched}건</span></>}
                  </p>
                </div>
              </div>
              {result.perFile.length > 1 && (
                <div className="px-4 py-2.5 bg-dark-card border-t border-dark-border/50 space-y-1">
                  <p className="text-xs text-slate-500 mb-1.5">파일별 매칭 현황</p>
                  {result.perFile.map((pf, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate max-w-[70%]">{pf.name}</span>
                      <span className={pf.matched > 0 ? 'text-emerald-400 font-medium' : 'text-slate-600'}>{pf.matched}건</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">
              총 <span className="text-amber-400">{result.rows.length.toLocaleString()}</span>행
              <span className="ml-2 text-xs text-slate-500">· 다운로드는 매칭 <span className="text-emerald-400">{result.matched.toLocaleString()}</span>건만 포함</span>
            </p>
            {(() => {
              const splitCol = result.headers.find(h => /분리배송/.test(h))
              // 매칭된 행(운송장번호 채워진 것)만 다운로드에 포함
              const matchedOnly = result.rows.filter(r => String(r['운송장번호'] ?? '').trim() !== '')
              const dlRows = splitCol
                ? matchedOnly.map(row => ({ ...row, [splitCol]: 'N' }))
                : matchedOnly
              return <DownloadButton rows={dlRows as any} fileName="Invoice_Matched" label="매칭완료 엑셀다운" />
            })()}
          </div>

          {source === 'coupang-api' && result.matched > 0 && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Send size={14} className="text-orange-400" />
                <p className="text-sm font-semibold text-orange-300">쿠팡으로 송장 전송</p>
              </div>
              {coupangBizList.length === 0 ? (
                <p className="text-xs text-red-400">쿠팡 연동된 사업자가 없습니다. 사업자 관리에서 먼저 등록해주세요.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={sendBizId}
                      onChange={e => {
                        setSendBizId(e.target.value)
                        const b = coupangBizList.find(x => x.id === e.target.value)
                        setSendConnId(b?.coupangConns[0]?.id ?? '')
                      }}
                      className="px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-orange-500/50"
                    >
                      <option value="">— 사업자 선택 —</option>
                      {coupangBizList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      value={sendConnId}
                      onChange={e => setSendConnId(e.target.value)}
                      disabled={!sendBizId}
                      className="px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-200 disabled:opacity-40 focus:outline-none focus:border-orange-500/50"
                    >
                      <option value="">— 연결 선택 —</option>
                      {coupangBizList.find(b => b.id === sendBizId)?.coupangConns.map(c => (
                        <option key={c.id} value={c.id}>{c.displayName ?? c.marketplace}</option>
                      ))}
                    </select>
                  </div>

                  {sendResult && (
                    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                      sendResult.fail > 0 || sendResult.ok === 0
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    }`}>
                      {sendResult.ok > 0
                        ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                        : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                      <span>
                        {sendResult.ok > 0 && `${sendResult.ok}건 전송 완료. `}
                        {sendResult.fail > 0 && `${sendResult.fail}건 실패. `}
                        {sendResult.message}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleSendToCoupang}
                    disabled={isSending || !sendBizId || !sendConnId}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20"
                  >
                    {isSending
                      ? <><Loader2 size={14} className="animate-spin" /> 전송 중...</>
                      : <><Send size={14} /> 쿠팡으로 전송</>}
                  </button>
                  <p className="text-[11px] text-slate-500">
                    운송장번호·묶음배송번호가 있는 행만 전송됩니다. 택배사는 자동 매핑됩니다.
                  </p>
                </>
              )}
            </div>
          )}

          {result.matched > 0 && (() => {
            const KEY_COLS = ['택배사', '운송장번호']
            const PREVIEW_PATTERNS = [/주문번호/, /수취인이름|수취인명/, /수취인전화/, /업체상품코드/, /옵션명/]
            const previewCols = [...KEY_COLS, ...result.headers.filter(h => !KEY_COLS.includes(h) && PREVIEW_PATTERNS.some(p => p.test(h)))].filter(h => result.headers.includes(h))

            return (
              <>
              <div className="rounded-xl border border-dark-border overflow-hidden">
                  <div className="px-3 py-2 bg-dark-hover/50 border-b border-dark-border flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">미리보기 (핵심 컬럼)</span>
                    <span className="text-xs text-slate-600">최대 10행</span>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs border-collapse min-w-max">
                      <thead className="sticky top-0 bg-dark-surface">
                        <tr>{previewCols.map(h => (
                          <th key={h} className={`px-3 py-2 text-left border-b border-dark-border font-medium whitespace-nowrap ${KEY_COLS.includes(h) ? 'text-amber-400/80' : 'text-slate-500'}`}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {result.rows.slice(0, 10).map((row, i) => {
                          const hasInvoice = !!(row['운송장번호'])
                          return (
                            <tr key={i} className={`border-b border-dark-border/40 ${hasInvoice ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                              {previewCols.map(h => (
                                <td key={h} className={`px-3 py-2 whitespace-nowrap max-w-[200px] truncate
                                  ${h === '운송장번호' && hasInvoice ? 'text-emerald-300 font-medium' : h === '택배사' && hasInvoice ? 'text-sky-300' : KEY_COLS.includes(h) && !hasInvoice ? 'text-red-400/60 italic' : 'text-slate-400'}`}>
                                  {String(row[h] ?? '')}
                                  {KEY_COLS.includes(h) && !hasInvoice && !String(row[h] ?? '') && '미매칭'}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 마켓 업로드용 — 거래처 관리 > 마켓 송장등록 양식에 저장된 템플릿 기반 */}
                {(() => {
                  // marketType(props)에 해당하는 템플릿 우선, 없으면 쿠팡 기본
                  const targetMarket = marketType ?? '쿠팡'
                  const template =
                    marketTemplates.find(t => t.marketName === targetMarket) ??
                    marketTemplates.find(t => t.marketName === '쿠팡')

                  if (!template || template.headers.length === 0) {
                    return (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
                        <span className="font-semibold">마켓 송장등록 양식이 없어요.</span>{' '}
                        거래처 관리 &gt; 마켓 송장등록 양식에서 {targetMarket} 양식을 등록하면 여기에 자동으로 표시돼요.
                      </div>
                    )
                  }

                  // 1) 양식 헤더 ↔ 주문 헤더 자동 매칭 (SYNONYM 그룹 포함)
                  const autoMapping: ColumnMapping = autoMatchColumns(result.headers, template.headers)
                  // 2) 사용자가 거래처 관리에서 명시적으로 저장한 매핑으로 덮어쓰기
                  const mapping: ColumnMapping = { ...autoMapping }
                  for (const [col, src] of Object.entries(template.mapping)) {
                    if (src) mapping[col] = src
                  }
                  // 2.5) 주문에 "동일 이름"의 컬럼이 있으면 무조건 그것 사용
                  //      (예: 양식 '업체상품코드' ↔ 주문 '업체상품코드' — 저장된 매핑보다 우선)
                  for (const h of template.headers) {
                    if (result.headers.includes(h)) mapping[h] = h
                  }
                  // 3) '번호' 컬럼은 자동 행번호 (1부터) — 단, 주문에 '번호' 컬럼이 실제 있으면 그것 유지
                  for (const h of template.headers) {
                    if (/^번호$|^순번$|^No\.?$/i.test(h) && !result.headers.includes(h)) mapping[h] = ROW_NUMBER_KEY
                  }
                  const filled = fillB2bFromOrder(
                    result.rows as Array<Record<string, string | number | boolean | null>>,
                    template.headers,
                    mapping,
                    template.appendValues,
                  )
                  const invoiceKey = template.headers.find(h => /운송장|송장번호/.test(h))
                  const carrierKey = template.headers.find(h => /택배사|배송사/.test(h))
                  const mappedCount = filled.mappedCount
                  return (
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-violet-500/20 flex items-center justify-between">
                        <span className="text-xs font-semibold text-violet-300">
                          {template.marketName} 업로드용 ({template.headers.length}개 컬럼
                          <span className="text-slate-500 font-normal"> · 매핑 {mappedCount}개</span>)
                          {invoiceKey && (() => {
                            const matchedRows = filled.rows.filter(r => String(r[invoiceKey] ?? '').trim() !== '').length
                            return <span className="ml-1 text-slate-500 font-normal"> · 다운로드 <span className="text-emerald-400">{matchedRows}</span>행</span>
                          })()}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">최대 10행</span>
                          <button
                            onClick={() => {
                              import('xlsx').then(XLSX => {
                                // 매칭된 행(운송장번호 있는 것)만 다운로드
                                const matchedFilled = invoiceKey
                                  ? filled.rows.filter(r => String(r[invoiceKey] ?? '').trim() !== '')
                                  : filled.rows
                                const dataRows = matchedFilled.map(row => template.headers.map(h => row[h] ?? ''))
                                const sheet = XLSX.utils.aoa_to_sheet([template.headers, ...dataRows])
                                const wb = XLSX.utils.book_new()
                                XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
                                const now = new Date()
                                const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
                                XLSX.writeFile(wb, `${marketToEn(template.marketName)}_Up_${ts}.xlsx`)
                              })
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                          >
                            <Download size={12} /> {template.marketName} 업로드 엑셀 다운
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-48">
                        <table className="w-full text-xs border-collapse min-w-max">
                          <thead className="sticky top-0 bg-dark-surface">
                            <tr>{template.headers.map(h => (
                              <th key={h} className={`px-3 py-2 text-left border-b border-dark-border font-medium whitespace-nowrap
                                ${h === invoiceKey ? 'text-emerald-400/80' : h === carrierKey ? 'text-sky-400/80' : 'text-violet-400/70'}`}>
                                {h}
                              </th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {filled.rows.slice(0, 10).map((row, i) => {
                              const hasInvoice = !!(invoiceKey && row[invoiceKey])
                              return (
                                <tr key={i} className={`border-b border-dark-border/40 ${hasInvoice ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                                  {template.headers.map(h => (
                                    <td key={h} className={`px-3 py-2 whitespace-nowrap max-w-[180px] truncate
                                      ${h === invoiceKey && hasInvoice ? 'text-emerald-300 font-medium'
                                        : h === carrierKey && hasInvoice ? 'text-sky-300'
                                        : 'text-slate-400'}`}>
                                      {String(row[h] ?? '')}
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </>
            )
          })()}
        </div>
      )}

      {/* 저장 모달 */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-surface p-6 space-y-4 shadow-2xl animate-slide-up">
            <div>
              <p className="text-base font-semibold text-slate-100">거래처 설정 저장</p>
              <p className="text-xs text-slate-500 mt-1">같은 형식의 파일이 올라오면 자동으로 이 설정을 적용합니다</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">거래처 이름</label>
              <input
                autoFocus
                type="text"
                value={saveModal.name}
                onChange={e => setSaveModal(s => s ? { ...s, name: e.target.value } : null)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(saveModal.entryId, saveModal.name) }}
                placeholder="예) A거래처, 쿠팡물류, CJ대한통운..."
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSaveModal(null)} className="flex-1 py-2.5 rounded-xl text-sm border border-dark-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                취소
              </button>
              <button onClick={() => handleSavePreset(saveModal.entryId, saveModal.name)} disabled={!saveModal.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
