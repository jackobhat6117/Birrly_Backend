export type FunnelStep = {
  id: string;
  label: string;
  count: number;
  percent: number;
};

export function funnelSteps(
  counts: Array<{ id: string; label: string; count: number }>,
): FunnelStep[] {
  const base = counts[0]?.count ?? 0;
  return counts.map((step) => ({
    ...step,
    percent: base === 0 ? 0 : Math.round((step.count / base) * 1000) / 10,
  }));
}

export function effectivePlan(
  plan: string | null | undefined,
  status: string | null | undefined,
  currentPeriodEnd?: Date | null,
): string {
  if (!plan || status !== 'ACTIVE') return 'FREE';
  // A period that has elapsed means the subscription lapsed, even if the stored
  // status is still ACTIVE (expiry is computed on read, not persisted).
  if (currentPeriodEnd && currentPeriodEnd.getTime() <= Date.now()) return 'FREE';
  return plan;
}
