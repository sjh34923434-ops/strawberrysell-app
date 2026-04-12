import { fillB2bFromOrder, type ColumnMapping } from './fillMapper'
import type { ExcelRow } from './excelReader'

// ─── 타입 ──────────────────────────────────────────────────────────────────────

export interface PartnerMatchConfig {
  partnerName:   string
  matchValues:   string[]
  b2bHeaders:    string[]
  mapping:       ColumnMapping
  appendValues?: Record<string, string>
  b2bFileName?:  string
}

export interface PartnerMatchResult {
  partnerName:  string
  rows:         ExcelRow[]
  b2bHeaders:   string[]
  rowCount:     number
  b2bFileName?: string
}

export interface MultiMatchResult {
  partners:       PartnerMatchResult[]
  unmatchedRows:  ExcelRow[]
  unmatchedCount: number
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

const normalize = (v: unknown) =>
  String(v ?? '').trim().toLowerCase()

// ─── 핵심 함수 ─────────────────────────────────────────────────────────────────

/**
 * 통합 주문 엑셀을 파트너별로 분류한 뒤 각각 B2B 양식에 채워 반환
 *
 * @param orderRows       주문 파일 전체 행
 * @param classifyColumn  분류 기준 컬럼명 (예: "업체상품코드")
 * @param configs         파트너별 설정 배열
 */
export function runMultiMatch(
  orderRows:       ExcelRow[],
  classifyColumn:  string,
  configs:         PartnerMatchConfig[],
): MultiMatchResult {

  // 1) 분류값 → 파트너 인덱스 룩업 테이블 빌드
  const lookup = new Map<string, number>()
  for (let i = 0; i < configs.length; i++) {
    for (const val of configs[i].matchValues) {
      const key = normalize(val)
      if (key) lookup.set(key, i)
    }
  }

  // 2) 주문 행을 파트너별로 분류
  const buckets: ExcelRow[][] = configs.map(() => [])
  const unmatchedRows: ExcelRow[] = []

  for (const row of orderRows) {
    const key = normalize(row[classifyColumn])
    const idx = lookup.get(key)
    if (idx !== undefined) {
      buckets[idx].push(row)
    } else {
      unmatchedRows.push(row)
    }
  }

  // 3) 파트너별 B2B 양식 채우기
  const partners: PartnerMatchResult[] = configs.map((cfg, i) => {
    const { rows } = fillB2bFromOrder(
      buckets[i],
      cfg.b2bHeaders,
      cfg.mapping,
      cfg.appendValues ?? {},
    )
    return {
      partnerName:  cfg.partnerName,
      rows,
      b2bHeaders:   cfg.b2bHeaders,
      rowCount:     buckets[i].length,
      b2bFileName:  cfg.b2bFileName,
    }
  })

  return {
    partners,
    unmatchedRows,
    unmatchedCount: unmatchedRows.length,
  }
}

/**
 * 특정 컬럼의 고유값 + 각 값의 행 수 반환
 */
export function getUniqueValuesWithCount(
  rows:   ExcelRow[],
  column: string,
): Array<{ value: string; count: number }> {
  const counter = new Map<string, number>()
  for (const row of rows) {
    const val = String(row[column] ?? '').trim()
    if (!val) continue
    counter.set(val, (counter.get(val) ?? 0) + 1)
  }
  return [...counter.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
}
