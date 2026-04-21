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
 * .xls 파일 포맷 감지
 *  - binary: 표준 BIFF (Excel 97-2003)
 *  - xml-spreadsheet: Excel 2003 XML Spreadsheet (쿠팡/11번가 일부 마켓이 사용)
 *  - html: HTML 테이블 위장
 */
function detectXlsFormat(buffer: ArrayBuffer): 'binary' | 'xml-spreadsheet' | 'html' {
  const bytes = new Uint8Array(buffer.slice(0, 512))
  const text  = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trimStart()
  if (/^<\?xml/i.test(text) || /<workbook\s[^>]*urn:schemas-microsoft-com/i.test(text)) return 'xml-spreadsheet'
  if (text.startsWith('<') || /^<!doctype/i.test(text)) return 'html'
  return 'binary'
}

/** HTML/XML에서 charset 선언을 찾아 인코딩을 반환. 없으면 null. */
function detectCharset(text: string): string | null {
  const metaCharset = text.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)
  if (metaCharset) return metaCharset[1].toLowerCase()
  const xmlEnc = text.match(/encoding\s*=\s*["']([\w-]+)["']/i)
  if (xmlEnc) return xmlEnc[1].toLowerCase()
  return null
}

/**
 * 버퍼를 적절한 인코딩으로 디코딩. 한국 마켓 엑셀은 EUC-KR/CP949가 흔함.
 * UTF-8 BOM이 있으면 UTF-8, meta charset 선언이 있으면 그 인코딩, 기본은 UTF-8.
 */
function decodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  // BOM 체크
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer)
  }
  // 선두 2KB에서 charset 추출
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2048))
  const charset = detectCharset(head)
  if (charset) {
    try {
      return new TextDecoder(charset).decode(buffer)
    } catch {
      // 미지원 인코딩이면 UTF-8로 폴백
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
}

/**
 * DOMParser로 HTML의 모든 <table>을 파싱해 가짜 WorkBook 만들기.
 * SheetJS HTML 파서가 첫 테이블만 읽고 끝내는 경우가 있어서, 모든 테이블을 시트로 변환.
 * 중첩된 <table> 제외 (바깥 테이블의 자식인 경우 건너뜀).
 */
function parseHtmlTablesAsWorkbook(html: string): XLSX.WorkBook | null {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const tables = Array.from(doc.querySelectorAll('table'))
    if (import.meta.env.DEV) {
      console.log(`[excelReader] DOMParser found ${tables.length} <table>(s)`)
    }
    if (tables.length === 0) return null
    const wb = XLSX.utils.book_new()
    tables.forEach((table, idx) => {
      // 이 테이블에 "직접 속한" tr만 — 중첩된 하위 table의 tr은 별도 시트에서 처리됨
      const trs = Array.from(table.querySelectorAll('tr')).filter(tr => tr.closest('table') === table)
      const aoa: string[][] = trs.map(tr => {
        const cells = Array.from(tr.querySelectorAll('td,th')).filter(c => c.closest('table') === table)
        return cells.map(c => decodeHtmlEntities((c.textContent ?? '').replace(/\s+/g, ' ').trim()))
      }).filter(row => row.some(c => c !== ''))
      if (import.meta.env.DEV) {
        const preview = aoa[0]?.slice(0, 6).join(' | ') ?? ''
        console.log(`[excelReader] table[${idx}]: ${trs.length} <tr>, ${aoa.length} non-empty rows, first: ${preview}`)
      }
      if (aoa.length === 0) return
      const sheet = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, sheet, `Tbl${idx + 1}`)
    })
    return wb.SheetNames.length > 0 ? wb : null
  } catch (e) {
    if (import.meta.env.DEV) console.log(`[excelReader] parseHtmlTablesAsWorkbook threw:`, e)
    return null
  }
}

/**
 * 어댑터 패턴: 파일 확장자에 따라 적절한 파서를 선택
 * 새 포맷 추가 시 readAdapters에 항목 추가
 */
