/**
 * Feature Flag 방식으로 베타 기능 on/off 관리
 * 새 기능 추가 시 이 객체에만 항목 추가
 */
export const featureFlags = {
  MULTI_SHEET_MATCHING:  false,  // 복수 시트 동시 매칭 (베타)
  FUZZY_MATCHING:        false,  // 유사도 기반 퍼지 매칭 (베타)
  AUTO_UPDATE_ENABLED:   true,   // 자동 업데이트
  LICENSE_REQUIRED:      true,   // 라이선스 검증 필수 여부
  DARK_MODE_DEFAULT:     true,   // 기본 다크모드
  EXPORT_CSV:            false,  // CSV 내보내기 (베타)
} as const

export type FeatureFlag = keyof typeof featureFlags

export function isEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
