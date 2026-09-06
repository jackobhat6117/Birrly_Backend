export type InsightTone = 'positive' | 'neutral' | 'warning';

export type Insight = {
  message: string;
  tone: InsightTone;
};

export type MonthlyInsightsDto = {
  period: { year: number; month: number };
  insights: Insight[];
  generatedAt: string;
};
