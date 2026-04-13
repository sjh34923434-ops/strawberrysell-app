import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Upload, ArrowRight, ArrowDown,
  GitMerge, Layers, Save, Download, Settings2,
  FileSpreadsheet, CheckCircle2, SplitSquareHorizontal,
  PlusCircle, FolderOpen, Repeat, Truck, Package,
  Building2, ShoppingCart, Key, RefreshCw,
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
  const [open, setOpen] = useState(true)
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
      <div className="mt-5 space-y-3">
        <div className="flex flex-col gap-2">

          {/* 1단계 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-500/20 text-sky-300 text-sm font-bold shrink-0">1</div>
            <div className="flex-1">
              <p className="text-base font-semibold text-sky-300">주문 접수</p>
              <p className="text-sm text-slate-400 mt-0.5">마켓(쿠팡·11번가 등)에서 주문 엑셀 다운로드</p>
            </div>
            <FileSpreadsheet size={16} className="text-sky-400 shrink-0" />
          </div>

          <Arrow vertical />

          {/* 2단계 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold shrink-0">2</div>
            <div className="flex-1">
              <p className="text-base font-semibold text-violet-300">일괄매칭 <span className="text-sm font-normal text-slate-500">— 거래처가 여럿일 때</span></p>
              <p className="text-sm text-slate-400 mt-0.5">주문파일 1개 → 거래처별 B2B 파일 N개로 분류</p>
            </div>
            <Layers size={16} className="text-violet-400 shrink-0" />
          </div>

          <div className="flex items-center gap-2 pl-4">
            <div className="w-px h-4 bg-slate-600" />
            <p className="text-sm text-slate-500">거래처가 1곳이면 주문매칭(3단계)으로 바로 이동</p>
          </div>

          {/* 3단계 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-500/20 text-primary-300 text-sm font-bold shrink-0">3</div>
            <div className="flex-1">
              <p className="text-base font-semibold text-primary-300">주문매칭 → B2B 입력</p>
              <p className="text-sm text-slate-400 mt-0.5">B2B 양식에 주문 데이터 채워서 다운로드 → 거래처에 전송</p>
            </div>
            <GitMerge size={16} className="text-primary-400 shrink-0" />
          </div>

          <Arrow vertical />

          {/* 4단계 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-500/20 text-slate-300 text-sm font-bold shrink-0">4</div>
            <div className="flex-1">
              <p className="text-base font-semibold text-slate-300">거래처 출고 처리</p>
              <p className="text-sm text-slate-400 mt-0.5">거래처가 B2B 파일 받아 출고 → 송장번호 입력 후 파일 회신 (1~3일 소요)</p>
            </div>
            <Package size={16} className="text-slate-400 shrink-0" />
          </div>

          <Arrow vertical />

          {/* 5단계 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 text-sm font-bold shrink-0">5</div>
            <div className="flex-1">
              <p className="text-base font-semibold text-amber-300">송장번호 입력 탭</p>
              <p className="text-sm text-slate-400 mt-0.5">송장번호 담긴 B2B 파일 → 마켓 송장 업로드 양식으로 변환</p>
            </div>
            <Truck size={16} className="text-amber-400 shrink-0" />
          </div>

          <Arrow vertical />

          {/* 6단계 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-bold shrink-0">6</div>
            <div className="flex-1">
              <p className="text-base font-semibold text-emerald-300">마켓 송장 업로드 완료</p>
              <p className="text-sm text-slate-400 mt-0.5">생성된 파일을 마켓 판매자센터에 업로드 → 배송 처리 완료</p>
            </div>
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          </div>

        </div>
      </div>
    </SectionWrap>
  )
}

// ─── 섹션 1: 두 기능 비교 ──────────────────────────────────────────────────────

function CompareSection() {
  return (
    <SectionWrap title="📊 주문매칭 탭 구성 — 한눈에 비교">
      <div className="mt-5 grid grid-cols-2 gap-4">

        {/* 주문→B2B 탭 */}
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-sky-400" />
            <p className="text-sm font-bold text-sky-400">주문 → B2B 입력 탭</p>
          </div>
          <p className="text-xs text-slate-400">주문을 거래처 B2B 양식으로 변환</p>
          {/* 흐름도 */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-sky-500/20 text-sm text-center">
              <FileSpreadsheet size={16} className="text-sky-400" />
              <span className="text-slate-300 dark:text-slate-300 text-gray-700">주문파일</span>
              <span className="text-xs text-slate-500">1개</span>
            </div>
            <span className="text-slate-500">+</span>
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-sky-500/20 text-sm text-center">
              <FileSpreadsheet size={16} className="text-emerald-400" />
              <span className="text-slate-300 dark:text-slate-300 text-gray-700">B2B양식</span>
              <span className="text-xs text-slate-500">1개</span>
            </div>
            <ArrowRight size={14} className="text-slate-500" />
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-center">
              <Download size={16} className="text-emerald-400" />
              <span className="text-emerald-300">완성파일</span>
              <span className="text-xs text-slate-500">1개</span>
            </div>
          </div>
        </div>

        {/* 송장번호 입력 탭 */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-amber-400" />
            <p className="text-sm font-bold text-amber-400">송장번호 입력 탭</p>
          </div>
          <p className="text-xs text-slate-400">송장번호를 마켓 업로드 양식으로 변환</p>
          {/* 흐름도 */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-amber-500/20 text-sm text-center">
              <Truck size={16} className="text-amber-400" />
              <span className="text-slate-300 dark:text-slate-300 text-gray-700">B2B파일</span>
              <span className="text-xs text-slate-500">송장포함</span>
            </div>
            <span className="text-slate-500">+</span>
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-amber-500/20 text-sm text-center">
              <FileSpreadsheet size={16} className="text-sky-400" />
              <span className="text-slate-300 dark:text-slate-300 text-gray-700">마켓양식</span>
              <span className="text-xs text-slate-500">쿠팡 등</span>
            </div>
            <ArrowRight size={14} className="text-slate-500" />
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-center">
              <Download size={16} className="text-emerald-400" />
              <span className="text-emerald-300">업로드파일</span>
              <span className="text-xs text-slate-500">1개</span>
            </div>
          </div>
        </div>
      </div>
    </SectionWrap>
  )
}

// ─── 섹션 2: 주문매칭 흐름도 ──────────────────────────────────────────────────

function MatchingFlowSection() {
  const steps = [
    {
      num: 1, label: '파일 업로드', icon: Upload, color: 'border-sky-500/30 bg-sky-500/5',
      iconColor: 'text-sky-400',
      desc: '주문 엑셀 + B2B 양식 파일 업로드\n저장된 매핑 있으면 "불러오기" 클릭',
      tag: 'Step 1',
    },
    {
      num: 2, label: '컬럼 매핑', icon: Settings2, color: 'border-amber-500/30 bg-amber-500/5',
      iconColor: 'text-amber-400',
      desc: 'B2B 컬럼 ↔ 주문 컬럼 연결\n자동매칭 후 수동 조정\n추가 텍스트 설정 (선택)',
      tag: 'Step 2',
    },
    {
      num: 3, label: '저장', icon: Save, color: 'border-emerald-500/30 bg-emerald-500/5',
      iconColor: 'text-emerald-400',
      desc: '매핑 + B2B파일 통합 저장\n다음번엔 불러오기 1클릭으로 완료',
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
    <SectionWrap title="📋 주문매칭 작업 흐름">
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

      {/* 재사용 팁 */}
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

// ─── 섹션 3: 일괄매칭 흐름도 ──────────────────────────────────────────────────

function MultiMatchFlowSection() {
  return (
    <SectionWrap title="📦 일괄매칭 작업 흐름">
      <div className="mt-5 space-y-4">

        {/* 흐름 다이어그램 */}
        <div className="rounded-xl border border-dark-border dark:border-dark-border border-gray-200 p-4 space-y-3">

          {/* 입력 */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center flex-1">
              <FileSpreadsheet size={18} className="text-sky-400" />
              <p className="text-xs font-semibold text-sky-300">통합 주문파일</p>
              <p className="text-xs text-slate-500">쿠팡+네이버+자사몰 등<br/>모두 한 파일에</p>
            </div>
          </div>

          <Arrow vertical />

          {/* 분류 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <SplitSquareHorizontal size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">분류 기준 컬럼으로 자동 분리</p>
              <p className="text-xs text-slate-500">등록상품명 / 옵션ID / 업체상품코드 중 선택</p>
            </div>
          </div>

          <Arrow vertical />

          {/* 파트너별 출력 */}
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

        {/* 파트너 설정 안내 */}
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

// ─── 섹션 4: 저장/불러오기 흐름 ───────────────────────────────────────────────

function SaveLoadSection() {
  return (
    <SectionWrap title="💾 저장 & 불러오기 구조">
      <div className="mt-5 space-y-4">

        {/* 저장 흐름 */}
        <div>
          <p className="text-xs font-semibold text-emerald-400 mb-2">저장할 때</p>
          <div className="flex items-center gap-2 flex-wrap">
            <FlowStep icon={GitMerge} label="컬럼 매핑 완료" color="border-sky-500/20 bg-sky-500/5 text-sky-400" />
            <Arrow />
            <FlowStep icon={Save} label="저장 클릭" sub="이름 입력" color="border-emerald-500/20 bg-emerald-500/5 text-emerald-400" />
            <Arrow />
            <div className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <p className="text-xs font-semibold text-emerald-400">B2B파일 + 매핑 +</p>
              <p className="text-xs font-semibold text-emerald-400">추가텍스트 통합저장</p>
            </div>
          </div>
        </div>

        {/* 불러오기 흐름 */}
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

        {/* 마켓별 저장 권장 */}
        <div className="rounded-xl bg-dark-hover/50 dark:bg-dark-hover/50 bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 p-4">
          <p className="text-xs font-semibold text-slate-300 dark:text-slate-300 text-gray-700 mb-3">마켓 × 거래처별 저장 예시</p>
          <div className="grid grid-cols-3 gap-2">
            {['쿠팡_딸기셀', '쿠팡_수박셀', '쿠팡_참외셀', '11번가_감자셀', '네이버_사과셀', '자사몰_망고셀'].map((name) => (
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

// ─── 섹션 5: 텍스트 설명 ──────────────────────────────────────────────────────

const TEXT_SECTIONS = [
  {
    id: 'intro',
    title: '시작하기 전에',
    color: 'text-primary-400 bg-primary-500/10',
    items: [
      {
        q: '주문매칭과 일괄매칭의 차이는?',
        a: '주문매칭은 하나의 거래처 B2B 양식에 주문 데이터를 채워 넣는 기능입니다.\n일괄매칭은 여러 거래처가 섞인 주문 파일을 거래처별로 분류해 각각의 B2B 파일로 출력하는 기능입니다.',
      },
      {
        q: '처음 사용할 때 무엇부터 해야 하나요?',
        a: '① 주문 엑셀 파일과 거래처 B2B 양식 파일을 준비합니다.\n② 주문매칭 메뉴에서 두 파일을 업로드합니다.\n③ 컬럼 매핑 화면에서 B2B 컬럼과 주문 컬럼을 연결합니다.\n④ 저장 버튼으로 매핑을 저장해 둡니다.\n⑤ 다음부터는 불러오기로 1클릭 적용.',
      },
    ],
  },
  {
    id: 'matching',
    title: '주문매칭 사용법',
    color: 'text-sky-400 bg-sky-500/10',
    items: [
      {
        q: 'Step 1 — 파일 업로드',
        a: '왼쪽에 주문 엑셀 파일, 오른쪽에 거래처 B2B 양식 파일을 업로드합니다.\n이전에 저장한 매핑이 있으면 "불러오기" 버튼으로 B2B 파일과 매핑을 한 번에 불러올 수 있습니다.',
      },
      {
        q: 'Step 2 — 컬럼 매핑',
        a: 'B2B 양식의 각 컬럼에 주문 파일의 어느 컬럼을 채워 넣을지 연결합니다.\n"자동 매칭" 버튼으로 비슷한 이름을 자동으로 연결할 수 있습니다.\n추가 텍스트 기능으로 주문 데이터 뒤에 고정 텍스트를 덧붙일 수 있습니다. (예: 주소 + " 3층")',
      },
      {
        q: '컬럼 매핑 저장은 어떻게 하나요?',
        a: 'Step 2 상단의 "저장" 버튼을 클릭해 이름을 입력하면 저장됩니다.\nB2B 파일도 함께 저장되어 다음번에 불러오기 한 번으로 파일+매핑이 모두 적용됩니다.\n이미 불러온 매핑을 수정했다면 "기존 덮어쓰기"로 업데이트할 수 있습니다.',
      },
      {
        q: 'Step 3 — 결과 확인 및 다운로드',
        a: '매핑이 완료된 데이터를 미리보기로 확인하고 엑셀 파일로 다운로드합니다.\n검색 기능으로 특정 데이터를 빠르게 찾을 수 있습니다.',
      },
    ],
  },
  {
    id: 'multi',
    title: '일괄매칭 사용법',
    color: 'text-emerald-400 bg-emerald-500/10',
    items: [
      {
        q: 'Step 1 — 주문 파일 업로드 및 분류 기준 선택',
        a: '여러 거래처 주문이 합쳐진 파일을 업로드합니다.\n분류 기준 컬럼을 선택합니다. 등록상품명, 옵션ID, 업체상품코드 등을 추천합니다.',
      },
      {
        q: 'Step 2 — 파트너 설정',
        a: '거래처별로 카드를 추가하고 각각 B2B 양식과 매핑 프리셋을 선택합니다.\n분류 값 선택에서 어떤 주문이 해당 거래처로 분류될지 지정합니다.\n설정을 저장해두면 다음번에 불러오기로 바로 사용할 수 있습니다.',
      },
      {
        q: 'Step 3 — 결과 다운로드',
        a: '거래처별로 분리된 파일을 각각 또는 전체를 한 번에 다운로드할 수 있습니다.',
      },
    ],
  },
  {
    id: 'save',
    title: '저장 & 불러오기',
    color: 'text-amber-400 bg-amber-500/10',
    items: [
      {
        q: '마켓별로 매핑을 따로 저장해야 하나요?',
        a: '네, 쿠팡·11번가·네이버 등 마켓마다 주문 엑셀의 컬럼명이 다릅니다.\n각 마켓 × 거래처 조합으로 처음 한 번씩 매핑하고 저장해두세요.\n예) "쿠팡_딸기셀", "쿠팡_수박셀", "11번가_사과셀"',
      },
      {
        q: '저장된 데이터는 앱을 껐다 켜도 유지되나요?',
        a: '네, 모든 저장 데이터는 로컬에 자동 저장됩니다.\n앱을 재시작해도 그대로 유지됩니다.\n단, 앱을 재설치하면 초기화될 수 있으니 중요한 매핑은 이름을 명확하게 저장해 두세요.',
      },
    ],
  },
  {
    id: 'invoice',
    title: '송장번호 입력 사용법',
    color: 'text-amber-400 bg-amber-500/10',
    items: [
      {
        q: '언제 사용하나요?',
        a: '거래처에서 송장번호가 담긴 B2B 파일을 회신받은 후, 그 데이터를 마켓(쿠팡·11번가 등) 송장 업로드 양식으로 변환할 때 사용합니다.\n주문매칭 페이지 상단의 "송장번호 입력" 탭을 클릭하면 전환됩니다.',
      },
      {
        q: '어떻게 사용하나요?',
        a: '① 위 칸에 거래처에서 받은 B2B 파일(송장번호 포함)을 업로드합니다.\n② 아래 칸에 마켓 송장 업로드 양식을 업로드합니다.\n③ 컬럼 매핑에서 주문번호·송장번호 등을 연결합니다.\n④ 마켓 파일 생성 → 다운로드 → 마켓 판매자센터에 업로드합니다.',
      },
      {
        q: '거래처가 여러 곳이면 어떻게 하나요?',
        a: '거래처마다 B2B 파일이 따로 오기 때문에 하나씩 처리합니다.\n처음 한 번 매핑을 저장해두면 다음부터는 불러오기 → 파일만 교체 → 다운로드로 빠르게 처리됩니다.',
      },
      {
        q: '파일명 날짜가 달라도 되나요?',
        a: '네, 문제없습니다. 송장번호는 출고 후 배송사에서 발번되므로 1~3일 차이가 나는 게 정상입니다.\n마켓 업로드 시 파일명의 날짜가 아닌 파일 내부 데이터를 읽기 때문에 날짜가 달라도 업로드됩니다.',
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
        a: '주문 데이터에 고정 텍스트를 덧붙여 출력하는 기능입니다.\n예) 업체주소 컬럼에 추가 텍스트 " 3층" 설정 시\n출력: "서울시 강남구 테헤란로 123" + " 3층" = "서울시 강남구 테헤란로 123 3층"',
      },
      {
        q: '어떻게 설정하나요?',
        a: '컬럼 매핑 화면에서 각 B2B 컬럼 오른쪽의 "추가" 버튼을 클릭하면 입력창이 열립니다.\n입력한 텍스트는 매핑 저장 시 함께 저장됩니다.',
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

// ─── 섹션 6: 사업자 관리 ──────────────────────────────────────────────────────

function BusinessSection() {
  return (
    <SectionWrap title="🏢 사업자 관리">
      <div className="mt-5 space-y-4">
        <p className="text-xs text-slate-400">쿠팡·스마트스토어 등 마켓 API 연동을 위해 사업자를 먼저 등록해야 합니다.</p>

        {/* 등록 순서 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">등록 순서</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: Building2, label: '사업자 추가', color: 'text-primary-400', sub: '이름 입력' },
              { icon: Key, label: 'API 키 입력', color: 'text-amber-400', sub: '액세스·시크릿 키' },
              { icon: CheckCircle2, label: '연동 완료', color: 'text-emerald-400', sub: '쿠팡 자동매칭 사용 가능' },
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

        {/* 안내 */}
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-400">쿠팡 API 키 발급 안내</p>
          <p className="text-xs text-slate-400">쿠팡 Wing → 판매자 정보 → Open API 신청에서 액세스 키와 시크릿 키를 발급받으세요.</p>
          <p className="text-xs text-slate-400">승인까지 보통 1영업일 소요됩니다. 승인 후 쿠팡 자동매칭 기능이 활성화됩니다.</p>
        </div>

        {/* 마켓별 지원 현황 */}
        <div className="rounded-xl border border-dark-border bg-dark-hover/30 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-3">마켓별 API 연동 현황</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: '쿠팡', status: '연동 지원', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { name: '스마트스토어', status: '준비 중', color: 'text-slate-500 bg-dark-hover border-dark-border' },
              { name: '11번가', status: '준비 중', color: 'text-slate-500 bg-dark-hover border-dark-border' },
              { name: '옥션/지마켓', status: '준비 중', color: 'text-slate-500 bg-dark-hover border-dark-border' },
            ].map(m => (
              <div key={m.name} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${m.color}`}>
                <span className="font-medium text-slate-300">{m.name}</span>
                <span>{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionWrap>
  )
}

// ─── 섹션 7: 쿠팡 자동매칭 ────────────────────────────────────────────────────

function CoupangAutoSection() {
  return (
    <SectionWrap title="🛒 쿠팡 자동매칭">
      <div className="mt-5 space-y-4">

        <p className="text-xs text-slate-400">
          쿠팡 API로 주문을 직접 가져와 거래처별로 자동 분류·출력하는 기능입니다.
          주문 엑셀을 수동으로 다운로드할 필요 없이 API로 바로 가져옵니다.
        </p>

        {/* 3단계 흐름 */}
        <div className="space-y-2">
          {[
            {
              num: 1, label: '주문 가져오기', icon: RefreshCw, color: 'border-orange-500/30 bg-orange-500/5',
              iconColor: 'text-orange-400',
              desc: '사업자 선택 → 주문 상태 필터 선택 → 주문 가져오기 클릭\n가져온 주문 건수 확인 후 다음 단계로 이동',
            },
            {
              num: 2, label: '파트너 설정 (컬럼 매핑)', icon: Settings2, color: 'border-amber-500/30 bg-amber-500/5',
              iconColor: 'text-amber-400',
              desc: 'B2B 양식 파일 업로드 → 쿠팡 주문 컬럼 ↔ B2B 컬럼 매핑\n자동 매핑 버튼으로 빠르게 연결, 저장해두면 다음번엔 1클릭',
            },
            {
              num: 3, label: '결과 다운로드', icon: Download, color: 'border-emerald-500/30 bg-emerald-500/5',
              iconColor: 'text-emerald-400',
              desc: '거래처별 B2B 파일 개별 다운로드 또는 전체 ZIP 한번에 다운로드\n미매칭 주문 별도 확인 가능',
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

        {/* 사전 조건 */}
        <div className="rounded-xl bg-primary-500/5 border border-primary-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-primary-400">사용 전 필수 조건</p>
          <div className="space-y-1">
            {[
              '사업자 관리에서 쿠팡 사업자 등록 및 API 키 입력',
              '쿠팡 Wing에서 Open API 승인 완료 (1영업일)',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 size={11} className="text-primary-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* 주문 상태 안내 */}
        <div className="rounded-xl border border-dark-border bg-dark-hover/30 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-3">주문 상태 필터</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '전체', desc: '모든 주문' },
              { label: '결제완료', desc: 'ACCEPT' },
              { label: '상품준비중', desc: 'INSTRUCT' },
              { label: '배송준비중', desc: 'DEPARTURE' },
              { label: '배송중', desc: 'DELIVERING' },
            ].map(s => (
              <div key={s.label} className="px-2.5 py-1.5 rounded-lg bg-dark-card border border-dark-border text-center">
                <p className="text-xs font-medium text-slate-300">{s.label}</p>
                <p className="text-[10px] text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

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

        {/* 처음 이용 안내 */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-fade-in">
          <span className="text-red-400 font-bold text-lg shrink-0">★</span>
          <div>
            <p className="text-sm font-bold text-red-400">처음 이용 시 가장 먼저 할 일!!</p>
            <p className="text-sm text-red-300/90 mt-1 leading-relaxed">
              주문 매칭 탭에서 사용할 엑셀파일을 업로드 후 각 마켓에 맞게 컬럼 매핑을 적용하고 저장해 주세요!
            </p>
          </div>
        </div>

        <FullFlowSection />
        <BusinessSection />
        <CoupangAutoSection />
        <CompareSection />
        <MatchingFlowSection />
        <MultiMatchFlowSection />
        <SaveLoadSection />
        <TextGuideSection />

        <p className="text-xs text-slate-600 text-center pb-4">기능이 추가될 때마다 매뉴얼도 업데이트됩니다.</p>
      </div>
    </div>
  )
}
