export type EqubFrequency = 'WEEKLY' | 'MONTHLY';
export type EqubStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type CreateEqubInput = {
  name: string;
  contributionAmount: string;
  currency?: string;
  frequency: EqubFrequency;
  startDate?: string;
  members: Array<{ name: string; telegramUsername?: string }>;
};

export type RecordEqubContributionInput = {
  memberId: string;
};

export type EqubMemberDto = {
  id: string;
  name: string;
  telegramUsername: string | null;
  payoutPosition: number;
  payoutReceived: boolean;
  /** True once the member linked their Telegram via the join link. */
  linked: boolean;
  /** True once this member has contributed for the Equb's current cycle. */
  paidThisCycle: boolean;
  /** True when this member is the one due to receive the pot this cycle. */
  isCurrentRecipient: boolean;
};

export type EqubDto = {
  id: string;
  name: string;
  contributionAmount: string;
  currency: string;
  frequency: EqubFrequency;
  startDate: string;
  status: EqubStatus;
  currentCycle: number;
  totalCycles: number;
  /** contributionAmount × member count — what the recipient collects each cycle. */
  potAmount: string;
  joinLink: string;
  members: EqubMemberDto[];
  createdAt: string;
};

export type EqubSummaryDto = {
  id: string;
  name: string;
  contributionAmount: string;
  currency: string;
  frequency: EqubFrequency;
  status: EqubStatus;
  currentCycle: number;
  totalCycles: number;
  memberCount: number;
  paidThisCycle: number;
  currentRecipientName: string | null;
};
