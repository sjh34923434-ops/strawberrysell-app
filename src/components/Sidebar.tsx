import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, GitMerge, Settings, LogOut, ChevronRight, Layers, HelpCircle, BookOpen, ShieldCheck, Building2, ShoppingCart, Database } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { ThemeToggle } from './ThemeToggle'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: BarChart3,  label: '대시보드',   tip: null },
  {
    to: '/coupang-auto', icon: ShoppingCart, label: '쿠팡 자동매칭',
    tip: {
      title: '쿠팡 자동매칭',
      rows: [
        { label: '용도',   value: '쿠팡 API로 주문을 자동으로 가져와 거래처별 분류 출력' },
        { label: '입력',   value: '쿠팡 API (날짜 범위 선택)' },
        { label: '출력',   value: '거래처별 B2B 파일 N개' },
      ],
    },
  },
  {
    to: '/multi-match', icon: Layers,    label: '일괄매칭',
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
    to: '/matching',    icon: GitMerge,  label: '주문매칭',
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
    to: '/b2b-partners', icon: Database, label: '거래처 B2B',
    tip: {
      title: '거래처 B2B 관리',
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
] as const

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const [openTip, setOpenTip] = useState<string | null>(null)

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
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500 text-white font-bold text-sm select-none">
          🍓
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100 dark:text-slate-100 text-gray-900 leading-none">
            딸기셀
          </p>
          <p className="text-xs text-slate-500 mt-0.5">주문매칭 시스템</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, tip }) => (
          <div key={to} className="relative">
            <div className="flex items-center gap-1">
              <NavLink
                to={to}
                className={({ isActive }) => `
                  flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${isActive
                    ? 'bg-primary-500/10 text-primary-400 dark:text-primary-400'
                    : 'text-slate-400 dark:text-slate-400 text-gray-600 hover:bg-dark-hover dark:hover:bg-dark-hover hover:bg-gray-100 hover:text-slate-100 dark:hover:text-slate-100 hover:text-gray-900'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} className={isActive ? 'text-primary-400' : ''} />
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight size={14} className="text-primary-400" />}
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
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>

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
