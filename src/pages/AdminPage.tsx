import { useState, useEffect, useCallback } from 'react'
import { Key, Users, Plus, Trash2, RefreshCw, Copy, Check, AlertCircle, UserCheck, Ban, ShieldCheck, Loader2, Building2, Pencil } from 'lucide-react'
import { api, appSettingsApi, partnerCompanyApi, type PartnerCompany } from '../api/client'

interface License {
  id:          string
  key:         string
  expires_at:  string | null
  activated_at:string | null
  created_at:  string
  user_email:  string | null
}

interface User {
  id:              string
  email:           string
  name:            string | null
  phone:           string | null
  is_admin:        boolean
  status:          string
  created_at:      string
  license_key:     string | null
  license_expires: string | null
}

interface Stats {
  totalUsers:      number
  totalLicenses:   number
  activeLicenses:  number
  expiredLicenses: number
  trialUsers:      number
  monthlyUsers:    { month: string; users: string }[]
  monthlyLicenses: { month: string; licenses: string }[]
  monthlyActive:   { month: string; licenses: string }[]
  monthlyExpired:  { month: string; licenses: string }[]
  monthlyTrial:    { month: string; licenses: string }[]
}

function BarChart({ data, color, label }: {
  data: { month: string; value: number }[]
  color: string
  label: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 480, H = 120, PAD = 32, BAR_GAP = 8
  const barW = (W - PAD * 2 - BAR_GAP * (data.length - 1)) / data.length

  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
        {data.map((d, i) => {
          const barH = max === 0 ? 0 : Math.max((d.value / max) * H, d.value > 0 ? 4 : 0)
          const x = PAD + i * (barW + BAR_GAP)
          const y = H - barH
          return (
            <g key={d.month}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} className={color} opacity={0.8} />
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} className="fill-slate-400">{d.value}</text>
              )}
              <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize={9} className="fill-slate-500">
                {d.month.slice(5)}월
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function buildMonthly(rows: { month: string; [key: string]: string }[], key: string): { month: string; value: number }[] {
  const result: { month: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const found = rows.find(r => r.month === m)
    result.push({ month: m, value: found ? Number(found[key]) : 0 })
  }
  return result
}

export function AdminPage() {
  const [tab,       setTab]       = useState<'licenses' | 'users'>('licenses')
  const [licenses,  setLicenses]  = useState<License[]>([])
  const [users,     setUsers]     = useState<User[]>([])
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [betaMode,    setBetaMode]    = useState<boolean | null>(null)
  const [betaSaving,  setBetaSaving]  = useState(false)
  const [activeChart, setActiveChart] = useState<'users' | 'licenses' | 'active' | 'expired' | 'trial'>('users')

  // 라이선스 발급 폼
  const [plan,  setPlan]  = useState('1month')
  const [count, setCount] = useState(1)
  const [planTier,  setPlanTier]  = useState<'auto' | 'bulk' | 'single'>('single')
  const [label,     setLabel]     = useState('')
  const [issuedTo,  setIssuedTo]  = useState('')
  const [issueNotes,setIssueNotes]= useState('')
  const [newKeys,   setNewKeys]   = useState<string[]>([])
  const [copied,    setCopied]    = useState<string | null>(null)

  // 발급 프리셋
  const applyPreset = (preset: 'official' | 'beta' | 'partner') => {
    if (preset === 'official') {
      setPlan('1month'); setPlanTier('single'); setLabel(''); setIssuedTo(''); setIssueNotes('')
    } else if (preset === 'beta') {
      setPlan('3month'); setPlanTier('auto'); setLabel('베타테스터'); setIssuedTo(''); setIssueNotes('베타 테스트 참여 - 발급일 + 90일')
    } else {
      setPlan('3month'); setPlanTier('auto'); setLabel('협업'); setIssuedTo(''); setIssueNotes('협업 라이선스')
    }
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [statsRes, licRes, userRes] = await Promise.all([
        api.get<Stats>('/admin/stats'),
        api.get<License[]>('/admin/licenses'),
        api.get<User[]>('/admin/users'),
      ])
      setStats(statsRes.data)
      setLicenses(licRes.data)
      setUsers(userRes.data)
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    api.get<{ betaMode: boolean }>('/admin/beta-mode')
      .then(r => setBetaMode(r.data.betaMode))
      .catch(() => {})
  }, [loadData])

  const toggleBetaMode = async () => {
    if (betaMode === null) return
    setBetaSaving(true)
    try {
      const { data } = await api.patch<{ betaMode: boolean }>('/admin/beta-mode', { betaMode: !betaMode })
      setBetaMode(data.betaMode)
    } finally {
      setBetaSaving(false)
    }
  }

  const createLicenses = async () => {
    try {
      const { data } = await api.post<{ keys: string[] }>('/admin/licenses', {
        plan,
        count,
        planTier,
        label:    label || undefined,
        issuedTo: issuedTo || undefined,
        notes:    issueNotes || undefined,
      })
      setNewKeys(data.keys)
      await loadData()
    } catch {
      setError('라이선스 발급에 실패했습니다.')
    }
  }

  const deleteLicense = async (id: string) => {
    if (!confirm('라이선스 키를 삭제하시겠습니까?')) return
    await api.delete(`/admin/licenses/${id}`)
    await loadData()
  }

  const deleteUser = async (id: string) => {
    if (!confirm('사용자를 삭제하시겠습니까? 라이선스도 함께 해제됩니다.')) return
    await api.delete(`/admin/users/${id}`)
    await loadData()
  }

  const approveUser = async (id: string) => {
    await api.patch(`/admin/users/${id}/approve`)
    await loadData()
  }

  const banUser = async (id: string) => {
    if (!confirm('계정을 정지하시겠습니까? 즉시 로그아웃 처리됩니다.')) return
    await api.patch(`/admin/users/${id}/ban`)
    await loadData()
  }

  const unbanUser = async (id: string) => {
    await api.patch(`/admin/users/${id}/unban`)
    await loadData()
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">관리자</h1>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-dark-hover transition-all">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* 베타모드 토글 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">베타 모드</p>
          <p className="text-xs text-slate-500 mt-0.5">ON이면 모든 플랜 무료 표시, 결제 버튼 숨김</p>
        </div>
        <button
          onClick={toggleBetaMode}
          disabled={betaSaving || betaMode === null}
          className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
            betaMode ? 'bg-emerald-500' : 'bg-dark-muted'
          } disabled:opacity-50`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
            betaMode ? 'left-7' : 'left-1'
          }`} />
        </button>
      </div>

      {/* 쿠팡 OpenAPI 안내 값 편집 */}
      <CoupangOpenapiAdminEditor />

      {/* 통계 */}
      {stats && (
        <>
          <div>
            <p className="text-xs text-slate-500 mb-2">이번 달 현황 — 클릭하면 그래프로 확인</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { key: 'users',    label: '신규 사용자',     value: stats.totalUsers,      color: 'text-blue-400',    ring: 'ring-blue-500/50',    bg: 'bg-blue-500/10' },
                { key: 'licenses', label: '발급 라이선스',   value: stats.totalLicenses,   color: 'text-purple-400',  ring: 'ring-purple-500/50',  bg: 'bg-purple-500/10' },
                { key: 'active',   label: '활성 라이선스',   value: stats.activeLicenses,  color: 'text-green-400',   ring: 'ring-green-500/50',   bg: 'bg-green-500/10' },
                { key: 'expired',  label: '만료 라이선스',   value: stats.expiredLicenses, color: 'text-red-400',     ring: 'ring-red-500/50',     bg: 'bg-red-500/10' },
                { key: 'trial',    label: '7일 무료이용중',  value: stats.trialUsers,      color: 'text-amber-400',   ring: 'ring-amber-500/50',   bg: 'bg-amber-500/10' },
              ].map(({ key, label, value, color, ring, bg }) => (
                <button
                  key={key}
                  onClick={() => setActiveChart(key as any)}
                  className={`text-left rounded-xl p-4 border transition-all ${
                    activeChart === key
                      ? `${bg} border-transparent ring-2 ${ring}`
                      : 'bg-dark-card border-dark-border hover:border-slate-600'
                  }`}
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 월별 그래프 */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            {activeChart === 'users' && <BarChart label="월별 신규 사용자 (최근 6개월)" color="fill-blue-400"
              data={buildMonthly(stats.monthlyUsers, 'users')} />}
            {activeChart === 'licenses' && <BarChart label="월별 발급 라이선스 (최근 6개월)" color="fill-purple-400"
              data={buildMonthly(stats.monthlyLicenses, 'licenses')} />}
            {activeChart === 'active' && <BarChart label="월별 활성 라이선스 (최근 6개월)" color="fill-green-400"
              data={buildMonthly(stats.monthlyActive, 'licenses')} />}
            {activeChart === 'expired' && <BarChart label="월별 만료 라이선스 (최근 6개월)" color="fill-red-400"
              data={buildMonthly(stats.monthlyExpired, 'licenses')} />}
            {activeChart === 'trial' && <BarChart label="월별 신규 무료체험 (최근 6개월)" color="fill-amber-400"
              data={buildMonthly(stats.monthlyTrial, 'licenses')} />}
          </div>
        </>
      )}

      {/* 탭 */}
      <div className="flex gap-2">
        {[
          { id: 'licenses', label: '라이선스 관리', icon: Key },
          { id: 'users',    label: '사용자 관리',   icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* 라이선스 탭 */}
      {tab === 'licenses' && (
        <div className="flex flex-col gap-4">
          {/* 발급 폼 */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Plus size={14} /> 라이선스 발급
            </h3>

            {/* 프리셋 */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => applyPreset('official')} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-dark-border hover:border-primary-500/40 hover:bg-primary-500/5 text-slate-300 transition-all">
                🎫 정식 발급
              </button>
              <button onClick={() => applyPreset('beta')} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-dark-border hover:border-amber-500/40 hover:bg-amber-500/5 text-slate-300 transition-all">
                🧪 베타 키 (3개월 무료·전체)
              </button>
              <button onClick={() => applyPreset('partner')} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-dark-border hover:border-purple-500/40 hover:bg-purple-500/5 text-slate-300 transition-all">
                🤝 협업 키 (3개월 무료·전체)
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">플랜 (기간)</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="1month_free">1개월 무료</option>
                  <option value="1month">1개월</option>
                  <option value="3month">3개월</option>
                  <option value="6month">6개월</option>
                  <option value="12month">12개월</option>
                  <option value="unlimited">무제한</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">플랜 티어 (기기 수)</label>
                <select
                  value={planTier}
                  onChange={(e) => setPlanTier(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="single">1:1 주문매칭 (1대)</option>
                  <option value="bulk">일괄매칭 (2대)</option>
                  <option value="auto">자동매칭 (3대)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">수량</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">라벨</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="정식 / 베타 / 협업 / 이벤트"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">받는 사람</label>
                <input
                  type="text"
                  value={issuedTo}
                  onChange={(e) => setIssuedTo(e.target.value)}
                  placeholder="김OO / 씨앗마트 등"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">메모</label>
                <input
                  type="text"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="발급 이유, 연락처 등"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <button
              onClick={createLicenses}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all"
            >
              <Key size={13} /> 발급하기
            </button>

            {newKeys.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-green-400 font-medium mb-2">발급된 키 ({newKeys.length}개)</p>
                {newKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-slate-300 flex-1 font-mono">{key}</code>
                    <button onClick={() => copyKey(key)} className="text-slate-400 hover:text-slate-200 transition-colors">
                      {copied === key ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 협력업체 관리 */}
          <PartnerCompaniesPanel />

          {/* 목록 */}
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">라이선스 키</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">사용자</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">만료일</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">상태</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => (
                  <tr key={lic.id} className="border-b border-dark-border/50 hover:bg-dark-hover/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-slate-300 font-mono">{lic.key.slice(0, 18)}...</code>
                        <button onClick={() => copyKey(lic.key)} className="text-slate-500 hover:text-slate-300 transition-colors">
                          {copied === lic.key ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{lic.user_email ?? '미사용'}</td>
                    <td className="px-4 py-3 text-slate-400">{lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('ko-KR') : '무제한'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        lic.activated_at
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {lic.activated_at ? '활성' : '미사용'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteLicense(lic.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 사용자 탭 */}
      {tab === 'users' && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">이름</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">이메일</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">전화번호</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">상태</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">라이선스 만료</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">가입일</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">권한</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-dark-border/50 hover:bg-dark-hover/50 transition-colors">
                  <td className="px-4 py-3 text-slate-200">{user.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-200">{user.email}</td>
                  <td className="px-4 py-3 text-slate-400">{user.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      user.status === 'active'  ? 'bg-green-500/20 text-green-400' :
                      user.status === 'banned'  ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {user.status === 'active' ? '활성' : user.status === 'banned' ? '정지' : '대기중'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {user.license_expires ? new Date(user.license_expires).toLocaleDateString('ko-KR') : '무제한'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      user.is_admin
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {user.is_admin ? '관리자' : '일반'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!user.is_admin && user.status === 'pending' && (
                        <button onClick={() => approveUser(user.id)} title="승인" className="text-slate-500 hover:text-green-400 transition-colors">
                          <UserCheck size={13} />
                        </button>
                      )}
                      {!user.is_admin && user.status !== 'banned' && (
                        <button onClick={() => banUser(user.id)} title="정지" className="text-slate-500 hover:text-orange-400 transition-colors">
                          <Ban size={13} />
                        </button>
                      )}
                      {!user.is_admin && user.status === 'banned' && (
                        <button onClick={() => unbanUser(user.id)} title="정지 해제" className="text-slate-500 hover:text-green-400 transition-colors">
                          <ShieldCheck size={13} />
                        </button>
                      )}
                      {!user.is_admin && (
                        <button onClick={() => deleteUser(user.id)} title="삭제" className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── 쿠팡 OpenAPI 안내 값 편집 ────────────────────────────────────────────────

function CoupangOpenapiAdminEditor() {
  const [name, setName] = useState('')
  const [url,  setUrl]  = useState('')
  const [ip,   setIp]   = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    appSettingsApi.getCoupangOpenapi()
      .then(info => {
        setName(info.name)
        setUrl(info.url)
        setIp(info.ip)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await appSettingsApi.updateCoupangOpenapi({ name, url, ip })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 size={12} className="animate-spin" /> 불러오는 중...
      </div>
    )
  }

  const FIELDS: Array<{ label: string; value: string; setter: (v: string) => void; mono?: boolean }> = [
    { label: '이름',     value: name, setter: setName },
    { label: '주소 URL', value: url,  setter: setUrl },
    { label: 'IP 주소',  value: ip,   setter: setIp, mono: true },
  ]

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">쿠팡 OpenAPI 안내 값</p>
          <p className="text-xs text-slate-500 mt-0.5">사용자에게 표시되는 "WING OpenAPI 발급" 가이드 값. IP가 바뀌면 여기서 수정</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 transition-all"
        >
          {saving && <Loader2 size={11} className="animate-spin" />}
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>
      <div className="space-y-2">
        {FIELDS.map(({ label, value, setter, mono }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 w-20 shrink-0">{label}</span>
            <input
              type="text"
              value={value}
              onChange={e => setter(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs bg-dark-hover border border-dark-border text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 ${mono ? 'font-mono' : ''}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 협력업체 관리 ────────────────────────────────────────────────────────────

function PartnerCompaniesPanel() {
  const [items, setItems]     = useState<PartnerCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName]       = useState('')
  const [discount, setDiscount] = useState(50)
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDiscount, setEditDiscount] = useState(50)
  const [editNotes, setEditNotes]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await partnerCompanyApi.list()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await partnerCompanyApi.create(name.trim(), discount, notes || undefined)
      setName(''); setDiscount(50); setNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: PartnerCompany) {
    await partnerCompanyApi.update(p.id, { active: !p.active })
    await load()
  }

  async function remove(p: PartnerCompany) {
    if (!confirm(`'${p.name}' 업체를 삭제할까요?`)) return
    await partnerCompanyApi.remove(p.id)
    await load()
  }

  function startEdit(p: PartnerCompany) {
    setEditingId(p.id)
    setEditDiscount(p.discount_percent)
    setEditNotes(p.notes ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(p: PartnerCompany) {
    await partnerCompanyApi.update(p.id, {
      discountPercent: editDiscount,
      notes:           editNotes,
    })
    setEditingId(null)
    await load()
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
        <Building2 size={14} /> 협력업체 관리
      </h3>
      <p className="text-xs text-slate-500 mb-4">등록된 업체는 결제 시 해당 업체명 입력 → 3개월 플랜에 자동 할인 적용</p>

      {/* 추가 폼 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="업체명 (예: 씨앗마트)"
          className="px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={99}
            value={discount}
            onChange={e => setDiscount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-xs text-slate-500">%</span>
        </div>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="메모 (선택)"
          className="px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !name.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 transition-all"
        >
          <Plus size={12} /> 업체 추가
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin" /> 불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">등록된 협력업체가 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(p => {
            const isEditing = editingId === p.id
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                  p.active
                    ? 'bg-dark-hover border-dark-border'
                    : 'bg-dark-hover/40 border-dark-border opacity-60'
                } ${isEditing ? 'ring-1 ring-primary-500/40' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={editDiscount}
                          onChange={e => setEditDiscount(Number(e.target.value))}
                          className="w-14 px-2 py-0.5 rounded text-xs bg-dark-bg border border-primary-500/40 text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    ) : (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary-500/15 text-primary-300 font-semibold shrink-0">
                        -{p.discount_percent}%
                      </span>
                    )}
                    {!p.active && <span className="text-[10px] text-slate-500 shrink-0">(비활성)</span>}
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="메모"
                      className="mt-1 w-full px-2 py-1 rounded text-xs bg-dark-bg border border-dark-border text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  ) : (
                    p.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.notes}</p>
                  )}
                </div>

                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(p)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                    >
                      <Check size={11} /> 저장
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-2 py-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                      title="할인율 수정"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      className="text-xs px-2 py-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      {p.active ? '비활성화' : '활성화'}
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
