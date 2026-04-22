import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Upload, ArrowRight, ArrowDown,
  GitMerge, Layers, Save, Download, Settings2,
  FileSpreadsheet, CheckCircle2, SplitSquareHorizontal,
  PlusCircle, FolderOpen, Repeat, Truck, Package,
  Building2, Key, RefreshCw, Zap, Store, Database,
} from 'lucide-react'

// ─── 공통 컴포넌트 ─────────────────────────────────────────────────────────────

function FlowStep({
  icon: Icon, label, sub, color = 'bg-primary-500/10 text-primary-400 border-primary-500/20',
}: { icon: React.ElementType; label: string; sub?: string; color?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border ${color} min-w-[110px]`}>
      <Icon size={20} />
      <p className="text-sm font-semibold text-center leading-tight">{label}</p>
      {sub && <p className="text-xs text-slate-500 text-center leading-tight">{sub}</p>}
    </div>
  )
}

function Arrow({ vertical = false }: { vertical?: boolean }) {
  return vertical
    ? <div className="flex justify-center"><ArrowDown size={16} className="text-slate-500 my-1" /></div>
    : <ArrowRight size={16} className="text-slate-500 shrink-0 mx-1" />
}

function SectionWrap({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-dark-border dark:border-dark-border border-gray-200 bg-dark-card dark:bg-dark-card bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-dark-hover dark:hover:bg-dark-hover hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800">{title}</span>
        {open ? <ChevronUp size={20} className="text-lime-400" /> : <ChevronDown size={20} className="text-lime-400" />}
      </button>
      {open && (
        <div className="px-5 pb-6 border-t border-dark-border dark:border-dark-border border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── 섹션 0: 전체 발주 흐름 ───────────────────────────────────────────────────

function FullFlowSection() {
  return (
    <SectionWrap title="🔄 전체 발주 프로세스 한눈에 보기">
      <div className="mt-5 space-y-4">

        {/* 자동 vs 수동 요약 카드 */}
        <div className="rounded-xl border border-dark-border bg-dark-hover/30 p-4">
          <p className="text-xs text-slate-400 text-center mb-3 leading-relaxed">
            6단계 중 <span className="text-primary-300 font-bold">① ② ③</span> 은 딸기셀이 <span className="text-primary-200 font-bold">한 번에 자동 처리</span>,{' '}
            <span className="text-amber-300 font-bold">④</span> 는 <span className="text-amber-200 font-bold">사람·거래처가 직접</span>,{' '}
            <span className="text-primary-300 font-bold">⑤ ⑥</span> 은 다시 <span className="text-primary-200 font-bold">한 번에 자동 처리</span>됩니다.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="py-2 rounded-lg bg-primary-500/10 border border-primary-500/30">
              <p className="text-primary-300 font-bold">1·2·3 자동</p>
              <p className="text-slate-400 mt-0.5">주문수집→분류→B2B</p>
            </div>
            <div className="py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-amber-300 font-bold">4 수동</p>
              <p className="text-slate-400 mt-0.5">거래처 전송·출고</p>
            </div>
            <div className="py-2 rounded-lg bg-primary-500/10 border border-primary-500/30">
              <p className="text-primary-300 font-bold">5·6 자동</p>
              <p className="text-slate-400 mt-0.5">송장매칭→쿠팡 전송</p>
            </div>
          </div>
        </div>

        {/* ── GROUP A: 자동 (1·2·3) ───────────────────── */}
        <div className="relative rounded-xl border-2 border-primary-500/40 bg-primary-500/5 p-4 mt-4">
          <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-dark-card border border-primary-500/50 text-[11px] font-bold text-primary-300">
            <Zap size={10} />
            자동 · 딸기셀이 한 번에 처리
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-500/20 text-sky-300 text-sm font-bold shrink-0">1</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-sky-300">주문 접수</p>
                <p className="text-sm text-slate-400 mt-0.5">마켓(쿠팡·스마트스토어 등) 주문 엑셀 다운로드 또는 자동매칭 탭에서 API로 자동 수집</p>
              </div>
              <FileSpreadsheet size={16} className="text-sky-400 shrink-0" />
            </div>

            <Arrow vertical />

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold shrink-0">2</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-violet-300">일괄매칭 <span className="text-sm font-normal text-slate-500">— 거래처가 여럿일 때</span></p>
                <p className="text-sm text-slate-400 mt-0.5">주문파일 1개 → 거래처별 B2B 파일 N개로 분류 (마켓 선택 후 실행)</p>
              </div>
              <Layers size={16} className="text-violet-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2 pl-4">
              <div className="w-px h-4 bg-slate-600" />
              <p className="text-sm text-slate-500">거래처가 1곳이면 1:1 주문매칭으로 바로 이동</p>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-500/20 text-primary-300 text-sm font-bold shrink-0">3</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-primary-300">주문매칭 → B2B 양식 자동 입력</p>
                <p className="text-sm text-slate-400 mt-0.5">B2B 양식에 주문 데이터 자동으로 채워서 다운로드 완료</p>
              </div>
              <GitMerge size={16} className="text-primary-400 shrink-0" />
            </div>
          </div>
        </div>

        <Arrow vertical />

        {/* ── GROUP B: 수동 (3.5 거래처 전송 + 4 출고) ────── */}
        <div className="relative rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
          <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-dark-card border border-amber-500/50 text-[11px] font-bold text-amber-300">
            수동 · 사람·거래처가 직접 처리
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold shrink-0">3.5</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-amber-300">거래처 전송</p>
                <p className="text-sm text-slate-400 mt-0.5">다운로드한 B2B 파일을 거래처에 전달 <span className="text-amber-300/80">(직접)</span></p>
              </div>
              <Upload size={16} className="text-amber-400 shrink-0" />
            </div>

            <Arrow vertical />

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-500/20 text-slate-300 text-sm font-bold shrink-0">4</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-slate-300">거래처 출고 처리</p>
                <p className="text-sm text-slate-400 mt-0.5">거래처가 B2B 파일 받아 출고 → 택배번호가 있는 운송장 파일 회신</p>
              </div>
              <Package size={16} className="text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        <Arrow vertical />

        {/* ── GROUP C: 자동 (5·6) ──────────────────────── */}
        <div className="relative rounded-xl border-2 border-primary-500/40 bg-primary-500/5 p-4">
          <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-dark-card border border-primary-500/50 text-[11px] font-bold text-primary-300">
            <Zap size={10} />
            자동 · 딸기셀이 한 번에 처리
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 text-sm font-bold shrink-0">5</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-amber-300">송장번호 추가 탭</p>
                <p className="text-sm text-slate-400 mt-0.5">운송장 파일 업로드 → 주문 파일에 송장번호 자동 매칭</p>
              </div>
              <Truck size={16} className="text-amber-400 shrink-0" />
            </div>

            <Arrow vertical />

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-bold shrink-0">6</div>
              <div className="flex-1">
                <p className="text-base font-semibold text-emerald-300">마켓 송장 업로드 완료</p>
                <p className="text-sm text-slate-400 mt-0.5">생성된 파일을 마켓 판매자센터에 업로드 또는 쿠팡은 API로 자동 전송</p>
              </div>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            </div>
          </div>
        </div>

      </div>
    </SectionWrap>
  )
}

// ─── 섹션 1: 거래처 B2B 관리 ──────────────────────────────────────────────────

function B2bSection() {
  return (
    <SectionWrap title="🗂 거래처 B2B 관리 — 1회 등록으로 모든 탭 자동 적용">
      <div className="mt-5 space-y-4">

        <p className="text-xs text-slate-400">
          거래처 B2B 관리에서 한 번 설정해두면 일괄매칭·주문매칭·자동매칭 모든 탭에서 자동으로 적용됩니다.
        </p>

        {/* 탭 3개 설명 */}
        <div className="space-y-2">
          {[
            {
              icon: FileSpreadsheet, color: 'text-primary-400 border-primary-500/20 bg-primary-500/5',
              label: '① B2B 주문 양식 (필수)',
              desc: '거래처(도매처)에 보내는 발주서 엑셀 파일과 컬럼 설정을 저장합니다.\n마켓별로 주문 컬럼이 다를 수 있으므로 마켓 탭을 선택해 각각 저장하세요.',
            },
            {
              icon: Truck, color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
              label: '② 송장 매칭 프리셋 (선택)',
              desc: '거래처가 보내주는 운송장 파일 컬럼명이 특이할 때(예: "고객성함", "연락처", "택배번호") 매칭 규칙을 저장하는 기능입니다.\n한 번 등록하면 파일 올릴 때 자동 인식 → 자동 실행됩니다.\n※ 컬럼명이 "수령인명/전화번호/운송장번호"처럼 표준적이면 자동 감지로 잡히므로 등록 안 해도 됩니다.',
            },
            {
              icon: Store, color: 'text-violet-400 border-violet-500/20 bg-violet-500/5',
              label: '③ 마켓 송장등록 양식 (선택)',
              desc: '자체 업로드 양식을 요구하는 까다로운 마켓에만 필요합니다.\n양식을 등록해두면 매칭 결과가 해당 마켓 양식에 맞게 자동 변환됩니다.\n※ 쿠팡은 API 전송이라 불필요, 대부분의 마켓은 주문 엑셀 그대로 올리면 되므로 등록 안 해도 됩니다.',
            },
          ].map((item, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${item.color}`}>
              <item.icon size={15} className={`shrink-0 mt-0.5 ${item.color.split(' ')[0]}`} />
              <div>
                <p className="text-sm font-semibold text-slate-200 mb-1">{item.label}</p>
                {item.desc.split('\n').map((line, j) => (
                  <p key={j} className="text-xs text-slate-400 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 마켓별 컬럼 매핑 */}
        <div className="rounded-xl bg-sky-500/5 border border-sky-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-sky-400">마켓별 컬럼 매핑이란?</p>
          <p className="text-xs text-slate-400">쿠팡·스마트스토어·11번가 등 마켓마다 주문 엑셀의 컬럼명이 다릅니다.</p>
          <p className="text-xs text-slate-400">B2B 주문 양식 편집 화면에서 상단 마켓 탭(쿠팡 / 스마트스토어 / …)을 선택해 각각 컬럼 매핑을 저장하면, 해당 마켓 주문 처리 시 자동으로 올바른 매핑이 적용됩니다.</p>
        </div>

      </div>
    </SectionWrap>
  )
}

// ─── 섹션 2: 자동매칭 ─────────────────────────────────────────────────────────

function AutoMatchSection() {
  return (
    <SectionWrap title="⚡ 자동매칭 — API로 주문 자동 수집">
      <div className="mt-5 space-y-4">

        <p className="text-xs text-slate-400">
          마켓 API로 주문을 직접 가져와 거래처별로 자동 분류·출력하는 기능입니다.
          주문 엑셀을 수동으로 다운로드할 필요가 없습니다.
        </p>

        {/* 마켓 현황 */}
        <div className="rounded-xl border border-dark-border bg-dark-hover/30 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-3">마켓별 지원 현황</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: '쿠팡', status: '사용가능', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { name: '스마트스토어', status: '준비중', color: 'text-slate-500 bg-dark-hover border-dark-border' },
              { name: '11번가', status: '준비중', color: 'text-slate-500 bg-dark-hover border-dark-border' },
              { name: '옥션/지마켓', status: '준비중', color: 'text-slate-500 bg-dark-hover border-dark-border' },
            ].map(m => (
              <div key={m.name} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${m.color}`}>
                <span className="font-medium text-slate-300">{m.name}</span>
                <span>{m.status}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">준비중 마켓은 API 연동 완료 시 자동으로 사용가능으로 전환됩니다.</p>
        </div>

        {/* 사용 흐름 */}
        <div className="space-y-2">
          {[
            {
              num: 1, label: '마켓 선택', icon: Zap, color: 'border-sky-500/30 bg-sky-500/5',
              iconColor: 'text-sky-400',
              desc: '자동매칭 탭 진입 → 마켓 카드 선택 (쿠팡 등)\n사업자 관리에서 API 연동된 마켓만 "사용가능" 표시',
            },
            {
              num: 2, label: '주문 가져오기', icon: RefreshCw, color: 'border-orange-500/30 bg-orange-500/5',
              iconColor: 'text-orange-400',
              desc: '사업자 선택 → 날짜 범위 설정 → 주문 상태 선택 → 주문 가져오기\n가져온 주문 건수 확인 후 다음 단계',
            },
            {
              num: 3, label: '결과 다운로드', icon: Download, color: 'border-emerald-500/30 bg-emerald-500/5',
              iconColor: 'text-emerald-400',
              desc: '거래처별 B2B 파일 개별 또는 전체 ZIP 다운로드\n미매칭 주문 별도 확인 가능',
            },
          ].map((s, i) => (
            <div key={s.num}>
              <div className={`flex items-start gap-4 p-4 rounded-xl border ${s.color}`}>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-dark-hover text-xs font-bold text-slate-400">{s.num}</div>
                  <s.icon size={20} className={s.iconColor} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200 mb-1">{s.label}</p>
                  {s.desc.split('\n').map((line, j) => (
                    <p key={j} className="text-xs text-slate-400 leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>
              {i < 2 && <Arrow vertical />}
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-primary-500/5 border border-primary-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-primary-400">사용 전 필수 조건</p>
          {[
            '사업자 관리에서 쿠팡 사업자 등록 및 API 키 입력',
            '쿠팡 Wing → 판매자 정보 → Open API 신청 후 승인 (1영업일)',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 size={11} className="text-primary-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>

      </div>
    </SectionWrap>
  )
}

// ─── 섹션 3: 주문매칭 흐름도 ──────────────────────────────────────────────────

function MatchingFlowSection() {
  const steps = [
    {
      num: 1, label: '파일 업로드', icon: Upload, color: 'border-sky-500/30 bg-sky-500/5',
      iconColor: 'text-sky-400',
      desc: '주문 엑셀 + B2B 양식 파일 업로드\n마켓 선택 후 "불러오기" 클릭하면 저장된 매핑 자동 적용',
      tag: 'Step 1',
    },
    {
      num: 2, label: '컬럼 매핑', icon: Settings2, color: 'border-amber-500/30 bg-amber-500/5',
      iconColor: 'text-amber-400',
      desc: 'B2B 컬럼 ↔ 주문 컬럼 연결\n자동매칭 후 수동 조정 가능\n추가 텍스트 설정 (선택)',
      tag: 'Step 2',
    },
    {
      num: 3, label: '저장', icon: Save, color: 'border-emerald-500/30 bg-emerald-500/5',
      iconColor: 'text-emerald-400',
      desc: '매핑 + B2B파일 통합 저장 (마켓별 분리 저장)\n다음번엔 불러오기 1클릭으로 완료',
      tag: '권장',
    },
    {
      num: 4, label: '결과 다운로드', icon: Download, color: 'border-primary-500/30 bg-primary-500/5',
      iconColor: 'text-primary-400',
      desc: '미리보기 확인 후\nB2B 파일 다운로드',
      tag: 'Step 3',
    },
  ]

  return (
    <SectionWrap title="📋 1:1 주문매칭 작업 흐름">
      <div className="mt-5 space-y-2">
        {steps.map((s, i) => (
          <div key={s.num}>
            <div className={`flex items-start gap-4 p-4 rounded-xl border ${s.color}`}>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-dark-hover dark:bg-dark-hover bg-gray-100 text-xs font-bold text-slate-400">
                  {s.num}
                </div>
                <s.icon size={20} className={s.iconColor} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800">{s.label}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-dark-hover dark:bg-dark-hover bg-gray-100 text-slate-500">{s.tag}</span>
                </div>
                {s.desc.split('\n').map((line, j) => (
                  <p key={j} className="text-xs text-slate-400 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
            {i < steps.length - 1 && <Arrow vertical />}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-primary-500/5 border border-primary-500/20">
        <Repeat size={16} className="text-primary-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-primary-400 mb-0.5">두 번째부터는 훨씬 빠릅니다</p>
          <p className="text-xs text-slate-400">불러오기 → 주문파일 업로드 → 결과 다운로드 — 3단계로 끝!</p>
        </div>
      </div>
    </SectionWrap>
  )
}

// ─── 섹션 4: 일괄매칭 흐름도 ──────────────────────────────────────────────────

function MultiMatchFlowSection() {
  return (
    <SectionWrap title="📦 일괄매칭 작업 흐름">
      <div className="mt-5 space-y-4">

        <div className="rounded-xl border border-dark-border dark:border-dark-border border-gray-200 p-4 space-y-3">

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center flex-1">
              <FileSpreadsheet size={18} className="text-sky-400" />
              <p className="text-xs font-semibold text-sky-300">통합 주문파일</p>
              <p className="text-xs text-slate-500">쿠팡·스마트스토어 등<br/>마켓 선택 후 업로드</p>
            </div>
          </div>

          <Arrow vertical />

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <SplitSquareHorizontal size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">분류 기준 컬럼으로 자동 분리</p>
              <p className="text-xs text-slate-500">등록상품명 / 옵션ID / 업체상품코드 중 선택</p>
            </div>
          </div>

          <Arrow vertical />

          <div className="grid grid-cols-3 gap-2">
            {['거래처 A', '거래처 B', '거래처 C'].map((name, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <Download size={14} className="text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-300">{name}</p>
                <p className="text-xs text-slate-500">B2B파일</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-amber-400">마켓 선택이 중요합니다</p>
          <p className="text-xs text-slate-400">마켓마다 주문 컬럼명이 다르기 때문에, 업로드 전 반드시 해당 마켓을 선택하세요.</p>
          <p className="text-xs text-slate-400">거래처관리에서 마켓별 컬럼 매핑을 저장해두면 선택한 마켓에 맞는 매핑이 자동 적용됩니다.</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">파트너 카드 설정 순서</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: PlusCircle, label: '거래처 추가', color: 'text-primary-400' },
              { icon: FileSpreadsheet, label: 'B2B 양식 선택', color: 'text-sky-400' },
              { icon: GitMerge, label: '매핑 프리셋 선택', color: 'text-amber-400' },
              { icon: CheckCircle2, label: '분류값 지정', color: 'text-emerald-400' },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-dark-border dark:border-dark-border border-gray-200">
                  <item.icon size={13} className={item.color} />
                  <span className="text-xs text-slate-300 dark:text-slate-300 text-gray-700">{item.label}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight size={12} className="text-slate-600 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrap>
  )
}

// ─── 섹션 5: 송장번호 추가 ────────────────────────────────────────────────────

function InvoiceSection() {
  return (
    <SectionWrap title="🚚 송장번호 추가 사용법">
      <div className="mt-5 space-y-4">

        <p className="text-xs text-slate-400">
          거래처(택배사)가 보내준 운송장 파일을 주문 파일과 매칭해 송장번호를 자동으로 채웁니다.
          1:1 주문매칭, 일괄매칭, 자동매칭 각 탭의 "송장번호 추가" 탭에서 사용합니다.
        </p>

        {[
          {
            num: 1, label: '주문 파일 선택',
            desc: '마켓에서 주문받은 원본 엑셀을 업로드하거나 저장된 주문을 선택합니다.',
          },
          {
            num: 2, label: '운송장 파일 업로드',
            desc: '택배번호가 있는 운송장 파일을 업로드합니다.\n거래처 매핑 프리셋이 등록되어 있으면 자동 인식 → 3초 후 자동 실행됩니다.',
          },
          {
            num: 3, label: '매칭 실행',
            desc: '수취인이름 + 전화번호 기준으로 운송장번호를 주문에 자동 매칭합니다.\n동명이인도 전화번호로 구분해 정확하게 매칭됩니다.',
          },
          {
            num: 4, label: '결과 다운로드 / 쿠팡 자동 전송',
            desc: '매칭 완료된 행만 골라서 엑셀 다운로드가 가능합니다. (미매칭 행은 제외)\n쿠팡의 경우 "쿠팡 송장 전송" 버튼으로 API를 통해 판매자센터에 직접 업로드됩니다. (엑셀 저장 불필요)',
          },
        ].map((s, i) => (
          <div key={s.num}>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold shrink-0 mt-0.5">{s.num}</div>
              <div>
                <p className="text-sm font-semibold text-slate-200 mb-0.5">{s.label}</p>
                {s.desc.split('\n').map((line, j) => (
                  <p key={j} className="text-xs text-slate-400 leading-relaxed">{line}</p>
                ))}
              </div>
            </div>
            {i < 3 && <Arrow vertical />}
          </div>
        ))}

        <div className="rounded-xl bg-sky-500/5 border border-sky-500/20 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-sky-400">송장 매칭 프리셋 활용</p>
          <p className="text-xs text-slate-400">거래처관리 → 송장 매칭 프리셋에서 운송장 파일의 컬럼 설정을 저장해두면, 같은 형식의 파일을 올릴 때 자동 인식됩니다.</p>
          <p className="text-xs text-slate-400">프리셋은 마켓별로 분리 저장되므로 마켓이 달라도 올바른 설정이 적용됩니다.</p>
        </div>

        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-amber-400">⚠ 엑셀 파일이 깨져 보일 때</p>
          <p className="text-xs text-slate-400">구형 .xls 파일은 컬럼명이 깨지거나 일부 데이터가 누락될 수 있어요. 업로드 시 경고 배너가 자동으로 표시됩니다.</p>
          <p className="text-xs text-slate-400">엑셀에서 파일을 열고 [다른 이름으로 저장] → "Excel 통합 문서(*.xlsx)" 형식으로 저장 후 다시 업로드해주세요.</p>
        </div>

      </div>
    </SectionWrap>
  )
}

// ─── 섹션 6: 저장/불러오기 흐름 ───────────────────────────────────────────────

function SaveLoadSection() {
  return (
    <SectionWrap title="💾 저장 & 불러오기 구조">
      <div className="mt-5 space-y-4">

        <div>
          <p className="text-xs font-semibold text-emerald-400 mb-2">저장할 때</p>
          <div className="flex items-center gap-2 flex-wrap">
            <FlowStep icon={GitMerge} label="컬럼 매핑 완료" color="border-sky-500/20 bg-sky-500/5 text-sky-400" />
            <Arrow />
            <FlowStep icon={Save} label="저장 클릭" sub="이름 입력" color="border-emerald-500/20 bg-emerald-500/5 text-emerald-400" />
            <Arrow />
            <div className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <p className="text-xs font-semibold text-emerald-400">B2B파일 + 매핑 +</p>
              <p className="text-xs font-semibold text-emerald-400">마켓별 분리 저장</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-amber-400 mb-2">다음번부터</p>
          <div className="flex items-center gap-2 flex-wrap">
            <FlowStep icon={FolderOpen} label="불러오기 클릭" color="border-amber-500/20 bg-amber-500/5 text-amber-400" />
            <Arrow />
            <FlowStep icon={CheckCircle2} label="1클릭 적용" sub="파일+매핑 자동로드" color="border-emerald-500/20 bg-emerald-500/5 text-emerald-400" />
            <Arrow />
            <FlowStep icon={Download} label="바로 다운로드" color="border-primary-500/20 bg-primary-500/5 text-primary-400" />
          </div>
        </div>

        <div className="rounded-xl bg-dark-hover/50 border border-dark-border p-4">
          <p className="text-xs font-semibold text-slate-300 mb-1">저장 데이터는 어디에?</p>
          <p className="text-xs text-slate-400">모든 설정은 사용자 컴퓨터(%AppData%\딸기셀)에 저장됩니다. 용량 제한 없이 최대 100개까지 저장됩니다.</p>
          <p className="text-xs text-slate-500 mt-1">설정 → 저장 데이터 관리에서 개수 확인 및 전체 삭제가 가능합니다.</p>
        </div>

        <div className="rounded-xl bg-dark-hover/50 dark:bg-dark-hover/50 bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 p-4">
          <p className="text-xs font-semibold text-slate-300 dark:text-slate-300 text-gray-700 mb-3">마켓 × 거래처별 저장 예시</p>
          <div className="grid grid-cols-3 gap-2">
            {['쿠팡_딸기셀', '쿠팡_수박셀', '쿠팡_참외셀', '스마트스토어_감자셀', '11번가_사과셀', '자사몰_망고셀'].map((name) => (
              <div key={name} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-dark-card dark:bg-dark-card bg-white border border-dark-border dark:border-dark-border border-gray-200">
                <Save size={11} className="text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-400">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrap>
  )
}

// ─── 섹션 7: 사업자 관리 ──────────────────────────────────────────────────────

function BusinessSection() {
  return (
    <SectionWrap title="🏢 사업자 관리">
      <div className="mt-5 space-y-4">
        <p className="text-xs text-slate-400">쿠팡·스마트스토어 등 마켓 API 자동매칭을 사용하려면 사업자를 먼저 등록해야 합니다.</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">등록 순서</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: Building2, label: '사업자 추가', color: 'text-primary-400', sub: '이름 입력' },
              { icon: Key, label: 'API 키 입력', color: 'text-amber-400', sub: '액세스·시크릿 키' },
              { icon: CheckCircle2, label: '연결 테스트', color: 'text-sky-400', sub: '연동 확인' },
              { icon: Zap, label: '자동매칭 활성화', color: 'text-emerald-400', sub: '"사용가능" 표시' },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-dark-border bg-dark-hover text-center min-w-[90px]">
                  <item.icon size={16} className={item.color} />
                  <p className="text-xs font-semibold text-slate-300">{item.label}</p>
                  <p className="text-[10px] text-slate-500">{item.sub}</p>
                </div>
                {i < arr.length - 1 && <ArrowRight size={14} className="text-slate-600 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-400">쿠팡 API 키 발급 안내</p>
          <p className="text-xs text-slate-400">쿠팡 Wing → 판매자 정보 → Open API 신청에서 액세스 키와 시크릿 키를 발급받으세요.</p>
          <p className="text-xs text-slate-400">승인까지 보통 1영업일 소요됩니다. 승인 후 연결 테스트가 성공하면 자동매칭 탭에서 "사용가능"으로 표시됩니다.</p>
        </div>

      </div>
    </SectionWrap>
  )
}

// ─── 섹션 8: 텍스트 설명 ──────────────────────────────────────────────────────

const TEXT_SECTIONS = [
  {
    id: 'intro',
    title: '시작하기 전에',
    color: 'text-primary-400 bg-primary-500/10',
    items: [
      {
        q: '처음 사용할 때 무엇부터 해야 하나요?',
        a: '① 거래처 B2B 관리에서 거래처를 추가하고 B2B 양식 파일을 등록합니다.\n② 마켓 탭을 선택해 해당 마켓의 주문 컬럼 매핑을 저장합니다.\n③ 이후 주문 처리 시 저장된 매핑이 자동 적용됩니다.',
      },
      {
        q: '1:1 주문매칭과 일괄매칭의 차이는?',
        a: '1:1 주문매칭은 하나의 거래처 B2B 양식에 주문 데이터를 채워 넣는 기능입니다.\n일괄매칭은 여러 거래처가 섞인 주문 파일을 거래처별로 분류해 각각의 B2B 파일로 출력하는 기능입니다.',
      },
    ],
  },
  {
    id: 'market-mapping',
    title: '마켓별 컬럼 매핑',
    color: 'text-sky-400 bg-sky-500/10',
    items: [
      {
        q: '마켓별로 매핑을 따로 저장해야 하나요?',
        a: '네, 쿠팡·스마트스토어·11번가 등 마켓마다 주문 엑셀의 컬럼명이 다릅니다.\n거래처 B2B 관리에서 각 거래처 편집 시 상단 마켓 탭을 선택해 마켓별로 한 번씩 매핑을 저장해주세요.\n일괄매칭·자동매칭에서 마켓을 선택하면 해당 마켓의 매핑이 자동으로 적용됩니다.',
      },
      {
        q: '불러오기에서 "매핑 없음"이 표시되면?',
        a: '선택한 마켓에 대한 컬럼 매핑이 저장되지 않은 상태입니다.\n거래처 B2B 관리 → 거래처 편집 → 해당 마켓 탭에서 컬럼 매핑 후 저장해주세요.',
      },
    ],
  },
  {
    id: 'save',
    title: '저장 & 불러오기',
    color: 'text-amber-400 bg-amber-500/10',
    items: [
      {
        q: '저장된 데이터는 앱을 껐다 켜도 유지되나요?',
        a: '네, 모든 저장 데이터는 사용자 컴퓨터(%AppData%\딸기셀)에 영구 저장됩니다.\n앱을 재시작해도 그대로 유지됩니다.',
      },
      {
        q: '저장 개수 제한이 있나요?',
        a: '저장된 주문은 최대 100개까지 저장됩니다.\n100개 초과 시 새 저장 시 전체 초기화 후 새 항목 1개만 남습니다.\n설정 → 저장 데이터 관리에서 직접 삭제할 수 있습니다.',
      },
    ],
  },
  {
    id: 'append',
    title: '추가 텍스트 기능',
    color: 'text-rose-400 bg-rose-500/10',
    items: [
      {
        q: '추가 텍스트란 무엇인가요?',
        a: '주문 데이터에 고정 텍스트를 덧붙여 출력하는 기능입니다.\n예) 업체주소 컬럼에 " 3층" 설정 시\n출력: "서울시 강남구 테헤란로 123" + " 3층" = "서울시 강남구 테헤란로 123 3층"',
      },
      {
        q: '어떻게 설정하나요?',
        a: '컬럼 매핑 화면에서 각 B2B 컬럼 오른쪽의 "추가" 버튼을 클릭하면 입력창이 열립니다.\n입력한 텍스트는 매핑 저장 시 함께 저장됩니다.',
      },
    ],
  },
  {
    id: 'trouble',
    title: '파일 깨짐 / 미매칭 문제',
    color: 'text-amber-400 bg-amber-500/10',
    items: [
      {
        q: '컬럼명에 이상한 문자가 나오고 미매칭이 많이 나와요',
        a: '구형 .xls 파일이 깨진 경우일 가능성이 높습니다. 업로드 시 상단에 경고 배너가 자동 표시됩니다.\n해결: 엑셀에서 파일을 연 뒤 [다른 이름으로 저장] → "Excel 통합 문서(*.xlsx)" 선택 후 저장 → 다시 업로드해주세요.',
      },
      {
        q: '쿠팡 송장 전송 중 일부만 실패하면 어떻게 하나요?',
        a: '실패한 건만 다시 시도할 수 있습니다. 엑셀을 수정(취소 건 제외)해서 재업로드하거나, 남은 주문은 다음날 추가 매칭 후 전송해도 됩니다.\n쿠팡 API는 이미 전송된 송장을 중복 업데이트해도 안전하게 처리합니다.',
      },
    ],
  },
]

function TextGuideSection() {
  return (
    <SectionWrap title="📝 상세 텍스트 설명">
      <div className="mt-4 space-y-4">
        {TEXT_SECTIONS.map((sec) => (
          <div key={sec.id} className="rounded-xl border border-dark-border dark:border-dark-border border-gray-200 overflow-hidden">
            <div className={`px-4 py-2.5 flex items-center gap-2 ${sec.color} bg-opacity-10`}>
              <p className="text-xs font-bold">{sec.title}</p>
            </div>
            <div className="px-4 py-3 space-y-4">
              {sec.items.map(({ q, a }) => (
                <div key={q}>
                  <p className="text-sm font-medium text-slate-200 dark:text-slate-200 text-gray-800 mb-1.5 flex items-start gap-2">
                    <span className="text-primary-400 font-bold shrink-0">Q.</span>{q}
                  </p>
                  <div className="pl-5 border-l-2 border-dark-border dark:border-dark-border border-gray-200 space-y-0.5">
                    {a.split('\n').map((line, i) => (
                      <p key={i} className="text-sm text-slate-400 dark:text-slate-400 text-gray-600 leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionWrap>
  )
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

export function HelpPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5 animate-fade-in">

        <div>
          <h1 className="text-xl font-bold text-slate-100 dark:text-slate-100 text-gray-900">이용 매뉴얼</h1>
          <p className="text-sm text-slate-400 mt-1">딸기셀 주문매칭 시스템 사용 가이드</p>
        </div>

        <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-fade-in">
          <span className="text-red-400 font-bold text-lg shrink-0">★</span>
          <div>
            <p className="text-sm font-bold text-red-400">처음 이용 시 가장 먼저 할 일!</p>
            <p className="text-sm text-red-300/90 mt-1 leading-relaxed">
              거래처 B2B 관리에서 거래처를 추가하고, 마켓별 컬럼 매핑을 저장해주세요.
              한 번만 설정하면 이후 모든 탭에서 자동 적용됩니다.
            </p>
          </div>
        </div>

        <FullFlowSection />
        <B2bSection />
        <BusinessSection />
        <AutoMatchSection />
        <MatchingFlowSection />
        <MultiMatchFlowSection />
        <InvoiceSection />
        <SaveLoadSection />
        <TextGuideSection />

        <p className="text-xs text-slate-600 text-center pb-4">기능이 추가될 때마다 매뉴얼도 업데이트됩니다.</p>
      </div>
    </div>
  )
}
