import React, { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react'

interface Props {
  label:       string
  accept?:     string
  file:        File | null
  onFileChange:(file: File | null) => void
  className?:  string
  tall?:       boolean
  compact?:    boolean
}

export function FileUploader({
  label,
  accept = '.xlsx,.xls,.csv',
  file,
  onFileChange,
  className = '',
  tall = false,
  compact = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) onFileChange(dropped)
    },
    [onFileChange]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) onFileChange(selected)
    e.target.value = ''
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-slate-400 dark:text-slate-400 text-gray-500 uppercase tracking-wider">
        {label}
      </label>

      {file ? (
        /* 파일 선택 완료 상태 */
        <div className="
          flex items-center gap-3 px-4 py-3 rounded-xl
          bg-emerald-500/10 border border-emerald-500/30
          animate-fade-in
        ">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <FileSpreadsheet size={18} className="text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 dark:text-slate-200 text-gray-800 truncate">
              {file.name}
            </p>
            <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
          </div>
          <button
            onClick={() => onFileChange(null)}
            className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="파일 제거"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* 드래그앤드롭 영역 */
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            flex flex-col items-center justify-center gap-3
            px-6 rounded-xl border-2 border-dashed cursor-pointer
            ${tall ? 'py-14' : compact ? 'py-2' : 'py-8'}
            transition-all duration-200
            ${isDragging
              ? 'border-cyan-400 bg-cyan-500/[0.20] scale-[1.01]'
              : 'border-cyan-500/40 bg-cyan-500/[0.20] hover:border-cyan-400 hover:bg-cyan-500/[0.45]'
            }
          `}
        >
          <div className={`
            p-3 rounded-full transition-colors
            ${isDragging ? 'bg-primary-500/20' : 'bg-dark-hover dark:bg-dark-hover bg-gray-100'}
          `}>
            <Upload size={22} className={isDragging ? 'text-primary-400' : 'text-slate-400 dark:text-slate-400 text-gray-500'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-red-400">
              + 파일 추가 — <span className="underline underline-offset-2">클릭하여 선택</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">xlsx, xls, csv 지원</p>
          </div>
          <input
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  )
}