const readAdapters: Record<string, (buffer: ArrayBuffer) => XLSX.WorkBook[]> = {
  xlsx: (buffer) => [XLSX.read(buffer, { type: 'array', cellDates: true })],
  xls:  (buffer) => {
    const fmt = detectXlsFormat(buffer)
    const text = decodeBuffer(buffer)
    // 개발 모드 진단: 파일 선두 600자 + 태그 통계
    if (import.meta.env.DEV) {
      const preview = text.slice(0, 600).replace(/\s+/g, ' ').trim()
      const tableCount = (text.match(/<table/gi) ?? []).length
      const trCount    = (text.match(/<tr/gi)    ?? []).length
      const tdCount    = (text.match(/<td/gi)    ?? []).length
      console.log(`[excelReader] xls format detected: ${fmt} | <table>=${tableCount}, <tr>=${trCount}, <td>=${tdCount}`)
      console.log(`[excelReader] first 600 chars:`, preview)
    }
    // 엑셀 "웹페이지(*.htm)" 프레임셋 감지 — 실제 데이터는 동명의 .files/ 폴더에 있음
    // 이런 파일은 업로드해도 데이터를 읽을 수 없음 (폴더 접근 불가)
    if (/Excel Workbook Frameset|name=ProgId content=Excel\.Sheet[^>]*>[\s\S]{0,500}<link[^>]+File-List/i.test(text)) {
      throw new Error(
        '이 엑셀 파일은 "웹페이지" 형식으로 저장됐습니다.\n' +
        '실제 데이터는 같은 이름의 ".files" 폴더 안에 있어 이 파일만으로는 읽을 수 없습니다.\n\n' +
        '해결 방법:\n' +
        '  1) 엑셀에서 이 파일을 열고 [다른 이름으로 저장] → "Excel 통합 문서(*.xlsx)" 로 저장 후 업로드\n' +
        '  2) 또는 다운로드 사이트에서 "엑셀 다운로드" 버튼으로 xlsx 형식을 받아주세요.'
      )
    }
    // 감지된 포맷 우선 + 폴백까지 함께 시도 (엑셀 버전에 따른 파싱 실패 대비)
    const books: XLSX.WorkBook[] = []
    const tryParse = (label: string, fn: () => XLSX.WorkBook | null) => {
      try {
        const wb = fn()
        if (wb) {
          books.push(wb)
          if (import.meta.env.DEV) console.log(`[excelReader] ${label} OK: sheets=${wb.SheetNames.join(',')}`)
        } else if (import.meta.env.DEV) {
          console.log(`[excelReader] ${label} returned null`)
        }
      } catch (e) {
        if (import.meta.env.DEV) console.log(`[excelReader] ${label} threw:`, e)
      }
    }
    if (fmt === 'xml-spreadsheet') {
      tryParse('xml-string', () => XLSX.read(text, { type: 'string', cellDates: true }))
      tryParse('binary',     () => XLSX.read(buffer, { type: 'array', cellDates: true }))
    } else if (fmt === 'html') {
      tryParse('dom-tables',  () => parseHtmlTablesAsWorkbook(text))
      tryParse('html-string', () => XLSX.read(text, { type: 'string' }))
      tryParse('binary',      () => XLSX.read(buffer, { type: 'array', cellDates: true }))
    } else {
      tryParse('binary',      () => XLSX.read(buffer, { type: 'array', cellDates: true }))
      tryParse('html-string', () => XLSX.read(text, { type: 'string' }))
      tryParse('dom-tables',  () => parseHtmlTablesAsWorkbook(text))
    }
    if (books.length === 0) throw new Error('파일을 읽을 수 없습니다. 파일이 손상됐거나 지원하지 않는 엑셀 형식입니다.')
    return books
  },
  csv:  (buffer) => [XLSX.read(buffer, { type: 'array', raw: false })],
};

/** HTML 엔티티 디코딩 — .xls 파일이 &lt; &#171; 등을 그대로 반환하는 경우 처리
 *  textarea.innerHTML 방식: 브라우저가 직접 파싱하므로 모든 엔티티 완벽 처리
 */
function decodeHtmlEntities(str: string): string {
  if (!str || !/&/.test(str)) return str
  try {
    const el = document.createElement('textarea')
    el.innerHTML = str
    return el.value
  } catch {
    // 혹시 DOM 사용 불가 환경이면 수동 처리
    let s = str
    for (let i = 0; i < 3; i++) {
      const prev = s
      s = s
        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
        .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
      if (s === prev) break
    }
    return s
  }
}

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

