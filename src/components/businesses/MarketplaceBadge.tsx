interface Props {
  marketplace: string
  size?: 'sm' | 'md'
}

const MARKETPLACE_INFO: Record<string, { label: string; color: string }> = {
  coupang:      { label: '쿠팡',       color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  smartstore:   { label: '스마트스토어', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  '11st':       { label: '11번가',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  auction:      { label: '옥션',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  gmarket:      { label: '지마켓',     color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  etc:          { label: '기타',       color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

export function MarketplaceBadge({ marketplace, size = 'sm' }: Props) {
  const info = MARKETPLACE_INFO[marketplace] ?? MARKETPLACE_INFO['etc']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${info.color} ${size === 'md' ? 'text-xs px-2.5 py-1' : ''}`}>
      {info.label}
    </span>
  )
}
