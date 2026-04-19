import { useState, useEffect, useCallback } from 'react'
import { Key, Users, Plus, Trash2, RefreshCw, Copy, Check, AlertCircle, UserCheck, Ban, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'

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
  monthlyUsers:    { month: string; users: string }[]
  monthlyLicenses: { month: string; licenses: string }[]
  monthlyActive:   { month: string; licenses: string }[]
  monthlyExpired:  { month: string; licenses: string }[]
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
  const [activeChart, setActiveChart] = useState<'users' | 'licenses' | 'active' | 'expired'>('users')

  // 라이선스 발급 폼
  const [plan,  setPlan]  = useState('1month')
  const [count, setCount] = useState(1)
  const [newKeys,   setNewKeys]   = useState<string[]>([])
  const [copied,    setCopied]    = useState<string | null>(null)

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

      {/* 통계 */}
      {stats && (
        <>
          <div>
            <p className="text-xs text-slate-500 mb-2">이번 달 현황 — 클릭하면 그래프로 확인</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'users',    label: '신규 사용자',   value: stats.totalUsers,      color: 'text-blue-400',   ring: 'ring-blue-500/50',   bg: 'bg-blue-500/10' },
                { key: 'licenses', label: '발급 라이선스', value: stats.totalLicenses,   color: 'text-purple-400', ring: 'ring-purple-500/50', bg: 'bg-purple-500/10' },
                { key: 'active',   label: '활성 라이선스', value: stats.activeLicenses,  color: 'text-green-400',  ring: 'ring-green-500/50',  bg: 'bg-green-500/10' },
                { key: 'expired',  label: '만료 라이선스', value: stats.expiredLicenses, color: 'text-red-400',    ring: 'ring-red-500/50',    bg: 'bg-red-500/10' },
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
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Plus size={14} /> 라이선스 발급
            </h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-400 mb-1">플랜</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                <label className="block text-xs text-slate-400 mb-1">수량</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-lg text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={createLicenses}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white transition-all"
              >
                <Key size={13} /> 발급하기
              </button>
            </div>

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
