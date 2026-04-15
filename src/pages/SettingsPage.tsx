import React, { useState } from 'react'
import { Key, Shield, User, AlertCircle, CheckCircle2, Loader2, Type, RotateCcw, FolderOpen, Trash2 } from 'lucide-react'
import { useLicenseStore } from '../stores/licenseStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'

function Section({ title, icon: Icon, children }: {
  title:    string
  icon:     React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="
      bg-dark-card dark:bg-dark-card bg-white
      border border-dark-border dark:border-dark-border border-gray-200
      rounded-2xl overflow-hidden
    ">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-dark-border dark:border-dark-border border-gray-100">
        <Icon size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { user }                        = useAuthStore()
  const { licenseKey, isActivated, expiresAt, isLoading, error, activate, clearError } = useLicenseStore()
  const {
    matchingSettings, updateMatchingSettings, fontSize, setFontSize, mappingPresets,
    savedOrders, deleteSavedOrder,
    supplierMappingPresets, deleteSupplierMappingPreset,
  } = useSettingsStore()

  const [newLicenseKey, setNewLicenseKey] = useState('')
  const [activateSuccess, setActivateSuccess] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'none' | 'error'>('idle')
  const [userDataPath, setUserDataPath] = useState<string | null>(null)

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
      const seedPresets = parsed?.state?.mappingPresets ?? []
      if (seedPresets.length === 0) {
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
        <Section title="화면 설정" icon={Type}>
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

        {/* 계정 정보 */}
        <Section title="계정 정보" icon={User}>
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
        </Section>

        {/* 라이선스 */}
        <Section title="라이선스" icon={Key}>
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
        </Section>

        {/* 매칭 설정 */}
        <Section title="매칭 기본 설정" icon={Shield}>
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
        </Section>

        {/* 저장 데이터 관리 */}
        <Section title="저장 데이터 관리" icon={Trash2}>
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
        </Section>

        {/* 데이터 복원 */}
        <Section title="데이터 복원" icon={RotateCcw}>
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
                현재 프리셋: <span className="text-primary-400 font-semibold">{mappingPresets.length}개</span>
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
        </Section>

      </div>
    </div>
  )
}
