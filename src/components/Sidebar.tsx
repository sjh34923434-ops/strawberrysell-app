import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, GitMerge, Settings, LogOut, ChevronRight, Layers, HelpCircle, BookOpen, ShieldCheck, Building2, ShoppingCart, Database, Zap, Lock, ExternalLink } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useUpdateStore } from '../stores/updateStore'
import { usePlanAccess, type PlanTier } from '../utils/planAccess'
import { ThemeToggle } from './ThemeToggle'

type NavItem = {
  to: string
  icon: typeof BarChart3
  label: string
  tip: { title: string; rows: { label: string; value: string }[] } | null
  requires?: PlanTier
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',   icon: BarChart3,  label: '대시보드',   tip: null },
  {
    to: '/coupang-auto', icon: Zap, label: '자동매칭',
    requires: 'auto',
    tip: {
      title: '자동매칭',
      rows: [
        { label: '용도',   value: '마켓 API로 주문을 자동으로 가져와 거래처별 분류 출력' },
        { label: '입력',   value: '마켓 API (날짜 범위 선택)' },
        { label: '출력',   value: '거래처별 B2B 파일 N개' },
      ],
    },
  },
  {
    to: '/multi-match', icon: Layers,    label: '일괄매칭',
    requires: 'bulk',
    tip: {
      title: '일괄매칭',
      rows: [
        { label: '용도',   value: '여러 거래처가 섞인 주문 파일을 한번에 분류·처리' },
        { label: '입력',   value: '주문 파일 1개' },
        { label: '출력',   value: '거래처별 B2B 파일 N개' },
      ],
    },
  },
  {
    to: '/matching',    icon: GitMerge,  label: '1:1 주문매칭',
    requires: 'single',
    tip: {
      title: '주문매칭',
      rows: [
        { label: '용도',   value: '단일 거래처 주문 파일을 B2B 양식에 채워 다운로드' },
        { label: '입력',   value: '주문 파일 1개 + B2B 양식 1개' },
        { label: '출력',   value: 'B2B 양식 채워진 파일 1개' },
      ],
    },
  },
  {
    to: '/b2b-partners', icon: Database, label: '거래처관리',
    tip: {
      title: '거래처관리',
      rows: [
        { label: '용도',   value: 'B2B 양식 파일과 컬럼 매핑을 1회 등록' },
        { label: '효과',   value: '쿠팡·일괄·주문매칭 전부 자동 적용' },
        { label: '설정',   value: '접두어 입력 → B2B 파일 업로드 → 매핑 저장' },
      ],
    },
  },
  { to: '/businesses',   icon: Building2,   label: '사업자 관리',   tip: null },
  { to: '/help',        icon: BookOpen,  label: '이용매뉴얼', tip: null },
  { to: '/settings',    icon: Settings,  label: '설정',      tip: null },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const { canUseAuto, canUseBulk, canUseSingle, tierLabel } = usePlanAccess()
  const navigate = useNavigate()

  const [openTip, setOpenTip] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; updatedAt: string } | null>(null)
  const updateStatus = useUpdateStore()

  useEffect(() => {
    window.electron?.system.getUpdateInfo?.().then(setUpdateInfo).catch(() => {})
  }, [])

  // 부제 텍스트 + 색상 (업데이트 상태 우선, 없으면 "최신 버전")
  const subtitle = (() => {
    switch (updateStatus.status) {
      case 'downloading':
        return { text: `업데이트 다운로드 중 ${updateStatus.progress ?? 0}%`, tone: 'progress' as const }
      case 'ready':
        return { text: '업데이트 준비됨 — 설치 요청', tone: 'action' as const }
      case 'error':
        return { text: '업데이트 오류 — 수동 다운로드', tone: 'error' as const }
      default:
        return { text: '최신 버전', tone: 'normal' as const }
    }
  })()

  const handleSubtitleClick = () => {
    if (updateStatus.status === 'ready')      updateStatus.installNow()
    else if (updateStatus.status === 'error') updateStatus.openManualDownload()
  }
  const isClickable = updateStatus.status === 'ready' || updateStatus.status === 'error'

  const accessMap: Record<string, boolean> = {
    auto:   canUseAuto,
    bulk:   canUseBulk,
    single: canUseSingle,
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="
      flex flex-col w-60 min-h-screen shrink-0
      bg-dark-surface dark:bg-dark-surface bg-gray-50
      border-r border-dark-border dark:border-dark-border border-gray-200
      transition-colors duration-200
    ">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-dark-border dark:border-dark-border border-gray-200">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="딸기셀" className="w-10 h-10 shrink-0 select-none" />
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <p className="text-sm font-semibold text-slate-100 dark:text-slate-100 text-gray-900 leading-none">
              딸기셀
            </p>
            {updateInfo && (
              <span className="text-[10px] font-mono text-slate-500 leading-none">v{updateInfo.version}</span>
            )}
          </div>
          <button
            onClick={handleSubtitleClick}
            disabled={!isClickable}
            className={`text-xs mt-1 leading-none transition-colors ${
              subtitle.tone === 'progress' ? 'text-primary-400 font-medium'
              : subtitle.tone === 'action'   ? 'text-emerald-400 font-semibold animate-pulse cursor-pointer hover:text-emerald-300'
              : subtitle.tone === 'error'    ? 'text-amber-400 font-medium cursor-pointer hover:text-amber-300'
              : 'text-slate-500 cursor-default'
            }`}
          >
            {subtitle.text}
          </button>
        </div>
      </div>

      {/* 플랜 표시 */}
      {tierLabel && !user?.isAdmin && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-primary-500/5 border border-primary-500/15">
          <p className="text-[11px] text-slate-500 leading-none mb-1">현재 플랜</p>
          <p className="text-xs font-semibold text-primary-400">{tierLabel}</p>
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, tip, requires }) => {
          const locked = !!requires && !accessMap[requires]
          return (
          <div key={to} className="relative">
            <div className="flex items-center gap-1">
              <NavLink
                to={to}
                onClick={(e) => {
                  if (locked) {
                    e.preventDefault()
                    navigate('/activate')
                  }
                }}
                className={({ isActive }) => `
                  flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${locked
                    ? 'text-slate-600 dark:text-slate-600 text-gray-400 hover:bg-dark-hover/50 dark:hover:bg-dark-hover/50 hover:bg-gray-100 cursor-pointer'
                    : isActive
                      ? 'bg-primary-500/10 text-primary-400 dark:text-primary-400'
                      : 'text-slate-400 dark:text-slate-400 text-gray-600 hover:bg-dark-hover dark:hover:bg-dark-hover hover:bg-gray-100 hover:text-slate-100 dark:hover:text-slate-100 hover:text-gray-900'
                  }
                `}
                title={locked ? '상위 플랜에서 사용 가능 — 클릭하여 업그레이드' : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} className={!locked && isActive ? 'text-primary-400' : ''} />
                    <span className="flex-1">{label}</span>
                    {locked && <Lock size={12} className="text-slate-500" />}
                    {!locked && isActive && <ChevronRight size={14} className="text-primary-400" />}
                  </>
                )}
              </NavLink>

              {/* ? 버튼 */}
              {tip && (
                <button
                  onClick={() => setOpenTip(openTip === to ? null : to)}
                  className={`p-1.5 rounded-md transition-colors shrink-0
                    ${openTip === to
                      ? 'text-primary-400 bg-primary-500/10'
                      : 'text-slate-600 hover:text-slate-300 dark:hover:text-slate-300 hover:text-gray-500'
                    }`}
                  title="기능 설명"
                >
                  <HelpCircle size={19} />
                </button>
              )}
            </div>

            {/* 툴팁 패널 */}
            {tip && openTip === to && (
              <div className="mx-1 mt-1 mb-1 rounded-xl border border-primary-500/20 bg-dark-card dark:bg-dark-card bg-white shadow-lg animate-fade-in overflow-hidden">
                <div className="px-3 py-2 bg-primary-500/10 border-b border-primary-500/15">
                  <p className="text-xs font-semibold text-primary-400">{tip.title}</p>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {tip.rows.map(({ label: rowLabel, value }) => (
                    <div key={rowLabel} className="flex gap-2">
                      <span className="text-[15px] font-medium text-slate-500 w-10 shrink-0 pt-0.5">{rowLabel}</span>
                      <span className="text-[15px] text-slate-300 dark:text-slate-300 text-gray-700 leading-relaxed">{value}</span>
                    </div>
                  ))}
                  {locked && (
                    <div className="mt-2 pt-2 border-t border-primary-500/15">
                      <p className="text-[12px] text-amber-400 flex items-center gap-1">
                        <Lock size={11} /> 상위 플랜에서 사용 가능
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )})}
      </nav>

      {/* 딸기셀 웹사이트 바로가기 배너 */}
      <button
        onClick={() => window.open('https://strawberrysell.com', '_blank')}
        className="
          mx-3 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl
          border border-primary-500/25 bg-gradient-to-br from-primary-500/10 to-primary-500/5
          hover:from-primary-500/15 hover:to-primary-500/10 hover:border-primary-500/40
          transition-all duration-150 group
        "
        title="딸기셀 웹사이트 새 창에서 열기"
      >
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="w-7 h-7 shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold text-slate-100 leading-none">딸기셀 웹사이트</p>
          <p className="text-[10px] text-slate-500 mt-1 leading-none truncate">strawberrysell.com</p>
        </div>
        <ExternalLink size={12} className="text-slate-500 group-hover:text-primary-400 shrink-0 transition-colors" />
      </button>

      {/* 하단 영역 */}
      <div className="px-3 pb-4 space-y-1 border-t border-dark-border dark:border-dark-border border-gray-200 pt-3">
        <ThemeToggle />

        {/* 유저 정보 */}
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 dark:text-slate-300 text-gray-700 truncate font-medium">
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* 관리자 메뉴 */}
        {user?.isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
              transition-all duration-150
              ${isActive
                ? 'bg-purple-500/10 text-purple-400'
                : 'text-slate-400 hover:bg-dark-hover hover:text-slate-100'
              }
            `}
          >
            <ShieldCheck size={16} />
            <span>관리자</span>
          </NavLink>
        )}

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
            text-slate-400 dark:text-slate-400 text-gray-500
            hover:bg-red-500/10 hover:text-red-400
            transition-all duration-150
          "
        >
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
