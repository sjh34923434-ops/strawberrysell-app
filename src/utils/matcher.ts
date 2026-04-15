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
  /**
   * 주문 엑셀에서 매칭 기준 컬럼명
   * - 단일: string
   * - 복합키: string[] → 여러 컬럼을 합쳐서 고유 키 생성
   *   (예: ['주문번호', '수취인이름', '수취인전화번호'] → 동명이인/중복주문 방지)
   */
  orderKeyColumn:  string | string[];
  /** B2B 엑셀에서 매칭 기준 컬럼명 (단일 또는 복합) */
  b2bKeyColumn:    string | string[];
  /** 공백 무시 여부 (기본: true) */
  trimWhitespace?: boolean;
  /** 대소문자 무시 여부 (기본: true) */
  caseInsensitive?: boolean;
}

/**
 * 쿠팡 주문 식별 표준 복합 키 컬럼
 * 레이어 1: 주문번호 (주문 단위)
 * 레이어 2: 수취인명 + 연락처 (동명이인 방지)
 * 레이어 3: 주소 (동일인 다중 배송지 구분)
 */
export const COUPANG_COMPOUND_KEY_COLUMNS = [
  '주문번호',
  '수취인이름',
  '수취인전화번호',
  '수취인주소',
] as const

export const COMPOUND_KEY_SEPARATOR = '||'

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

type Normalizer = (value: string) => string;

function buildNormalizers(options: MatchOptions): Normalizer[] {
  const normalizers: Normalizer[] = [];
  if (options.trimWhitespace !== false) normalizers.push(v => v.trim());
  if (options.caseInsensitive !== false) normalizers.push(v => v.toLowerCase());
  return normalizers;
}

function normalizeValue(value: unknown, normalizers: Normalizer[]): string {
  let str = String(value ?? '');
  for (const fn of normalizers) str = fn(str);
  return str;
}

/**
 * 행에서 복합 키 생성
 * 단일 컬럼이면 그 값만, 배열이면 여러 컬럼을 || 로 연결
 */
function buildRowKey(
  row: ExcelRow,
  columns: string | string[],
  normalizers: Normalizer[],
): string {
  const cols = Array.isArray(columns) ? columns : [columns];
  return cols
    .map(col => normalizeValue(row[col], normalizers))
    .join(COMPOUND_KEY_SEPARATOR);
}

function buildIndex(
  rows: ExcelRow[],
  keyColumns: string | string[],
  normalizers: Normalizer[],
): Map<string, ExcelRow[]> {
  const index = new Map<string, ExcelRow[]>();
  for (const row of rows) {
    const key = buildRowKey(row, keyColumns, normalizers);
    if (!key.replace(/\|/g, '').trim()) continue   // 모든 컬럼이 빈 값이면 스킵
    const bucket = index.get(key) ?? [];
    bucket.push(row);
    index.set(key, bucket);
  }
  return index;
}

/**
 * 컬럼 존재 검증 (단일/복합 모두 지원)
 */
function validateColumns(rows: ExcelRow[], columns: string | string[], fileLabel: string) {
  if (rows.length === 0) return;
  const cols = Array.isArray(columns) ? columns : [columns];
  const available = Object.keys(rows[0]);
  const missing = cols.filter(c => !(c in rows[0]));
  if (missing.length > 0) {
    throw new Error(
      `${fileLabel}에서 컬럼 [${missing.join(', ')}]을(를) 찾을 수 없습니다.\n` +
      `사용 가능한 컬럼: ${available.join(', ')}`
    );
  }
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 주문 엑셀과 B2B 엑셀을 주어진 컬럼 기준으로 매칭
 *
 * 단일 키:   orderKeyColumn: '주문번호'
 * 복합 키:   orderKeyColumn: ['주문번호', '수취인이름', '수취인전화번호']
 *            → 동명이인 방지 + 중복 배송지 구분
 */
export function matchExcelData(
  orderRows: ExcelRow[],
  b2bRows: ExcelRow[],
  options: MatchOptions,
): MatchResult {
  const { orderKeyColumn, b2bKeyColumn } = options;

  validateColumns(orderRows, orderKeyColumn, '주문 파일');
  validateColumns(b2bRows,   b2bKeyColumn,   'B2B 파일');

  const normalizers = buildNormalizers(options);
  const b2bIndex    = buildIndex(b2bRows, b2bKeyColumn, normalizers);
  const usedB2bKeys = new Set<string>();
  const result: MatchedRow[] = [];

  // 1) 주문 기준 순회: matched / order_only
  for (const orderRow of orderRows) {
    const key        = buildRowKey(orderRow, orderKeyColumn, normalizers);
    const b2bMatches = b2bIndex.get(key);

    if (b2bMatches && b2bMatches.length > 0) {
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
    const key = buildRowKey(b2bRow, b2bKeyColumn, normalizers);
    if (!usedB2bKeys.has(key)) {
      result.push({ status: 'b2b_only', orderRow: null, b2bRow, matchKey: key });
      usedB2bKeys.add(key);
    }
  }

  const stats = {
    total:     result.length,
    matched:   result.filter(r => r.status === 'matched').length,
    orderOnly: result.filter(r => r.status === 'order_only').length,
    b2bOnly:   result.filter(r => r.status === 'b2b_only').length,
  };

  return { rows: result, stats };
}

/**
 * 주문 파일의 컬럼 목록을 보고 최적 복합 키 컬럼 자동 추천
 * - COUPANG_COMPOUND_KEY_COLUMNS 중 실제 존재하는 것만 반환
 * - 없으면 첫 번째 컬럼 반환
 */
export function recommendKeyColumns(orderHeaders: string[]): string[] {
  const found = COUPANG_COMPOUND_KEY_COLUMNS.filter(c => orderHeaders.includes(c))
  return found.length > 0 ? [...found] : [orderHeaders[0] ?? '']
}
