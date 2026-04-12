import * as XLSX from 'xlsx';

export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export interface ParsedExcel {
  headers: string[];
  rows: ExcelRow[];
  sheetName: string;
}

/**
 * 어댑터 패턴: 파일 확장자에 따라 적절한 파서를 선택
 * 새 포맷 추가 시 readAdapters에 항목 추가
 */
const readAdapters: Record<string, (buffer: ArrayBuffer) => XLSX.WorkBook> = {
  xlsx: (buffer) => XLSX.read(buffer, { type: 'array', cellDates: true }),
  xls: (buffer) => XLSX.read(buffer, { type: 'array', cellDates: true }),
  csv: (buffer) => XLSX.read(buffer, { type: 'array', raw: false }),
};

/** 지수 표기 정수 문자열("6.97329E+11")을 전체 숫자 문자열로 변환 */
function normalizeScientific(row: ExcelRow): ExcelRow {
  const result: ExcelRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (
      typeof value === 'string' &&
      /^-?\d+\.?\d*[eE][+\-]?\d+$/.test(value) &&
      Number.isInteger(Number(value))
    ) {
      result[key] = Number(value).toFixed(0)
    } else {
      result[key] = value
    }
  }
  return result
}

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * File 객체 → ParsedExcel 변환
 * @param file  업로드된 File 객체
 * @param sheetIndex  읽을 시트 인덱스 (기본 0번)
 */
export async function readExcelFile(
  file: File,
  sheetIndex = 0
): Promise<ParsedExcel> {
  const ext = getExtension(file.name);
  const adapter = readAdapters[ext];
  if (!adapter) {
    throw new Error(
      `지원하지 않는 파일 형식입니다: .${ext}\n지원 형식: xlsx, xls, csv`
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = adapter(buffer);

  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) {
    throw new Error(
      `시트를 찾을 수 없습니다. 파일에 시트가 ${workbook.SheetNames.length}개 있습니다.`
    );
  }

  const sheet = workbook.Sheets[sheetName];

  // 헤더를 직접 읽어 데이터 없는 양식 파일도 지원
  const headerRow: string[] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })[0] as string[] ?? [];

  const headers = headerRow.map((h) => String(h).trim()).filter(Boolean);

  if (headers.length === 0) {
    throw new Error(`"${sheetName}" 시트에서 컬럼 헤더를 찾을 수 없습니다.`);
  }

  // 데이터 행 (헤더 행 제외)
  const rawRows: ExcelRow[] = (XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
  }) as ExcelRow[]).map(normalizeScientific);

  return { headers, rows: rawRows, sheetName };
}

/**
 * 특정 컬럼의 고유값 목록 반환 (컬럼 선택 UI용)
 */
export function getUniqueColumnValues(
  rows: ExcelRow[],
  columnKey: string
): string[] {
  const values = rows
    .map((r) => String(r[columnKey] ?? '').trim())
    .filter((v) => v !== '');
  return [...new Set(values)];
}
