import * as XLSX from 'xlsx';
import type { MatchedRow } from './matcher';
import type { ExcelRow } from './excelReader';
import type { FileNameDateFormat } from '../stores/settingsStore';

export function buildExportFileName(baseName: string, enabled: boolean, format: FileNameDateFormat): string {
  if (!enabled) return baseName
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y  = now.getFullYear()
  const mo = pad(now.getMonth() + 1)
  const d  = pad(now.getDate())
  const h  = pad(now.getHours())
  const mi = pad(now.getMinutes())
  const s  = pad(now.getSeconds())
  const suffix =
    format === 'YYYYMMDD'       ? `${y}${mo}${d}` :
    format === 'YYYY-MM-DD'     ? `${y}-${mo}-${d}` :
    /* YYYYMMDD_HHmmss */         `${y}${mo}${d}_${h}${mi}${s}`
  return `${baseName}_${suffix}`
}

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface WriteOptions {
  /** 다운로드 파일명 (확장자 제외) */
  fileName?: string;
  /** 주문 컬럼 헤더 접두사 (기본: "주문_") */
  orderPrefix?: string;
  /** B2B 컬럼 헤더 접두사 (기본: "B2B_") */
  b2bPrefix?: string;
}

interface SheetData {
  name: string;
  rows: ExcelRow[];
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function prefixKeys(
  row: ExcelRow | null,
  prefix: string,
  allKeys: string[]
): ExcelRow {
  const result: ExcelRow = {};
  for (const key of allKeys) {
    result[`${prefix}${key}`] = row?.[key] ?? null;
  }
  return result;
}

function buildFlatRow(
  matchedRow: MatchedRow,
  orderKeys: string[],
  b2bKeys: string[],
  orderPrefix: string,
  b2bPrefix: string
): ExcelRow {
  return {
    매칭상태: statusLabel(matchedRow.status),
    매칭키: matchedRow.matchKey,
    ...prefixKeys(matchedRow.orderRow, orderPrefix, orderKeys),
    ...prefixKeys(matchedRow.b2bRow, b2bPrefix, b2bKeys),
  };
}

function statusLabel(status: MatchedRow['status']): string {
  const labels: Record<MatchedRow['status'], string> = {
    matched: '매칭성공',
    order_only: '주문만있음',
    b2b_only: 'B2B만있음',
  };
  return labels[status];
}

function rowsToSheet(rows: ExcelRow[]): XLSX.WorkSheet {
  if (rows.length === 0) return XLSX.utils.aoa_to_sheet([]);
  const sheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });

  // 긴 숫자(10자리 이상) 및 지수 표기 정수 셀을 텍스트로 강제 변환 → 지수 표기 방지
  for (const cellAddr of Object.keys(sheet)) {
    if (cellAddr.startsWith('!')) continue
    const cell = sheet[cellAddr]
    if (!cell) continue
    const strVal = String(cell.v ?? '')
    const isLongInt = /^\d{10,}$/.test(strVal)
    // "6.97329E+11" 같은 지수 표기 정수 문자열도 처리
    const isScientificInt =
      /^-?\d+\.?\d*[eE][+\-]?\d+$/.test(strVal) &&
      Number.isInteger(Number(strVal))
    if (isLongInt || isScientificInt) {
      const intStr = isLongInt ? strVal : Number(strVal).toFixed(0)
      cell.t = 's'
      cell.v = intStr
      cell.z = '@'
      delete cell.w
    }
  }

  return sheet;
}

function applyColumnWidths(sheet: XLSX.WorkSheet, rows: ExcelRow[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  sheet['!cols'] = headers.map((h) => ({
    wch: Math.min(
      Math.max(
        h.length + 2,
        ...rows.slice(0, 100).map((r) => String(r[h] ?? '').length + 2)
      ),
      40
    ),
  }));
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 매칭 결과를 3개 시트로 분리한 xlsx 파일로 다운로드
 *
 * 시트 구성:
 *  - 전체결과: 모든 행 (매칭상태 컬럼 포함)
 *  - 매칭성공: status === 'matched'
 *  - 주문만있음: status === 'order_only'
 *  - B2B만있음: status === 'b2b_only'
 */
export function downloadMatchResult(
  matchedRows: MatchedRow[],
  options: WriteOptions = {}
): void {
  const {
    fileName = `매칭결과_${formatDate(new Date())}`,
    orderPrefix = '주문_',
    b2bPrefix = 'B2B_',
  } = options;

  // 전체 컬럼 키 수집 (순서 보존)
  const orderKeys = collectKeys(matchedRows.map((r) => r.orderRow));
  const b2bKeys = collectKeys(matchedRows.map((r) => r.b2bRow));

  const allFlat = matchedRows.map((r) =>
    buildFlatRow(r, orderKeys, b2bKeys, orderPrefix, b2bPrefix)
  );

  const sheets: SheetData[] = [
    { name: '전체결과', rows: allFlat },
    {
      name: '매칭성공',
      rows: allFlat.filter((_, i) => matchedRows[i].status === 'matched'),
    },
    {
      name: '주문만있음',
      rows: allFlat.filter((_, i) => matchedRows[i].status === 'order_only'),
    },
    {
      name: 'B2B만있음',
      rows: allFlat.filter((_, i) => matchedRows[i].status === 'b2b_only'),
    },
  ];

  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const sheet = rowsToSheet(rows);
    applyColumnWidths(sheet, rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * B2B 채우기 결과를 단일 시트 xlsx로 다운로드
 */
export function downloadFilledB2b(
  rows: ExcelRow[],
  fileName = `B2B결과_${formatDate(new Date())}`,
): void {
  const workbook = XLSX.utils.book_new();
  const sheet = rowsToSheet(rows);
  applyColumnWidths(sheet, rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'B2B입력');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function collectKeys(rows: (ExcelRow | null)[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    if (!row) continue;
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
