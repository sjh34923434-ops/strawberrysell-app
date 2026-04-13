import { useCallback, useState, useMemo } from 'react'
import { ArrowRight, Wand2, CheckCircle2, Save, Trash2, BookOpen, X, PlusCircle } from 'lucide-react'
import { autoMatchColumns, SEPARATE_DELIVERY_PATTERN, type ColumnMapping } from '../utils/fillMapper'
import { useSettingsStore } from '../stores/settingsStore'

// 드롭다운 상단에 우선 표시할 주문 컬럼 순서
const PREFERRED_ORDER = [
  '주문번호',
  '업체주문번호',
  '등록상품명',
  '구매수',
  '수량',
  '수취인',
  '수취인이름',
  '수취인주소',
  '수취인전화번호',
  '업체명',
  '업체주소',
  '업체전화',
  '우편번호',
  '옵션명',
  '배송메시지',
  '배송메지지',
  '업체상품코드',
  '번호',
]

const FIXED_EXTRA_COLUMNS = ['업체명', '업체주소', '업체전화']

function sortOrderHeaders(headers: string[]): string[] {
  const normalize = (s: string) =>
    s.replace(/[（(][^）)]*[）)]/g, '').replace(/\s/g, '').toLowerCase()
  const prefNorm = PREFERRED_ORDER.map(normalize)

  const extra = FIXED_EXTRA_COLUMNS.filter(
    (e) => !headers.some((h) => normalize(h) === normalize(e))
  )
  const allHeaders = [...headers, ...extra]

  const preferred: string[] = []
  const rest: string[] = []
  for (const h of allHeaders) {
    const idx = prefNorm.indexOf(normalize(h))
    if (idx !== -1) preferred[idx] = h
    else rest.push(h)
  }
  return [...preferred.filter(Boolean), ...rest]
}

interface Props {
  orderHeaders:        string[]
  b2bHeaders:          string[]
  mapping:             ColumnMapping
  appendValues:        Record<string, string>
  b2bFileName?:        string
  b2bFileData?:        string   // B2B 파일 base64 (저장 시 함께 포함)
  loadedPresetId?:     string   // 불러온 프리셋 ID (업데이트용)
  mode?:               'order' | 'invoice'
  onMappingChange:     (mapping: ColumnMapping) => void
  onAppendValuesChange:(appendValues: Record<string, string>) => void
}

