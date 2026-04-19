import React from 'react'
import { useNavigate } from 'react-router-dom'
import { GitMerge, Layers, Truck, ArrowRight, Key, Clock, CheckCircle2, TrendingUp, ShoppingCart } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useLicenseStore } from '../stores/licenseStore'
import { OnboardingChecklist } from '../components/OnboardingChecklist'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?:  string
  icon:  React.ElementType
  color: string
}) {
  return (
    <div className="
      bg-dark-card dark:bg-dark-card bg-white
      border border-dark-border dark:border-dark-border border-gray-200
      rounded-2xl p-5
    ">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={18} className="opacity-90" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100 dark:text-slate-100 text-gray-900">{value}</p>
      <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 dark:text-slate-600 text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { isActivated, expiresAt, licenseKey } = useLicenseStore()

  const expiresDate = expiresAt ? new Date(expiresAt) : null
  const daysLeft = expiresDate
    ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / 86_400_000))
    : null

  const formatDate = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8 animate-fade-in">

        {/* 헤더 */}
        <div>
          <h1 className="text-xl font-bold text-slate-100 dark:text-slate-100 text-gray-900">
            대시보드
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 mt-1">
            안녕하세요, <span className="text-slate-300 dark:text-slate-300 text-gray-700 font-medium">{user?.email}</span>님
          </p>
        </div>

        {/* 온보딩 체크리스트 */}
        <OnboardingChecklist />

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="라이선스 상태"
            value={isActivated ? '활성' : '미등록'}
            icon={isActivated ? CheckCircle2 : Key}
            color={isActivated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}
          />
          <StatCard
            label="만료까지"
            value={daysLeft !== null ? `${daysLeft}일` : '—'}
            sub={expiresDate ? `${formatDate(expiresDate)} 만료` : undefined}
            icon={Clock}
            color="bg-primary-500/10 text-primary-400"
          />
          <StatCard
            label="이번 달 매칭"
            value="—"
            sub="사용 통계 준비 중"
            icon={TrendingUp}
            color="bg-sky-500/10 text-sky-400"
          />
          <StatCard
            label="총 매칭 건수"
            value="—"
            sub="사용 통계 준비 중"
            icon={GitMerge}
            color="bg-violet-500/10 text-violet-400"
          />
        </div>

        {/* 라이선스 정보 */}
        {isActivated && licenseKey && (
          <div className="
            bg-dark-card dark:bg-dark-card bg-white
            border border-dark-border dark:border-dark-border border-gray-200
            rounded-2xl p-5 space-y-3
          ">
            <h2 className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800">
              라이선스 정보
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1">라이선스 키</p>
                <p className="text-slate-300 dark:text-slate-300 text-gray-700 font-mono text-xs tracking-wider">
                  {licenseKey.replace(/(.{4})/g, '$1-').slice(0, -1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">만료일</p>
                <p className="text-slate-300 dark:text-slate-300 text-gray-700">
                  {expiresDate ? formatDate(expiresDate) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 빠른 시작 */}
        <div className="
          bg-dark-card dark:bg-dark-card bg-white
          border border-dark-border dark:border-dark-border border-gray-200
          rounded-2xl p-5
        ">
          <h2 className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800 mb-4">
            빠른 시작
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/coupang-auto')}
              className="
                w-full flex items-center gap-4 px-4 py-4 rounded-xl
                bg-orange-500/10 hover:bg-orange-500/20
                border border-orange-500/30 hover:border-orange-500/50
                shadow-[0_0_16px_rgba(249,115,22,0.15)] hover:shadow-[0_0_24px_rgba(249,115,22,0.25)]
                transition-all duration-150 group text-left
              "
            >
              <div className="p-2.5 rounded-xl bg-orange-500/20">
                <ShoppingCart size={20} className="text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-300">
                  쿠팡 자동매칭 시작하기
                </p>
                <p className="text-xs text-orange-400/70 mt-0.5">
                  쿠팡 API로 주문을 가져와 거래처별 자동 분류·출력
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-orange-400/60 group-hover:text-orange-300 group-hover:translate-x-1 transition-all duration-150"
              />
            </button>

            <button
              onClick={() => navigate('/multi-match')}
              className="
                w-full flex items-center gap-4 px-4 py-4 rounded-xl
                bg-violet-500/10 hover:bg-violet-500/20
                border border-violet-500/30 hover:border-violet-500/50
                shadow-[0_0_16px_rgba(139,92,246,0.15)] hover:shadow-[0_0_24px_rgba(139,92,246,0.25)]
                transition-all duration-150 group text-left
              "
            >
              <div className="p-2.5 rounded-xl bg-violet-500/20">
                <Layers size={20} className="text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-300">
                  일괄매칭 시작하기
                </p>
                <p className="text-xs text-violet-400/70 mt-0.5">
                  여러 거래처가 섞인 주문 파일을 한번에 분류·처리
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-violet-400/60 group-hover:text-violet-300 group-hover:translate-x-1 transition-all duration-150"
              />
            </button>

            <button
              onClick={() => navigate('/matching')}
              className="
                w-full flex items-center gap-4 px-4 py-4 rounded-xl
                bg-cyan-400/20 hover:bg-cyan-400/30
                border border-cyan-400/50 hover:border-cyan-400/80
                shadow-[0_0_16px_rgba(34,211,238,0.2)] hover:shadow-[0_0_24px_rgba(34,211,238,0.35)]
                transition-all duration-150 group text-left
              "
            >
              <div className="p-2.5 rounded-xl bg-cyan-400/25">
                <GitMerge size={20} className="text-cyan-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400">
                  주문매칭 시작하기
                </p>
                <p className="text-xs text-cyan-400/70 mt-0.5">
                  주문 엑셀 + B2B 엑셀을 업로드하여 자동 매칭
                </p>
              </div>
              <ArrowRight
                size={18}
                className="text-cyan-400/60 group-hover:text-cyan-300 group-hover:translate-x-1 transition-all duration-150"
              />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
