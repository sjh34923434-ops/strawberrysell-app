import React, { useState, useEffect } from 'react'
import { Key, Shield, User, AlertCircle, CheckCircle2, Loader2, Type, RotateCcw, FolderOpen, Trash2, FileText, LogOut, ChevronDown, Monitor, X, Download, Upload, Database, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLicenseStore } from '../stores/licenseStore'
import { useSettingsStore, type FileNameDateFormat } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { licenseApi } from '../api/client'

function Section({ title, icon: Icon, children, collapsible = false, defaultOpen = true }: {
  title:        string
  icon:         React.ElementType
  children:     React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-dark-card dark:bg-dark-card bg-white border border-dark-border dark:border-dark-border border-gray-200 rounded-2xl overflow-hidden">
      <div
        className={`flex items-center gap-2.5 px-5 py-4 border-b border-dark-border dark:border-dark-border border-gray-100 ${collapsible ? 'cursor-pointer select-none hover:bg-dark-hover transition-colors' : ''}`}
        onClick={() => collapsible && setOpen(v => !v)}
      >
        <Icon size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800 flex-1">{title}</h2>
        {collapsible && (
          <ChevronDown size={15} className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        )}
      </div>
      {(!collapsible || open) && <div className="px-5 py-5">{children}</div>}
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { user }                        = useAuthStore()
  const { licenseKey, isActivated, expiresAt, isLoading, error, activate, clearError } = useLicenseStore()
  const {
    matchingSettings, updateMatchingSettings, fontSize, setFontSize,
    coupangPartners,
    savedOrders, deleteSavedOrder,
    supplierMappingPresets, deleteSupplierMappingPreset,
    fileNameDateEnabled, fileNameDateFormat,
    setFileNameDateEnabled, setFileNameDateFormat,
  } = useSettingsStore()

  const [newLicenseKey, setNewLicenseKey] = useState('')
  const [activateSuccess, setActivateSuccess] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'none' | 'error'>('idle')
  const [userDataPath, setUserDataPath] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleExportBackup = () => {
    const state = useSettingsStore.getState()
    const payload = {
      version:    1,
      exportedAt: new Date().toISOString(),
      data: {
        coupangPartners:        state.coupangPartners,
        marketTemplates:        state.marketTemplates,
        supplierMappingPresets: state.supplierMappingPresets,
        multiMatchConfigs:      state.multiMatchConfigs,
      },
    }
    const blob  = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url   = URL.createObjectURL(blob)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const a     = document.createElement('a')
    a.href      = url
    a.download  = `딸기셀_거래처백업_${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMessage({ type: 'success', text: '백업 파일을 다운로드했습니다.' })
    setTimeout(() => setBackupMessage(null), 3000)
  }

  const handleImportBackup = () => {
    const input  = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const parsed = JSON.parse(await file.text())
        const data   = parsed?.data
        if (!data || !Array.isArray(data.coupangPartners)) {
          setBackupMessage({ type: 'error', text: '잘못된 백업 파일입니다.' })
          return
        }
        const partnerCount  = data.coupangPartners.length
        const templateCount = data.marketTemplates?.length        ?? 0
        const presetCount   = data.supplierMappingPresets?.length ?? 0
        const ok = window.confirm(
          `다음 데이터를 가져옵니다:\n\n` +
          `• 거래처 ${partnerCount}개\n` +
          `• 마켓 양식 ${templateCount}개\n` +
          `• 송장 매핑 프리셋 ${presetCount}개\n\n` +
          `기존 데이터는 모두 덮어써집니다. 계속하시겠습니까?`
        )
        if (!ok) return
        useSettingsStore.setState({
          coupangPartners:        data.coupangPartners,
          marketTemplates:        data.marketTemplates        ?? [],
          supplierMappingPresets: data.supplierMappingPresets ?? [],
          multiMatchConfigs:      data.multiMatchConfigs      ?? [],
        })
        setBackupMessage({ type: 'success', text: '가져오기 완료! 거래처 데이터가 복원됐습니다.' })
        setTimeout(() => setBackupMessage(null), 4000)
      } catch {
        setBackupMessage({ type: 'error', text: '파일을 읽는 중 오류가 발생했습니다.' })
      }
    }
    input.click()
  }

  const handleRestorePresets = async () => {
    setRestoreStatus('loading')
    try {
      const path = await (window as any).electron.system.getUserDataPath()
      setUserDataPath(path)
      const seedJson = await (window as any).electron.system.getPresetSeed()
      if (!seedJson) {
        setRestoreStatus('none')
        return
      }
      const parsed = JSON.parse(seedJson)
      const seedPartners = parsed?.state?.coupangPartners ?? []
      if (seedPartners.length === 0) {
        setRestoreStatus('none')
        return
      }
      localStorage.setItem('strawberrysell-settings', seedJson)
      setRestoreStatus('success')
      setTimeout(() => window.location.reload(), 1000)
    } catch {
      setRestoreStatus('error')
    }
  }

  const handleActivate = async () => {
    if (!newLicenseKey.trim()) return
    clearError()
    setActivateSuccess(false)
    try {
      await activate(newLicenseKey.trim())
      setActivateSuccess(true)
      setNewLicenseKey('')
    } catch {
      // 오류는 store에서 처리
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5 animate-fade-in">

        <div>
          <h1 className="text-xl font-bold text-slate-100 dark:text-slate-100 text-gray-900">설정</h1>
          <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 mt-1">계정 및 앱 설정을 관리합니다</p>
        </div>

        {/* 화면 설정 */}
        <Section title="화면 설정" icon={Type} collapsible defaultOpen={false}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300 dark:text-slate-300 text-gray-700">글씨 크기</p>
              <span className="text-sm font-mono text-primary-400">{fontSize}px</span>
            </div>
            <input
              type="range"
              min={15}
              max={24}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-primary-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>작게 (15px)</span>
              <span>기본 (18px)</span>
              <span>크게 (24px)</span>
            </div>
            <div className="flex gap-2 pt-1">
              {[15, 17, 18, 20, 24].map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`
                    flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${fontSize === size
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-dark-hover dark:bg-dark-hover bg-gray-50 border-dark-border dark:border-dark-border border-gray-200 text-slate-400 hover:border-primary-500/40'
                    }
                  `}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* 계정 · 라이선스 · 기기 */}
        <Section title="계정 · 라이선스" icon={User} collapsible defaultOpen={false}>
          <div className="space-y-6">

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User size={12} /> 계정 정보
              </h3>
              <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-dark-border dark:border-dark-border border-gray-100">
              <span className="text-slate-500">이메일</span>
              <span className="text-slate-200 dark:text-slate-200 text-gray-700">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500">계정 ID</span>
              <span className="text-slate-400 dark:text-slate-400 text-gray-500 font-mono text-xs">{user?.id.slice(0, 8)}…</span>
            </div>
              </div>
            </div>

            <div className="border-t border-dark-border pt-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Key size={12} /> 라이선스
              </h3>
              <div className="space-y-4">
            {isActivated && licenseKey ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-medium">라이선스 활성화됨</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="px-3 py-3 rounded-xl bg-dark-hover dark:bg-dark-hover bg-gray-50 space-y-1">
                    <p className="text-xs text-slate-500">라이선스 키</p>
                    <p className="text-slate-300 dark:text-slate-300 text-gray-700 font-mono text-xs truncate">
                      {licenseKey}
                    </p>
                  </div>
                  <div className="px-3 py-3 rounded-xl bg-dark-hover dark:bg-dark-hover bg-gray-50 space-y-1">
                    <p className="text-xs text-slate-500">만료일</p>
                    <p className="text-slate-300 dark:text-slate-300 text-gray-700">
                      {expiresAt ? formatDate(expiresAt) : '—'}
                    </p>
                  </div>
                </div>

                {/* 새 라이선스 키로 변경 */}
                <div className="pt-3 border-t border-dark-border dark:border-dark-border border-gray-200">
                  <p className="text-xs text-slate-400 dark:text-slate-400 text-gray-500 mb-2">새 라이선스 키로 변경</p>
                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mb-2 animate-fade-in">
                      <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">{error}</p>
                    </div>
                  )}
                  {activateSuccess && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-2 animate-fade-in">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <p className="text-xs text-emerald-300">라이선스가 변경되었습니다.</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLicenseKey}
                      onChange={(e) => setNewLicenseKey(e.target.value)}
                      placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                      className="
                        flex-1 px-3 py-2 rounded-xl text-xs font-mono
                        bg-dark-hover dark:bg-dark-hover bg-gray-50
                        border border-dark-border dark:border-dark-border border-gray-200
                        text-slate-200 dark:text-slate-200 text-gray-800
                        placeholder-slate-600
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      "
                    />
                    <button
                      onClick={handleActivate}
                      disabled={isLoading || !newLicenseKey.trim()}
                      className="
                        px-4 py-2 rounded-xl text-xs font-semibold
                        bg-primary-500 hover:bg-primary-600 text-white
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-150 shrink-0
                        flex items-center gap-1.5
                      "
                    >
                      {isLoading && <Loader2 size={13} className="animate-spin" />}
                      변경
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">새 키로 변경하면 기존 라이선스는 자동 해제됩니다.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500">
                  라이선스 키를 등록하면 이 기기에서 서비스를 이용할 수 있습니다.
                </p>

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                    <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{error}</p>
                  </div>
                )}

                {activateSuccess && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <p className="text-xs text-emerald-300">라이선스가 성공적으로 활성화되었습니다.</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLicenseKey}
                    onChange={(e) => setNewLicenseKey(e.target.value)}
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    className="
                      flex-1 px-3 py-2.5 rounded-xl text-sm
                      bg-dark-hover dark:bg-dark-hover bg-gray-50
                      border border-dark-border dark:border-dark-border border-gray-200
                      text-slate-200 dark:text-slate-200 text-gray-800
                      placeholder-slate-600 dark:placeholder-slate-600 placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      font-mono
                    "
                  />
                  <button
                    onClick={handleActivate}
                    disabled={isLoading || !newLicenseKey.trim()}
                    className="
                      px-4 py-2.5 rounded-xl text-sm font-semibold
                      bg-primary-500 hover:bg-primary-600 text-white
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-150 shrink-0
                      flex items-center gap-2
                    "
                  >
                    {isLoading && <Loader2 size={14} className="animate-spin" />}
                    활성화
                  </button>
                </div>
              </div>
            )}
          </div>
            </div>

            <div className="border-t border-dark-border pt-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Monitor size={12} /> 기기 관리
              </h3>
              <DeviceManagementPanel />
            </div>

            <div className="border-t border-dark-border pt-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <RefreshCw size={12} /> 버전 · 업데이트
              </h3>
              <UpdateCheckPanel />
            </div>

          </div>
        </Section>

        {/* 매칭 · 내보내기 */}
        <Section title="매칭 · 내보내기" icon={Shield} collapsible defaultOpen={false}>
          <div className="space-y-6">

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Shield size={12} /> 매칭 기본 설정
              </h3>
          <div className="space-y-4">
            {[
              { key: 'trimWhitespace',  label: '앞뒤 공백 무시',  desc: '키 값 비교 시 앞뒤 공백을 자동으로 제거합니다' },
              { key: 'caseInsensitive', label: '대소문자 무시',    desc: '영문자 대소문자를 구분하지 않고 매칭합니다' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer select-none">
                <div
                  onClick={() => updateMatchingSettings({
                    [key]: !(matchingSettings as unknown as Record<string, unknown>)[key],
                  })}
                  className={`
                    mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0
                    transition-all cursor-pointer
                    ${(matchingSettings as unknown as Record<string, unknown>)[key]
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-dark-border dark:border-dark-border border-gray-300'
                    }
                  `}
                >
                  {!!(matchingSettings as unknown as Record<string, boolean>)[key] && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300 dark:text-slate-300 text-gray-700">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}

            <div className="pt-2 space-y-1.5">
              <label className="block text-xs font-medium text-slate-400 dark:text-slate-400 text-gray-500">
                결과 파일명 접두사
              </label>
              <input
                type="text"
                value={matchingSettings.outputFilePrefix}
                onChange={(e) => updateMatchingSettings({ outputFilePrefix: e.target.value })}
                className="
                  w-full px-3 py-2.5 rounded-xl text-sm
                  bg-dark-hover dark:bg-dark-hover bg-gray-50
                  border border-dark-border dark:border-dark-border border-gray-200
                  text-slate-200 dark:text-slate-200 text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                "
              />
              <p className="text-xs text-slate-500">
                예: <span className="text-slate-400 dark:text-slate-400 text-gray-500 font-mono">
                  {matchingSettings.outputFilePrefix}_20240101.xlsx
                </span>
              </p>
            </div>
          </div>
            </div>

            <div className="border-t border-dark-border pt-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <FileText size={12} /> 내보내기 파일명 설정
              </h3>
          {(() => {
            const now = new Date()
            const pad = (n: number) => String(n).padStart(2, '0')
            const y = now.getFullYear()
            const mo = pad(now.getMonth() + 1)
            const d = pad(now.getDate())
            const h = pad(now.getHours())
            const mi = pad(now.getMinutes())
            const s = pad(now.getSeconds())
            const suffix =
              fileNameDateFormat === 'YYYYMMDD'       ? `${y}${mo}${d}` :
              fileNameDateFormat === 'YYYY-MM-DD'     ? `${y}-${mo}-${d}` :
              `${y}${mo}${d}_${h}${mi}${s}`
            const preview = fileNameDateEnabled ? `거래처명_${suffix}.xlsx` : '거래처명.xlsx'
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300 dark:text-slate-300 text-gray-700">파일명에 날짜/시간 자동 추가</p>
                    <p className="text-xs text-slate-500 mt-0.5">다운로드 엑셀 파일명에 날짜를 붙여 B2B 사이트 업로드 시 중복 방지</p>
                  </div>
                  <button
                    onClick={() => setFileNameDateEnabled(!fileNameDateEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${fileNameDateEnabled ? 'bg-primary-500' : 'bg-dark-muted'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${fileNameDateEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {fileNameDateEnabled && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400">날짜 포맷</p>
                    <div className="space-y-1.5">
                      {([
                        { value: 'YYYYMMDD_HHmmss', label: 'YYYYMMDD_HHmmss', desc: '날짜 + 시간 (권장)' },
                        { value: 'YYYYMMDD',        label: 'YYYYMMDD',        desc: '날짜만' },
                        { value: 'YYYY-MM-DD',      label: 'YYYY-MM-DD',      desc: '날짜만 (구분자 포함)' },
                      ] as { value: FileNameDateFormat; label: string; desc: string }[]).map(opt => (
                        <button key={opt.value} onClick={() => setFileNameDateFormat(opt.value)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                            fileNameDateFormat === opt.value
                              ? 'bg-primary-500/10 border-primary-500/40 text-primary-300'
                              : 'bg-dark-hover border-dark-border text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${fileNameDateFormat === opt.value ? 'border-primary-400 bg-primary-400' : 'border-slate-600'}`} />
                          <div>
                            <span className="text-xs font-mono font-semibold">{opt.label}</span>
                            <span className="text-xs text-slate-500 ml-2">{opt.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="px-3 py-2.5 rounded-xl bg-dark-hover border border-dark-border">
                  <p className="text-xs text-slate-500 mb-1">파일명 미리보기</p>
                  <p className="text-sm font-mono text-primary-300">{preview}</p>
                </div>
              </div>
            )
          })()}
            </div>

          </div>
        </Section>

        {/* 데이터 관리 (저장 데이터 + 백업 + 복원) */}
        <Section title="데이터 관리" icon={Database} collapsible defaultOpen={false}>
          <div className="space-y-6">

            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Trash2 size={12} /> 저장 데이터
              </h3>
          <div className="space-y-4">
            {/* 저장된 주문 */}
            <div className="flex items-center justify-between py-2 border-b border-dark-border">
              <div>
                <p className="text-sm font-medium text-slate-300">저장된 주문</p>
                <p className="text-xs text-slate-500 mt-0.5">매칭탭에서 사용하는 주문 목록</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{savedOrders.length}개</span>
                <button
                  onClick={() => { if (window.confirm(`저장된 주문 ${savedOrders.length}개를 모두 삭제할까요?`)) savedOrders.forEach(o => deleteSavedOrder(o.id)) }}
                  disabled={savedOrders.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Trash2 size={12} /> 전체 삭제
                </button>
              </div>
            </div>

            {/* 거래처 매핑 프리셋 */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-300">거래처 매핑 프리셋</p>
                <p className="text-xs text-slate-500 mt-0.5">송장번호 탭 자동인식 설정</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{supplierMappingPresets.length}개</span>
                <button
                  onClick={() => { if (window.confirm(`거래처 매핑 프리셋 ${supplierMappingPresets.length}개를 모두 삭제할까요?`)) supplierMappingPresets.forEach(p => deleteSupplierMappingPreset(p.id)) }}
                  disabled={supplierMappingPresets.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Trash2 size={12} /> 전체 삭제
                </button>
              </div>
            </div>
          </div>
            </div>

            <div className="border-t border-dark-border pt-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Database size={12} /> 거래처 백업 · 가져오기
              </h3>
          <div className="space-y-3">
            <div className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 space-y-3">
              <p>등록한 거래처, 마켓 양식, 송장 매핑 프리셋을 파일로 백업/복원합니다.</p>

              <div className="px-3 py-2.5 rounded-lg border border-primary-500/20 bg-primary-500/5">
                <p className="text-xs font-semibold text-primary-300 mb-1.5">📤 1단계: 백업 파일 만들기 (먼저 해야 함)</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-slate-300 font-medium">[백업 파일 내보내기]</span> 클릭 → 다운로드 폴더에
                  <code className="mx-1 text-amber-400 font-mono">딸기셀_거래처백업_YYYYMMDD.json</code> 생성됨
                </p>
              </div>

              <div className="px-3 py-2.5 rounded-lg border border-slate-600/40 bg-dark-hover/50">
                <p className="text-xs font-semibold text-slate-300 mb-1.5">📥 2단계: 다른 PC에서 불러오기 (필요할 때만)</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  1단계에서 만든 .json 파일을 USB·이메일·카톡 등으로 새 PC에 옮긴 후 →
                  <span className="text-slate-300 font-medium ml-1">[백업 파일 가져오기]</span> 클릭 → 옮긴 파일 선택
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
              <div className="px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-50">
                거래처: <span className="text-primary-400 font-semibold">{coupangPartners.length}개</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-50">
                송장 프리셋: <span className="text-primary-400 font-semibold">{supplierMappingPresets.length}개</span>
              </div>
            </div>

            {backupMessage && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border animate-fade-in ${
                backupMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                {backupMessage.type === 'success'
                  ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  : <AlertCircle  size={14} className="text-red-400     shrink-0 mt-0.5" />}
                <p className={`text-xs ${backupMessage.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                  {backupMessage.text}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportBackup}
                disabled={coupangPartners.length === 0}
                className="
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                  bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150
                "
              >
                <Download size={14} /> 백업 파일 내보내기
              </button>
              <button
                onClick={handleImportBackup}
                className="
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                  bg-dark-hover hover:bg-slate-700 text-slate-200 border border-dark-border
                  transition-all duration-150
                "
              >
                <Upload size={14} /> 백업 파일 가져오기
              </button>
            </div>
          </div>
            </div>

            <div className="border-t border-dark-border pt-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <RotateCcw size={12} /> 데이터 복원
              </h3>
          <div className="space-y-3">
            <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500">
              컬럼 매핑 프리셋이 사라졌을 때 백업 파일에서 복원합니다.
            </p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-50 text-xs font-mono">
              <FolderOpen size={12} className="text-slate-500 shrink-0" />
              <span className="text-slate-400 truncate">
                {userDataPath ?? 'userData 경로 (복원 버튼 클릭 시 표시)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500">
                등록 거래처: <span className="text-primary-400 font-semibold">{coupangPartners.length}개</span>
              </div>
            </div>

            {restoreStatus === 'success' && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <p className="text-xs text-emerald-300">프리셋 복원 성공! 앱을 새로고침합니다...</p>
              </div>
            )}
            {restoreStatus === 'none' && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-fade-in">
                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  복원할 백업 파일이 없습니다.<br />
                  <span className="text-amber-400/70">preset-seed.json 파일을 위 경로에 넣어주세요.</span>
                </p>
              </div>
            )}
            {restoreStatus === 'error' && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">복원 중 오류가 발생했습니다.</p>
              </div>
            )}

            <button
              onClick={handleRestorePresets}
              disabled={restoreStatus === 'loading' || restoreStatus === 'success'}
              className="
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white
                disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150
              "
            >
              {restoreStatus === 'loading'
                ? <><Loader2 size={14} className="animate-spin" /> 복원 중...</>
                : <><RotateCcw size={14} /> preset-seed.json 에서 복원</>
              }
            </button>
          </div>
            </div>

          </div>
        </Section>

        {/* 저장 후 나가기 */}
        <div className="flex justify-end pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all duration-150 shadow-lg shadow-primary-500/20"
          >
            <LogOut size={15} />
            저장 후 나가기
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── 버전 · 업데이트 패널 ─────────────────────────────────────────────────────

function UpdateCheckPanel() {
  const [info, setInfo] = useState<{ version: string; updatedAt: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [result,   setResult]   = useState<{ type: 'idle' | 'latest' | 'newer' | 'error'; message?: string }>({ type: 'idle' })

  useEffect(() => {
    window.electron?.system.getUpdateInfo?.().then(setInfo).catch(() => {})
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    setResult({ type: 'idle' })
    try {
      const r = await window.electron.updater.checkForUpdates()
      if (!r.ok) {
        setResult({ type: 'error', message: r.error })
      } else if (r.version && info && r.version !== info.version) {
        setResult({ type: 'newer', message: `v${r.version} 발견 — 백그라운드 다운로드 시작됨` })
      } else {
        setResult({ type: 'latest', message: '현재 최신 버전을 사용 중이에요' })
      }
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : '확인 실패' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-300">현재 버전</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {info ? `v${info.version} · ${new Date(info.updatedAt).toLocaleDateString('ko-KR')} 설치` : '확인 중...'}
          </p>
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 border border-primary-500/30 text-primary-300 hover:bg-primary-500/20 disabled:opacity-50 transition-all"
        >
          {checking ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {checking ? '확인 중...' : '업데이트 확인'}
        </button>
      </div>

      {result.type !== 'idle' && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs animate-fade-in ${
          result.type === 'latest' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : result.type === 'newer' ? 'bg-primary-500/10 border-primary-500/20 text-primary-300'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}>
          {result.type === 'latest' ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            : result.type === 'newer' ? <Download size={13} className="shrink-0 mt-0.5" />
            : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
          <span>{result.message}</span>
        </div>
      )}

      <p className="text-[11px] text-slate-500 leading-relaxed">
        새 버전 발견 시 자동으로 다운로드되며, 우측 하단에 "지금 설치" 알림이 떠요.
      </p>
    </div>
  )
}

// ─── 기기 관리 패널 ────────────────────────────────────────────────────────────

function DeviceManagementPanel() {
  const [devices, setDevices] = useState<{ deviceId: string; label: string | null; createdAt: string; lastSeen: string }[]>([])
  const [limit, setLimit]     = useState<number>(1)
  const [used, setUsed]       = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const currentDeviceId = typeof window !== 'undefined' ? localStorage.getItem('deviceId') : null

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await licenseApi.listDevices()
      setDevices(data.devices)
      setLimit(data.limit)
      setUsed(data.used)
    } catch (err) {
      setError(err instanceof Error ? err.message : '기기 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  async function handleRemove(deviceId: string) {
    if (!confirm('이 기기에서 라이선스를 해제할까요? 해당 기기에서는 다시 로그인 후 재등록이 필요합니다.')) return
    try {
      await licenseApi.removeDevice(deviceId)
      await reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : '기기 해제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" />
        불러오는 중...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
        <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-300">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <span className="text-sm text-slate-300">등록된 기기</span>
        <span className="text-sm font-bold text-primary-300">{used} / {limit}대</span>
      </div>

      {devices.length === 0 ? (
        <p className="text-sm text-slate-500 px-1">등록된 기기가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map(d => {
            const isCurrent = d.deviceId === currentDeviceId
            return (
              <li key={d.deviceId} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-dark-hover dark:bg-dark-hover bg-gray-50">
                <Monitor size={16} className={isCurrent ? 'text-primary-400' : 'text-slate-500'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-200 dark:text-slate-200 text-gray-800 truncate">
                      {d.label ?? d.deviceId.slice(0, 12) + '...'}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 font-semibold">현재 기기</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    등록 {new Date(d.createdAt).toLocaleDateString('ko-KR')} · 최근 접속 {new Date(d.lastSeen).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(d.deviceId)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="기기 해제"
                >
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-slate-500 px-1">
        플랜별 기기 한도: 1:1 주문매칭 1대 · 일괄매칭 2대 · 자동매칭 3대
      </p>
    </div>
  )
}
