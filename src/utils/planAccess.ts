import { useAuthStore } from '../stores/authStore'

export type PlanTier = 'auto' | 'bulk' | 'single'

const RANK: Record<PlanTier, number> = {
  single: 1,
  bulk:   2,
  auto:   3,
}

const LABEL: Record<PlanTier, string> = {
  auto:   '자동매칭',
  bulk:   '일괄매칭',
  single: '1:1 주문매칭',
}

export function getPlanLabel(tier: PlanTier): string {
  return LABEL[tier]
}

export function hasPlanAccess(userTier: PlanTier | null | undefined, required: PlanTier): boolean {
  if (!userTier) return true
  return RANK[userTier] >= RANK[required]
}

export function usePlanAccess() {
  const user = useAuthStore(s => s.user)
  const tier = (user?.planTier ?? null) as PlanTier | null
  const isAdmin = !!user?.isAdmin

  return {
    tier,
    tierLabel: tier ? LABEL[tier] : null,
    canUseAuto:   isAdmin || hasPlanAccess(tier, 'auto'),
    canUseBulk:   isAdmin || hasPlanAccess(tier, 'bulk'),
    canUseSingle: isAdmin || hasPlanAccess(tier, 'single'),
  }
}
