import type { ExcelRow } from './excelReader';

/** B2B컬럼 → 주문컬럼 매핑 (null이면 빈 값) */
export type ColumnMapping = Record<string, string | null>;

/** 행 번호 자동 채움 특수 키 */
export const ROW_NUMBER_KEY = '__ROW_NUMBER__';

/** 분리배송 Y/N 컬럼명 패턴 (출고예정일 등 제외) */
export const SEPARATE_DELIVERY_PATTERN = /^분리배송(\s*[YyNn\/].*)?$/;

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
// 공백/괄호/특수문자/대소문자 무시한 정규화 (autoMatchColumns와 동일 규칙)
function normalizeKey(s: string): string {
  return s
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/[_\-·]/g, '')
    .toLowerCase()
}

// 같은 의미의 컬럼명 동의어 그룹 (어느 쪽으로 매핑돼 있어도 서로 찾아냄)
const SYNONYM_GROUPS: string[][] = [
  ['수취인명', '수취인', '수취인이름', '수령인', '수령인명', '수령인이름', '받는사람', '받는분', '받는이'],
  ['수취인연락처', '수취인전화', '수취인전화번호', '수령인전화', '수령인연락처', '받는사람전화', '받는사람연락처', '전화번호', '연락처', '휴대폰', '휴대폰번호'],
  ['주소', '배송주소', '수취인주소', '수령인주소', '받는사람주소', '배송지', '배송지주소'],
  ['우편번호', '우편', '우편코드', '배송우편번호'],
  ['옵션명', '옵션', '옵션정보', '옵션내용', '등록옵션명', '옵션상세'],
  ['상품명', '상품이름'],
  ['주문자', '주문자명', '주문자이름'],
  ['주문자연락처', '주문자전화', '주문자전화번호'],
  ['배송메시지', '배송메세지'],
  ['수량', '구매수'],
  ['묶음배송번호', '출고번호', 'shipmentBoxId'],
  ['옵션ID', '옵션아이디', '업체상품코드', '업체상품번호', 'vendorItemId'],
  ['주문번호', 'orderId'],
  ['택배사', '배송사', '배송업체', 'deliveryCompany', 'carrier'],
  ['운송장번호', '송장번호', 'invoiceNumber', 'trackingNumber'],
]

// 정규화된 이름 → 같은 그룹의 모든 변형들
const SYNONYM_MAP: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {}
  for (const group of SYNONYM_GROUPS) {
    const normalized = group.map(normalizeKey)
    for (const n of normalized) m[n] = normalized
  }
  return m
})()

// orderRow에서 키를 찾되, 정확 매치 실패 시 정규화/동의어 기반으로 탐색
function lookupOrderValue(orderRow: ExcelRow, orderCol: string): unknown {
  if (orderCol in orderRow) return orderRow[orderCol]
  const target = normalizeKey(orderCol)
  if (!target) return undefined

  // 1) 정규화 매치
  for (const key of Object.keys(orderRow)) {
    if (normalizeKey(key) === target) return orderRow[key]
  }

  // 2) 동의어 그룹 매치
  const aliases = SYNONYM_MAP[target]
  if (aliases) {
    for (const key of Object.keys(orderRow)) {
      if (aliases.includes(normalizeKey(key))) return orderRow[key]
    }
  }
  return undefined
}

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
        : orderCol != null ? String(lookupOrderValue(orderRow, orderCol) ?? '') : ''
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

    // 2순위: 동의어 그룹 매치 (예: 묶음배송번호 ↔ 출고번호)
    if (!match) {
      const aliases = SYNONYM_MAP[bNorm];
      if (aliases) {
        match = orderNorm.find((o) => aliases.includes(o.norm));
      }
    }

    // 3순위: 한쪽이 다른 쪽을 포함
    // - 순방향(order가 b2b 포함): b2b 3자 이상 — "주소"→"배송주소" 같은 케이스
    // - 역방향(b2b가 order 포함): order 3자 이상 AND b2b 길이의 50% 이상
    //   이유: 짧은 order가 긴 b2b에 우연히 포함되면 오매칭 (예: "번호"가 "통관용구매자번호"에 매칭되지 않도록)
    if (!match) {
      match = orderNorm.find((o) => {
        if (o.norm.includes(bNorm) && bNorm.length >= 3) return true
        if (bNorm.includes(o.norm) && o.norm.length >= 3 && o.norm.length * 2 >= bNorm.length) return true
        return false
      });
    }

    mapping[b2bCol] = match?.original ?? null;
  }
  return mapping;
}
