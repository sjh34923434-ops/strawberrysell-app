# CLAUDE.md - 주문매칭 프로그램 프로젝트 규칙

## 프로젝트 개요
- 이름: 주문매칭 (OrderMatching)
- 목적: 주문 엑셀 ↔ B2B 엑셀 자동 매칭 후 결과 다운로드
- 형태: 데스크탑 설치형 (Windows .exe / Mac .dmg, 판매 배포용)
- 언어: TypeScript
- 기술스택: Electron + React + Tailwind CSS + Zustand + Axios + SheetJS(xlsx)

## 핵심 원칙
1. 전문가급 사용자를 위한 고급 UI/UX (프리미엄 SaaS 수준)
2. 판매용 → 앱 실행 시 로그인 화면 먼저 표시
3. 에러 발생 시 구체적인 한국어 메시지 + 상세 로그
4. 모든 엑셀 처리는 로컬에서만 실행 (보안)
5. 컴포넌트 단위 확장 가능한 모듈형 구조 유지
6. 모든 문자열은 한국어

## UI/UX 기준
- 디자인: 다크/라이트 테마 지원, 프리미엄 모노크롬 + 포인트 컬러 (딥네이비 or 차콜)
- 레이아웃: 사이드바 네비게이션 + 메인 컨텐츠 영역 분리
- 애니메이션: 페이지 전환 페이드, 버튼 호버 트랜지션, 로딩 스켈레톤
- 컴포넌트: shadcn/ui 스타일 기준, 커스텀 디자인 시스템 적용
- 테이블: 가상 스크롤 (대용량 데이터 대응), 컬럼 정렬·필터·고정 지원
- 반응형: 창 크기 조절 시 레이아웃 자동 대응

## 주요 기능
- 로그인 (이메일 + 비밀번호, JWT 인증, 자동 로그인)
- 라이선스 키 등록 (기기 1대 잠금, 만료일 표시)
- 주문 엑셀 + B2B 엑셀 업로드 (드래그앤드롭)
- 기준 컬럼 선택 → 자동 매칭 + 마지막 설정 저장
- 결과 테이블 (매칭성공 / 주문만있음 / B2B만있음, 색상 구분)
- 결과 엑셀 다운로드 (시트 분리, 커스텀 파일명)
- 자동 업데이트 (electron-updater)

## 확장·개선 구조 원칙
- 새 매칭 규칙 추가 시 matcher.ts 플러그인 방식으로 확장
- 새 파일 포맷 추가 시 excelReader.ts 어댑터 패턴으로 확장
- API 엔드포인트 추가 시 server/routes/ 에 독립 파일로 추가
- UI 컴포넌트는 pages/ 에서 components/ 를 조합하는 구조 유지
- 기능 플래그(Feature Flag) 방식으로 베타 기능 on/off 가능하게 설계

## 파일 구조
- CLAUDE.md
- electron/ → main.ts, preload.ts, updater.ts
- src/pages/ → LoginPage, DashboardPage, MatchingPage, SettingsPage
- src/components/ → FileUploader, ColumnMapper, MatchingPreview, DownloadButton, Sidebar, ThemeToggle
- src/stores/ → authStore.ts, licenseStore.ts, settingsStore.ts
- src/utils/ → excelReader.ts, matcher.ts, excelWriter.ts, featureFlags.ts
- src/api/ → client.ts
- src/design-system/ → tokens.ts, components/
- server/ → Express + PostgreSQL (인증 & 라이선스 API)

## 인증 구조
- 서버: Express + PostgreSQL + JWT (Access 1시간 + Refresh 30일)
- 앱 시작 시 electron-store 토큰 확인 → 유효하면 자동 로그인
- 라이선스: UUID 키 + MAC 주소 기기 잠금 + 만료일 관리

이 파일은 Claude가 **매번 읽는 프로젝트 DNA**입니다.