/** 셀의 원본 값을 가져오기 — 큰 정수(주문번호/송장번호)가 지수 표기로 잘리지 않도록 raw 값 우선 */
function readCellValue(cell: XLSX.CellObject | undefined): string | number | boolean | null {
  if (!cell) return ''
  // 숫자: raw 값(cell.v) 사용 — 정수면 전체 자리 문자열로 변환 (지수 표기 방지)
  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (Number.isInteger(cell.v) && Math.abs(cell.v) < Number.MAX_SAFE_INTEGER) {
      return cell.v.toFixed(0)  // "29100241234567" — 지수 표기 없음
    }
    return cell.v
  }
  // 날짜: 포맷된 문자열 또는 Date 객체
  if (cell.t === 'd') return cell.w ?? (cell.v as unknown as string)
  // 기타 문자열/불린: 포맷된 값 우선, 없으면 raw
  if (cell.w !== undefined) return cell.w
  return (cell.v as string | number | boolean | null | undefined) ?? ''
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
  const workbooks = adapter(buffer);

  if (workbooks.length === 0 || workbooks.every(wb => wb.SheetNames.length === 0)) {
    throw new Error(`파일에 시트가 없습니다.`);
  }

  // "진짜 헤더" 판정: 의미있는 문자(한글/영문/숫자)가 포함된 셀이 3개 이상인 행
  // 1~2글자 짧은 헤더(No, ID 등)도 포함 — 대신 의미없는 기호(«, >, < 등)만 있는 행 거부
  const isLikelyHeader = (row: Array<string | number | boolean | null>): boolean => {
    const cells = row.map(c => decodeHtmlEntities(String(c ?? '')).trim()).filter(Boolean)
    const nameLike = cells.filter(c => /[가-힣A-Za-z0-9]/.test(c))
    return nameLike.length >= 3
  }

  // 단일 시트 파싱 — allRows, headerIdx 반환
  const parseSheet = (sheet: XLSX.WorkSheet): {
    allRows: Array<Array<string | number | boolean | null>>
    headerIdx: number
  } | null => {
    const ref = sheet['!ref']
    if (!ref) return null
    const range = XLSX.utils.decode_range(ref)
    const allRows: Array<Array<string | number | boolean | null>> = []
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row: Array<string | number | boolean | null> = []
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        row.push(readCellValue(sheet[addr]))
      }
      if (row.some(v => v !== null && v !== '' && v !== undefined)) {
        allRows.push(row)
      }
    }
    if (allRows.length === 0) return null
    const idx = allRows.findIndex(isLikelyHeader)
    return { allRows, headerIdx: idx }
  }

  // 여러 파싱 전략(binary/xml/html) + 모든 시트를 전수 스캔해서 가장 적합한 것 선택
  // (HTML 위장 .xls, XML Spreadsheet 2003, 페이지네이션 행 등 다양한 엣지 케이스 대응)
  type Candidate = { sheetName: string; allRows: Array<Array<string | number | boolean | null>>; headerIdx: number; score: number; workbookIdx: number }
  const candidates: Candidate[] = []
  workbooks.forEach((workbook, wbIdx) => {
    for (const name of workbook.SheetNames) {
      const parsed = parseSheet(workbook.Sheets[name])
      if (!parsed) continue
      const dataRowCount = parsed.headerIdx >= 0 ? parsed.allRows.length - parsed.headerIdx - 1 : 0
      // 최대 컬럼 수 (가장 넓은 행 기준) — 많을수록 진짜 데이터 테이블일 확률 ↑
      const maxCols = parsed.allRows.reduce((m, r) => Math.max(m, r.filter(c => c !== '' && c != null).length), 0)
      // 점수: 헤더 발견 1000 + 데이터 행 * 10 + 총 행 + 최대 컬럼 수 * 5
      // 헤더가 없더라도 행/열 많은 테이블은 페이지네이션 위젯(1행 4열)보다 높게
      const score = (parsed.headerIdx >= 0 ? 1000 : 0) + dataRowCount * 10 + parsed.allRows.length + maxCols * 5
      candidates.push({ sheetName: name, allRows: parsed.allRows, headerIdx: parsed.headerIdx, score, workbookIdx: wbIdx })
    }
  })

  if (candidates.length === 0) {
    throw new Error(`파일의 모든 시트가 비어 있습니다.`)
  }

  // 진단: 각 시트 정보 출력 (개발 모드)
  if (import.meta.env.DEV) {
    console.log(`[excelReader] "${file.name}" workbooks=${workbooks.length}, candidates:`, candidates.map(c => ({
      wb: c.workbookIdx,
      name: c.sheetName,
      rows: c.allRows.length,
      headerIdx: c.headerIdx,
      score: c.score,
      firstRow: c.allRows[0]?.slice(0, 10),
      secondRow: c.allRows[1]?.slice(0, 10),
    })))
  }

  // 최고 점수 시트 선택 (동점이면 sheetIndex 우선)
  const preferred = candidates[sheetIndex] ?? candidates[0]
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a), preferred)
  const { allRows, sheetName } = best
  const headerIdx = best.headerIdx >= 0 ? best.headerIdx : 0  // 폴백: 첫 행

  if (import.meta.env.DEV) {
    console.log(`[excelReader] chose sheet "${sheetName}" (score ${best.score}), headerIdx ${headerIdx}, total rows ${allRows.length}`)
  }

  const headerRow = allRows[headerIdx]
  const headers = headerRow
    .map((h) => decodeHtmlEntities(String(h ?? '').trim()))
    .filter(Boolean);

  if (headers.length === 0) {
    throw new Error(`"${sheetName}" 시트에서 컬럼 헤더를 찾을 수 없습니다.`);
  }

  // 헤더 행 이후를 데이터 행으로 변환
  const rawRows: ExcelRow[] = allRows.slice(headerIdx + 1).map(row => {
    const obj: ExcelRow = {}
    headers.forEach((h, i) => {
      const v = row[i]
      obj[h] = typeof v === 'string' ? decodeHtmlEntities(v) : v
    })
    return normalizeScientific(obj)
  });

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
