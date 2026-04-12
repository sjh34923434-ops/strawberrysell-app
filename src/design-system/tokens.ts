export const tokens = {
  colors: {
    primary:      '#6366F1',
    primaryHover: '#4F46E5',
    primaryLight: '#EEF2FF',

    success:      '#10B981',
    successLight: '#D1FAE5',
    successDark:  '#065F46',

    warning:      '#F59E0B',
    warningLight: '#FEF3C7',
    warningDark:  '#92400E',

    error:        '#EF4444',
    errorLight:   '#FEE2E2',
    errorDark:    '#991B1B',

    dark: {
      bg:      '#0A0F1E',
      surface: '#0F1629',
      card:    '#141929',
      hover:   '#1A2236',
      border:  '#1E2A45',
      text:    '#F1F5F9',
      muted:   '#64748B',
      subtle:  '#94A3B8',
    },

    light: {
      bg:      '#FFF0F2',
      surface: '#FFF5F6',
      card:    '#FFFFFF',
      hover:   '#FFE4E6',
      border:  '#FBBBBF',
      text:    '#3D0A14',
      muted:   '#7C2D36',
      subtle:  '#B45563',
    },
  },

  /** 매칭 상태별 색상 (테이블 행 색 구분용) */
  matchStatus: {
    matched:   { bg: '#D1FAE5', text: '#065F46', dot: '#10B981', label: '매칭성공' },
    orderOnly: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: '주문만있음' },
    b2bOnly:   { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'B2B만있음' },
  } as const,

  sidebar: {
    width:          '240px',
    collapsedWidth: '64px',
  },
} as const
