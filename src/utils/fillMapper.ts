import type { ExcelRow } from './excelReader';

/** B2B컬럼 → 주문컬럼 매핑 (null이면 빈 값) */
export type ColumnMapping = Record<string, string | null>;

/** 행 번호 자동 채움 특수 키 */
export const ROW_NUMBER_KEY = '__ROW_NUMBER__';

/** 분리배송 Y/N 컬럼명 패턴 (출고예정일 등 제외) */
export const SEPARATE_DELIVERY_PATTERN = /분리배송.*[YyNn\/]|분리배송\s*Y/;

export interface FillResult {
  rows: ExcelRow[];
  b2bHeaders: string[];
  mappedCount: number;
  totalRows: number;
}

/**
 * 주문 rows를 B2B 컬럼 구조로 변환
 *
 * mapping:      { b2bColumn: orderColumn | null }
 * appendValues: { b2bColumn: '뒤에 붙일 텍스트' }
 *   - 주문 컬럼이 매핑된 경우: output = 주문값 + appendValue
 *   - 주문 컬럼이 없고 appendValue만 있는 경우: output = appendValue (고정값으로 동작)
 *   - 둘 다 없으면: output = ''
 */
export function fillB2bFromOrder(
  orderRows: ExcelRow[],
  b2bHeaders: string[],
  mapping: ColumnMapping,
  appendValues: Record<string, string> = {},
): FillResult {
  const mappedCount = b2bHeaders.filter((col) => {
    const hasMapping = !!mapping[col]
    const hasAppend  = !!(appendValues[col] ?? '').trim()
    return hasMapping || hasAppend
  }).length

  const rows = orderRows.map((orderRow, rowIndex) => {
    const b2bRow: ExcelRow = {}
    for (const b2bCol of b2bHeaders) {
      const orderCol  = mapping[b2bCol]
      // 행 번호 자동: 1부터 시작
      const orderVal  = orderCol === ROW_NUMBER_KEY
        ? String(rowIndex + 1)
        : orderCol != null ? String(orderRow[orderCol] ?? '') : ''
      // 분리배송 컬럼: 키가 없으면 기본 'N', 키가 존재하면 그 값 사용 (''이면 비워두기)
      const appendVal       = appendValues[b2bCol] ?? ''
      const hasExplicitKey  = b2bCol in appendValues
      const isUnmapped      = !orderCol && !appendVal
      b2bRow[b2bCol] = isUnmapped && !hasExplicitKey && SEPARATE_DELIVERY_PATTERN.test(b2bCol)
        ? 'N'
        : orderVal + appendVal
    }
    return b2bRow
  })

  return { rows, b2bHeaders, mappedCount, totalRows: orderRows.length }
}

/** 이름이 비슷한 컬럼 자동 매핑 */
export function autoMatchColumns(
  orderHeaders: string[],
  b2bHeaders: string[],
): ColumnMapping {
  // 정규화: 괄호 내용 제거 → 공백·특수문자 제거 → 소문자
  const normalize = (s: string) =>
    s
      .replace(/[（(][^）)]*[）)]/g, '') // 괄호와 괄호 안 내용 제거
      .replace(/\s+/g, '')               // 공백 모두 제거
      .replace(/[_\-·]/g, '')            // 특수문자 제거
      .toLowerCase();

  // 정규화된 주문 헤더 인덱스
  const orderNorm = orderHeaders.map((h) => ({ original: h, norm: normalize(h) }));

  const mapping: ColumnMapping = {};
  for (const b2bCol of b2bHeaders) {
    const bNorm = normalize(b2bCol);

    // 분리배송 컬럼 → 빈값 유지 (fillB2bFromOrder에서 자동 'N' 처리)
    if (SEPARATE_DELIVERY_PATTERN.test(b2bCol)) {
      mapping[b2bCol] = null;
      continue;
    }

    // 1순위: 완전 일치
    let match = orderNorm.find((o) => o.norm === bNorm);

    // 2순위: 주문 컬럼이 B2B 컬럼을 포함하거나 그 반대
    if (!match && bNorm.length >= 2) {
      match = orderNorm.find(
        (o) =>
          o.norm.includes(bNorm) ||
          (bNorm.includes(o.norm) && o.norm.length >= 2),
      );
    }

    mapping[b2bCol] = match?.original ?? null;
  }
  return mapping;
}