export function ColumnMapper({
  orderHeaders,
  b2bHeaders,
  mapping,
  appendValues,
  b2bFileName,
  b2bFileData,
  loadedPresetId,
  mode = 'order',
  onMappingChange,
  onAppendValuesChange,
}: Props) {
  const [autoResult, setAutoResult]     = useState<number | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveMode, setSaveMode]         = useState<'update' | 'new'>('update')
  const [saveName, setSaveName]         = useState('')
  const [showPresets, setShowPresets]   = useState(false)
  const [coreOnly, setCoreOnly]         = useState(false)
  // 추가 텍스트 입력창이 열린 컬럼 목록
  const [expandedAppend, setExpandedAppend] = useState<Set<string>>(
    () => new Set(Object.keys(appendValues).filter((k) => appendValues[k] !== ''))
  )

  const { mappingPresets, savePreset, deletePreset, replacePreset } = useSettingsStore()
  const sortedOrderHeaders = useMemo(() => sortOrderHeaders(orderHeaders), [orderHeaders])

  // 송장번호 탭 핵심 컬럼 감지
  const INVOICE_CORE_PATTERNS = [/^번호$/, /주문번호/, /택배사/, /운송장번호/, /분리배송.*[Yy\/]/, /옵션.?id/i]
  const isCoreCol = (col: string) => INVOICE_CORE_PATTERNS.some((p) => p.test(col))
  const coreHeaders    = b2bHeaders.filter(isCoreCol)
  const nonCoreHeaders = b2bHeaders.filter((c) => !isCoreCol(c))
  // coreOnly ON이면 핵심만, 아니면 핵심 → 나머지 순서로
  const displayHeaders = mode === 'invoice' && coreOnly
    ? coreHeaders
    : mode === 'invoice'
      ? [...coreHeaders, ...nonCoreHeaders]
      : b2bHeaders

  const mappedCount = b2bHeaders.filter((col) => {
    return !!(mapping[col]) || !!(appendValues[col] ?? '').trim()
  }).length
  const appendCount = Object.values(appendValues).filter((v) => v.trim() !== '').length

  const handleChange = useCallback((b2bCol: string, orderCol: string) => {
    onMappingChange({ ...mapping, [b2bCol]: orderCol || null })
  }, [mapping, onMappingChange])

  const handleAppendChange = useCallback((b2bCol: string, value: string) => {
    onAppendValuesChange({ ...appendValues, [b2bCol]: value })
  }, [appendValues, onAppendValuesChange])

  const toggleAppendExpand = useCallback((b2bCol: string) => {
    setExpandedAppend((prev) => {
      const next = new Set(prev)
      if (next.has(b2bCol)) {
        next.delete(b2bCol)
        // 값이 비어있을 때만 삭제 (값이 있으면 유지)
        if (!(appendValues[b2bCol] ?? '').trim()) {
          const newAppend = { ...appendValues }
          delete newAppend[b2bCol]
          onAppendValuesChange(newAppend)
        }
      } else {
        next.add(b2bCol)
        if (!(b2bCol in appendValues)) {
          onAppendValuesChange({ ...appendValues, [b2bCol]: '' })
        }
      }
      return next
    })
  }, [appendValues, onAppendValuesChange])

  const handleAutoMatch = () => {
    const newMapping = autoMatchColumns(orderHeaders, b2bHeaders)
    const count = Object.values(newMapping).filter(Boolean).length
    onMappingChange(newMapping)
    setAutoResult(count)
    setTimeout(() => setAutoResult(null), 4000)
  }

  const cleanAppendValues = () =>
    Object.fromEntries(Object.entries(appendValues).filter(([k, v]) =>
      v.trim() !== '' || SEPARATE_DELIVERY_PATTERN.test(k)  // 분리배송 컬럼은 '' 도 저장 (해제 상태 유지)
    ))

  const handleSave = () => {
    const cleanAppend = cleanAppendValues()
    if (saveMode === 'update' && loadedPresetId) {
      replacePreset(loadedPresetId, mapping, cleanAppend, b2bFileName, b2bFileData)
    } else {
      if (!saveName.trim()) return
      savePreset(saveName.trim(), mapping, cleanAppend, b2bFileName, b2bFileData, mode)
    }
    setSaveName('')
    setShowSaveModal(false)
  }

  const handleOpenSaveModal = () => {
    setSaveMode(loadedPresetId ? 'update' : 'new')
    setShowSaveModal(true)
  }

  const handleApplyPreset = (presetMapping: ColumnMapping, presetAppend?: Record<string, string>) => {
    onMappingChange(presetMapping)
    const av = presetAppend ?? {}
    onAppendValuesChange(av)
    setExpandedAppend(new Set(Object.keys(av).filter((k) => av[k] !== '')))
    setShowPresets(false)
  }

  return (
    <div className="space-y-3">

      {/* 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-84 bg-dark-card dark:bg-dark-card bg-white rounded-2xl border border-dark-border dark:border-dark-border border-gray-200 p-5 shadow-2xl animate-fade-in" style={{width: '22rem'}}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800">매핑 저장</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
            </div>

            {/* 모드 탭 — 불러온 프리셋이 있을 때만 표시 */}
            {loadedPresetId && (
              <div className="flex gap-1 p-1 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-100 mb-4">
                <button
                  onClick={() => setSaveMode('new')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${saveMode === 'new' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  새로 저장
                </button>
                <button
                  onClick={() => setSaveMode('update')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${saveMode === 'update' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  기존 덮어쓰기
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 mb-3">
              {saveMode === 'update' && loadedPresetId
                ? <span className="text-amber-400">불러온 프리셋에 현재 매핑을 덮어씁니다.</span>
                : b2bFileData
                  ? <span className="text-emerald-400">B2B 파일 + 매핑을 함께 저장합니다.</span>
                  : '현재 매핑 설정을 저장합니다.'}
              {b2bFileName && ` (${b2bFileName})`}
              {appendCount > 0 && ` · 추가 텍스트 ${appendCount}개 포함`}
            </p>

            {/* 새로 저장 모드일 때만 이름 입력 */}
            {(saveMode === 'new' || !loadedPresetId) && (
              <input
                autoFocus
                type="text"
                placeholder="예: 쿠팡 B2B, 네이버 주문"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="
                  w-full px-3 py-2.5 rounded-xl text-sm mb-3
                  bg-dark-hover dark:bg-dark-hover bg-gray-50
                  border border-dark-border dark:border-dark-border border-gray-200
                  text-slate-200 dark:text-slate-200 text-gray-800
                  placeholder-slate-600
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                "
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 rounded-xl text-sm text-slate-400 bg-dark-hover dark:bg-dark-hover bg-gray-100 hover:bg-dark-muted transition-colors"
              >취소</button>
              <button
                onClick={handleSave}
                disabled={saveMode === 'new' && !saveName.trim()}
                className="flex-[2] py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 transition-colors"
              >
                {saveMode === 'update' && loadedPresetId ? '덮어쓰기' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-200 dark:text-slate-200 text-gray-800 flex items-center gap-2">
            컬럼 매핑
            <span style={{ fontSize: '1.1em' }} className="text-red-400 font-semibold">(제목줄 이름)</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'invoice'
              ? '마켓 업로드 양식 각 컬럼에 B2B 송장 컬럼을 연결하세요'
              : 'B2B 각 컬럼에 주문 컬럼을 연결하고, 필요하면 추가 텍스트를 덧붙이세요'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoResult !== null && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 animate-fade-in">
              <CheckCircle2 size={13} />
              {autoResult}개 매칭됨
            </span>
          )}
          <button
            onClick={handleAutoMatch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 active:scale-95 transition-all"
          >
            <Wand2 size={12} />
            자동<br />매칭
          </button>
          <button
            onClick={handleOpenSaveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 transition-all"
            title="현재 매핑 저장"
          >
            <Save size={12} />
            저장
          </button>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border active:scale-95 transition-all
              ${showPresets
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}
            `}
          >
            <BookOpen size={12} />
            불러오기 {mappingPresets.filter(p => (p.mode ?? 'order') === mode).length > 0 && `(${mappingPresets.filter(p => (p.mode ?? 'order') === mode).length})`}
          </button>
        </div>
      </div>

      {/* 저장된 프리셋 목록 */}
      {showPresets && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 animate-fade-in">
          <p className="text-xs font-medium text-amber-400 mb-2">저장된 매핑</p>
          {mappingPresets.filter(p => (p.mode ?? 'order') === mode).length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center">저장된 매핑이 없습니다</p>
          ) : (
            mappingPresets.filter(p => (p.mode ?? 'order') === mode).map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 hover:border-amber-500/30 transition-colors group"
              >
                <button
                  onClick={() => handleApplyPreset(preset.mapping, preset.appendValues)}
                  className="flex-1 text-center"
                >
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-sm font-medium text-slate-200 dark:text-slate-200 text-gray-800 group-hover:text-amber-300 transition-colors">
                      {preset.name}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 group-hover:bg-red-500/25 transition-colors whitespace-nowrap">
                      클릭 적용
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {preset.b2bFileName && `${preset.b2bFileName} · `}
                    {Object.values(preset.mapping).filter(Boolean).length}개 매핑
                    {preset.appendValues && Object.values(preset.appendValues).filter(Boolean).length > 0
                      ? ` · 추가텍스트 ${Object.values(preset.appendValues).filter(Boolean).length}개`
                      : ''}
                    {' · '}{new Date(preset.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </button>
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 현황 */}
      <div className="px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 flex items-center gap-3">
        <span className="text-xs text-slate-400">
          매핑됨:{' '}
          <span className="text-primary-400 font-semibold">{mappedCount}</span>
          {' '}/ {b2bHeaders.length}개 컬럼
        </span>
        {appendCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <PlusCircle size={10} />
            추가 텍스트 {appendCount}개 설정됨
          </span>
        )}
      </div>

      {/* 추가 텍스트 안내 */}
      <div className="px-3 py-2 rounded-lg bg-sky-500/5 border border-sky-500/15 text-xs text-sky-400/80">
        <span className="font-medium">추가 텍스트</span>란? 주문 데이터 뒤에 덧붙일 글자입니다.
        예) 업체주소 → 주문값 <span className="text-slate-400">+</span>{' '}
        <span className="text-emerald-400">" 3층"</span> → 출력: "서울시 강남구 123 3층"
      </div>

      {/* 매핑 테이블 */}
      <div className="rounded-xl border border-dark-border dark:border-dark-border border-gray-200 overflow-hidden">
        {/* 송장번호 탭: 핵심 컬럼 토글 */}
        {mode === 'invoice' && coreHeaders.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-500/5 border-b border-amber-500/15">
            <span className="text-xs text-amber-400/70">
              핵심 컬럼: {coreHeaders.join(' · ')}
            </span>
            <button
              onClick={() => setCoreOnly(!coreOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                ${coreOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-dark-hover text-slate-400 border-slate-700 hover:text-amber-300 hover:border-amber-500/30'}`}
            >
              {coreOnly ? '✦ 핵심 컬럼만 보는 중' : '핵심 컬럼만 보기'}
            </button>
          </div>
        )}
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-dark-surface dark:bg-dark-surface bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left border-b border-dark-border dark:border-dark-border border-gray-200 w-[36%]">
                  <span style={{ fontSize: '1.1em' }} className="font-medium text-sky-400/80">
                    {mode === 'invoice' ? '마켓 업로드 양식 컬럼' : 'B2B 컬럼 (도매처)'}
                  </span>
                </th>
                <th className="px-1 py-2.5 text-center border-b border-dark-border dark:border-dark-border border-gray-200 w-[5%]" />
                <th className="px-3 py-2.5 text-left border-b border-dark-border dark:border-dark-border border-gray-200 w-[37%]">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '1.1em' }} className="font-medium text-amber-400/80">
                      {mode === 'invoice' ? 'B2B 송장 컬럼' : '마켓 주문 컬럼'}
                    </span>
                    <button
                      onClick={() => {
                        const cleared: ColumnMapping = {}
                        b2bHeaders.forEach(col => { cleared[col] = null })
                        onMappingChange(cleared)
                      }}
                      style={{ fontSize: '0.8em' }}
                      className="text-slate-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded border border-slate-700 hover:border-red-500/40"
                      title="모든 컬럼을 비워두기로 초기화"
                    >
                      비워두기<br />모두적용
                    </button>
                  </div>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-emerald-400/80 border-b border-dark-border dark:border-dark-border border-gray-200 w-[22%]">
                  추가 텍스트
                </th>
              </tr>
            </thead>
            <tbody>
              {displayHeaders.map((b2bCol, idx) => {
                const orderCol     = mapping[b2bCol] ?? ''
                const appendVal    = appendValues[b2bCol] ?? ''
                const isExpanded   = expandedAppend.has(b2bCol)
                const hasAppend    = appendVal.trim() !== ''
                const isMapped     = !!orderCol || hasAppend
                // 핵심→나머지 구분선 (invoice 전체보기 시)
                const isFirstNonCore = mode === 'invoice' && !coreOnly
                  && idx === coreHeaders.length && nonCoreHeaders.length > 0

                return (
                  <>
                  {isFirstNonCore && (
                    <tr key="__divider__">
                      <td colSpan={4} className="px-4 py-1.5 text-[10px] text-slate-600 bg-dark-hover/30 border-y border-slate-700/40">
                        나머지 컬럼 ({nonCoreHeaders.length}개)
                      </td>
                    </tr>
                  )}
                  <tr
                    key={b2bCol}
                    className={`
                      border-b border-dark-border/50 dark:border-dark-border/50 border-gray-100
                      ${isCoreCol(b2bCol) && mode === 'invoice' ? 'bg-amber-500/5' : idx % 2 !== 0 ? 'bg-dark-hover/20 dark:bg-dark-hover/20 bg-gray-50/60' : ''}
                    `}
                  >
                    {/* B2B 컬럼명 */}
                    <td className="px-4 py-2">
                      <span className={`text-xs font-mono ${isMapped ? 'text-sky-300 dark:text-sky-300 text-sky-700' : 'text-slate-400'}`}>
                        {b2bCol}
                      </span>
                      {b2bCol === '분리배송 Y/N' && (
                        <button
                          onClick={() => {
                            const next = appendVal === 'N' ? '' : 'N'
                            handleAppendChange(b2bCol, next)
                            setExpandedAppend((prev) => {
                              const s = new Set(prev)
                              if (next) s.add(b2bCol); else s.delete(b2bCol)
                              return s
                            })
                          }}
                          className={`text-[10px] mt-0.5 transition-colors ${
                            appendVal === 'N'
                              ? 'text-emerald-400/80 hover:text-red-400'
                              : 'text-slate-500 hover:text-emerald-400'
                          }`}
                        >
                          {appendVal === 'N' ? '✓ N 고정값 자동적용 (클릭시 해제)' : '✕ N 고정값 해제됨 (클릭시 재적용)'}
                        </button>
                      )}
                    </td>

                    {/* 화살표 */}
                    <td className="px-1 py-2 text-center">
                      <ArrowRight size={12} className={`mx-auto ${isMapped ? 'text-primary-400' : 'text-slate-600'}`} />
                    </td>

                    {/* 주문 컬럼 드롭다운 */}
                    <td className="px-3 py-2">
                      <select
                        value={orderCol}
                        onChange={(e) => handleChange(b2bCol, e.target.value)}
                        className="
                          w-full px-2.5 py-1.5 rounded-lg text-xs
                          bg-dark-hover dark:bg-dark-hover bg-gray-50
                          border border-dark-border dark:border-dark-border border-gray-200
                          text-slate-200 dark:text-slate-200 text-gray-800
                          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                          transition-all appearance-none cursor-pointer
                        "
                      >
                        <option value="">— 비워두기 —</option>
                        <option value="__ROW_NUMBER__" className="bg-dark-card dark:bg-dark-card bg-white">
                          🔢 행 번호 (자동 1, 2, 3…)
                        </option>
                        {sortedOrderHeaders.map((h) => (
                          <option key={h} value={h} className="bg-dark-card dark:bg-dark-card bg-white">
                            {h}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 추가 텍스트 */}
                    <td className="px-3 py-2">
                      {isExpanded ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={appendVal}
                            onChange={(e) => handleAppendChange(b2bCol, e.target.value)}
                            placeholder="예: 3층, (주)"
                            className="
                              flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs
                              bg-emerald-500/10 border border-emerald-500/30
                              text-emerald-200 dark:text-emerald-200
                              placeholder-emerald-400/30
                              focus:outline-none focus:ring-1 focus:ring-emerald-500
                              transition-all
                            "
                          />
                          <button
                            onClick={() => toggleAppendExpand(b2bCol)}
                            className="shrink-0 p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                            title="추가 텍스트 제거"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleAppendExpand(b2bCol)}
                          className="
                            flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs
                            text-slate-500 hover:text-emerald-400
                            border border-dashed border-slate-700 hover:border-emerald-500/40
                            transition-all w-full justify-center
                          "
                          title="추가 텍스트 설정"
                        >
                          <PlusCircle size={11} />
                          추가
                        </button>
                      )}
                    </td>
                  </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
