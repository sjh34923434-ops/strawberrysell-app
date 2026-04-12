import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { FillResult } from '../utils/fillMapper'

interface Props {
  result: FillResult
}

export function MatchingPreview({ result }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(0)
  const PAGE_SIZE = 50

  const { rows, b2bHeaders } = result

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div className="space-y-3 animate-slide-up">
      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-dark-card dark:bg-dark-card bg-white border border-dark-border dark:border-dark-border border-gray-200">
          <p className="text-xl font-bold text-slate-100 dark:text-slate-100 text-gray-900">
            {result.totalRows.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">총 주문 행</p>
        </div>
        <div className="p-3 rounded-xl bg-dark-card dark:bg-dark-card bg-white border border-dark-border dark:border-dark-border border-gray-200">
          <p className="text-xl font-bold text-primary-400">
            {result.mappedCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">매핑된 B2B 컬럼 / {result.b2bHeaders.length}개</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="내용으로 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="
            w-full pl-9 pr-4 py-2 rounded-xl text-sm
            bg-dark-card dark:bg-dark-card bg-white
            border border-dark-border dark:border-dark-border border-gray-200
            text-slate-200 dark:text-slate-200 text-gray-800
            placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          "
        />
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-dark-border dark:border-dark-border border-gray-200 overflow-hidden">
        <div className="overflow-auto max-h-[420px] scrollbar-thick">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-dark-surface dark:bg-dark-surface bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-slate-500 border-b border-dark-border dark:border-dark-border border-gray-200 whitespace-nowrap">
                  #
                </th>
                {b2bHeaders.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left font-medium text-sky-400/80 whitespace-nowrap border-b border-dark-border dark:border-dark-border border-gray-200"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={b2bHeaders.length + 1}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    결과가 없습니다
                  </td>
                </tr>
              ) : (
                paged.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-dark-border/50 dark:border-dark-border/50 border-gray-100 hover:bg-dark-hover/40 dark:hover:bg-dark-hover/40 hover:bg-gray-50 transition-colors duration-75"
                  >
                    <td className="px-3 py-2 text-slate-600 font-mono">
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    {b2bHeaders.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-slate-300 dark:text-slate-300 text-gray-700 whitespace-nowrap max-w-[200px] truncate"
                      >
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-dark-border dark:border-dark-border border-gray-200 bg-dark-surface dark:bg-dark-surface bg-gray-50">
            <span className="text-xs text-slate-500">
              {(page * PAGE_SIZE + 1).toLocaleString()} – {Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} / {filtered.length.toLocaleString()}행
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                이전
              </button>
              <span className="px-2 text-xs text-slate-400">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
