import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { ExcelRow } from '../utils/excelReader'
import { downloadFilledB2b } from '../utils/excelWriter'

interface Props {
  rows:      ExcelRow[]
  fileName?: string
  disabled?: boolean
}

export function DownloadButton({ rows, fileName, disabled }: Props) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (disabled || loading || rows.length === 0) return
    setLoading(true)
    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          downloadFilledB2b(rows, fileName)
          resolve()
        }, 0)
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || loading || rows.length === 0}
      className="
        inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
        bg-primary-500 hover:bg-primary-600 active:bg-primary-700
        text-white text-sm font-medium
        transition-all duration-150 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        shadow-lg shadow-primary-500/20
      "
    >
      {loading
        ? <Loader2 size={16} className="animate-spin" />
        : <Download size={16} />
      }
      {loading ? '다운로드 중...' : 'B2B 엑셀파일 다운로드'}
    </button>
  )
}
