import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from './stores/authStore'
import { useLicenseStore } from './stores/licenseStore'
import { useSettingsStore } from './stores/settingsStore'
import { isEnabled } from './utils/featureFlags'
import { usePlanAccess, type PlanTier } from './utils/planAccess'

import { Sidebar }         from './components/Sidebar'
import { ChatBubble }      from './components/chat/ChatBubble'
import { UpdateToast }     from './components/UpdateToast'
import { LoginPage }       from './pages/LoginPage'
import { RegisterPage }    from './pages/RegisterPage'
import { ActivatePage }    from './pages/ActivatePage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { DashboardPage }   from './pages/DashboardPage'
import { MatchingPage }    from './pages/MatchingPage'
import { MultiMatchPage }  from './pages/MultiMatchPage'
import { CoupangAutoPage } from './pages/CoupangAutoPage'
import { SettingsPage }    from './pages/SettingsPage'
import { HelpPage }        from './pages/HelpPage'
import { AdminPage }       from './pages/AdminPage'
import { BusinessesPage }  from './pages/BusinessesPage'
import { B2bPartnersPage } from './pages/B2bPartnersPage'

// ─── 인증 보호 레이아웃 ────────────────────────────────────────────────────────

function PlanGate({ requires, children }: { requires: PlanTier; children: React.ReactNode }) {
  const { canUseAuto, canUseBulk, canUseSingle } = usePlanAccess()
  const has = requires === 'auto' ? canUseAuto : requires === 'bulk' ? canUseBulk : canUseSingle
  if (!has) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <UpdateToast />
      <Sidebar />
      <main className="flex flex-col flex-1 min-w-0">
        <Routes>
          <Route path="/dashboard"    element={<DashboardPage />} />
          <Route path="/matching"     element={<PlanGate requires="single"><MatchingPage /></PlanGate>} />
          <Route path="/multi-match"  element={<PlanGate requires="bulk"><MultiMatchPage /></PlanGate>} />
          <Route path="/coupang-auto" element={<PlanGate requires="auto"><CoupangAutoPage /></PlanGate>} />
          <Route path="/settings"     element={<SettingsPage />} />
          <Route path="/help"         element={<HelpPage />} />
          <Route path="/admin"        element={<AdminPage />} />
          <Route path="/businesses"   element={<BusinessesPage />} />
          <Route path="/b2b-partners" element={<B2bPartnersPage />} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <ChatBubble />
    </div>
  )
}

// ─── 초기 로딩 화면 ───────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg dark:bg-dark-bg bg-gray-50 gap-4">
      <span className="text-5xl">🍓</span>
      <Loader2 size={20} className="animate-spin text-primary-400" />
      <p className="text-sm text-slate-500">딸기셀 시작 중...</p>
    </div>
  )
}

// ─── 라우터 가드 ──────────────────────────────────────────────────────────────

function RouterGuard({ children }: { children: React.ReactNode }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isAuthenticated, isLoading: authLoading } = useAuthStore()
  const { isLoading: licLoading }                    = useLicenseStore()

  const isPublic   = ['/login', '/register', '/verify-email'].includes(location.pathname)
  const isActivate = location.pathname === '/activate'
  const isLoading  = authLoading || licLoading
  const user       = useAuthStore.getState().user
  const isPending  = !import.meta.env.DEV && isAuthenticated && user?.status === 'pending'
  const isLicenseExpired =
    !import.meta.env.DEV &&
    isAuthenticated &&
    !user?.isAdmin &&
    user?.licenseExpiresAt !== null &&
    user?.licenseExpiresAt !== undefined &&
    new Date(user.licenseExpiresAt) < new Date()
  const isNoLicense =
    !import.meta.env.DEV &&
    isAuthenticated &&
    !user?.isAdmin &&
    user?.status !== 'pending' &&
    user?.licenseExpiresAt === null &&
    user?.licensePlan === null
  const needsActivate = isPending || isLicenseExpired || isNoLicense

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated && !isPublic) {
      navigate('/login', { replace: true })
    } else if (isAuthenticated && (isPublic || isActivate)) {
      if (needsActivate) navigate('/activate', { replace: true })
      else navigate('/dashboard', { replace: true })
    } else if (isAuthenticated && needsActivate && !isActivate) {
      navigate('/activate', { replace: true })
    }
  }, [isAuthenticated, isPublic, isActivate, needsActivate, isLoading, navigate])

  if (isLoading) return <SplashScreen />
  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { checkAuth, isLoading: authLoading } = useAuthStore()
  const { checkLicense }                      = useLicenseStore()
  const { theme, fontSize }                   = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`
  }, [fontSize])

  useEffect(() => {
    const init = async () => {
      // 1회성 프리셋 마이그레이션 (seed 파일이 있으면 localStorage에 주입)
      try {
        const seedJson = await Promise.race([
          window.electron.system.getPresetSeed(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
        ])
        if (seedJson) {
          const current = localStorage.getItem('strawberrysell-settings')
          const currentParsed = current ? JSON.parse(current) : null
          const seedPartners = JSON.parse(seedJson)?.state?.coupangPartners?.length ?? 0
          const currentPartners = currentParsed?.state?.coupangPartners?.length ?? 0
          if (seedPartners > currentPartners) {
            localStorage.setItem('strawberrysell-settings', seedJson)
            window.location.reload()
            return
          }
        }
      } catch { /* ignore */ }
      await checkAuth()
      if (!import.meta.env.DEV && isEnabled('LICENSE_REQUIRED')) await checkLicense()
    }
    init()
  }, [])

  if (authLoading) return <SplashScreen />

  return (
    <RouterGuard>
      <Routes>
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/register"     element={<RegisterPage />} />
        <Route path="/activate"     element={<ActivatePage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/*"            element={<AppLayout />} />
      </Routes>
    </RouterGuard>
  )
}
