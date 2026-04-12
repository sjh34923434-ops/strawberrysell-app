import type { ExcelRow } from './excelReader';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type MatchStatus = 'matched' | 'order_only' | 'b2b_only';

export interface MatchedRow {
  status: MatchStatus;
  orderRow: ExcelRow | null;
  b2bRow: ExcelRow | null;
  /** 매칭에 사용된 키 값 */
  matchKey: string;
}

export interface MatchResult {
  rows: MatchedRow[];
  stats: {
    total: number;
    matched: number;
    orderOnly: number;
    b2bOnly: number;
  };
}

export interface MatchOptions {
  /** 주문 엑셀에서 매칭 기준으로 사용할 컬럼명 */
  orderKeyColumn: string;
  /** B2B 엑셀에서 매칭 기준으로 사용할 컬럼명 */
  b2bKeyColumn: string;
  /** 공백 무시 여부 (기본: true) */
  trimWhitespace?: boolean;
  /** 대소문자 무시 여부 (기본: true) */
  caseInsensitive?: boolean;
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * 플러그인 방식의 키 정규화 파이프라인
 * 새 정규화 규칙 추가 시 normalizers 배열에 함수 추가
 */
type Normalizer = (value: string) => string;

function buildNormalizers(options: MatchOptions): Normalizer[] {
  const normalizers: Normalizer[] = [];
  if (options.trimWhitespace !== false) {
    normalizers.push((v) => v.trim());
  }
  if (options.caseInsensitive !== false) {
    normalizers.push((v) => v.toLowerCase());
  }
  return normalizers;
}

function normalizeKey(value: unknown, normalizers: Normalizer[]): string {
  let str = String(value ?? '');
  for (const fn of normalizers) str = fn(str);
  return str;
}

function buildIndex(
  rows: ExcelRow[],
  keyColumn: string,
  normalizers: Normalizer[]
): Map<string, ExcelRow[]> {
  const index = new Map<string, ExcelRow[]>();
  for (const row of rows) {
    const key = normalizeKey(row[keyColumn], normalizers);
    if (!key) continue;
    const bucket = index.get(key) ?? [];
    bucket.push(row);
    index.set(key, bucket);
  }
  return index;
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 주문 엑셀과 B2B 엑셀을 주어진 컬럼 기준으로 매칭
 *
 * 플러그인 확장 포인트:
 *  - 새 매칭 전략 필요 시 matchStrategy 파라미터 추가
 *  - 다중 키 매칭 필요 시 buildIndex를 복합키로 확장
 */
export function matchExcelData(
  orderRows: ExcelRow[],
  b2bRows: ExcelRow[],
  options: MatchOptions
): MatchResult {
  const { orderKeyColumn, b2bKeyColumn } = options;

  // 컬럼 존재 검증
  if (orderRows.length > 0 && !(orderKeyColumn in orderRows[0])) {
    throw new Error(
      `주문 파일에서 컬럼 "${orderKeyColumn}"을(를) 찾을 수 없습니다.\n` +
        `사용 가능한 컬럼: ${Object.keys(orderRows[0]).join(', ')}`
    );
  }
  if (b2bRows.length > 0 && !(b2bKeyColumn in b2bRows[0])) {
    throw new Error(
      `B2B 파일에서 컬럼 "${b2bKeyColumn}"을(를) 찾을 수 없습니다.\n` +
        `사용 가능한 컬럼: ${Object.keys(b2bRows[0]).join(', ')}`
    );
  }

  const normalizers = buildNormalizers(options);
  const b2bIndex = buildIndex(b2bRows, b2bKeyColumn, normalizers);
  const usedB2bKeys = new Set<string>();

  const result: MatchedRow[] = [];

  // 1) 주문 기준 순회: matched / order_only
  for (const orderRow of orderRows) {
    const key = normalizeKey(orderRow[orderKeyColumn], normalizers);
    const b2bMatches = b2bIndex.get(key);

    if (b2bMatches && b2bMatches.length > 0) {
      // 동일 키 다중 행 모두 매칭
      for (const b2bRow of b2bMatches) {
        result.push({ status: 'matched', orderRow, b2bRow, matchKey: key });
      }
      usedB2bKeys.add(key);
    } else {
      result.push({ status: 'order_only', orderRow, b2bRow: null, matchKey: key });
    }
  }

  // 2) B2B 전용 행: b2b_only
  for (const b2bRow of b2bRows) {
    const key = normalizeKey(b2bRow[b2bKeyColumn], normalizers);
    if (!usedB2bKeys.has(key)) {
      result.push({ status: 'b2b_only', orderRow: null, b2bRow, matchKey: key });
      // 동일 키 중복 방지
      usedB2bKeys.add(key);
    }
  }

  const stats = {
    total: result.length,
    matched: result.filter((r) => r.status === 'matched').length,
    orderOnly: result.filter((r) => r.status === 'order_only').length,
    b2bOnly: result.filter((r) => r.status === 'b2b_only').length,
  };

  return { rows: result, stats };
}
