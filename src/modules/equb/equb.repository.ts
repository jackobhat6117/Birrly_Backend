import type { Equb, EqubContribution, EqubMember, Prisma } from '@prisma/client';
import type { DbClient, DbTransaction } from '@/database/prisma';

type Client = DbClient | DbTransaction;

export type EqubWithMembers = Equb & {
  members: EqubMember[];
  contributions: EqubContribution[];
};

export class EqubRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: Prisma.EqubCreateInput): Promise<Equb> {
    return this.db.equb.create({ data });
  }

  async listForUser(userId: string): Promise<EqubWithMembers[]> {
    return this.db.equb.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { members: { orderBy: { payoutPosition: 'asc' } }, contributions: true },
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<EqubWithMembers | null> {
    return this.db.equb.findFirst({
      where: { id, userId },
      include: { members: { orderBy: { payoutPosition: 'asc' } }, contributions: true },
    });
  }

  async findByJoinToken(token: string): Promise<EqubWithMembers | null> {
    return this.db.equb.findUnique({
      where: { joinToken: token },
      include: { members: { orderBy: { payoutPosition: 'asc' } }, contributions: true },
    });
  }

  async update(id: string, data: Prisma.EqubUpdateInput, client: Client = this.db): Promise<Equb> {
    return client.equb.update({ where: { id }, data });
  }

  async findMemberById(memberId: string): Promise<EqubMember | null> {
    return this.db.equbMember.findUnique({ where: { id: memberId } });
  }

  async linkMemberTelegram(
    memberId: string,
    telegramUserId: string,
    telegramUsername: string | null,
  ): Promise<EqubMember> {
    return this.db.equbMember.update({
      where: { id: memberId },
      data: { telegramUserId, telegramUsername, joinedAt: new Date() },
    });
  }

  async createContribution(
    data: Prisma.EqubContributionUncheckedCreateInput,
    client: Client = this.db,
  ): Promise<EqubContribution> {
    return client.equbContribution.create({ data });
  }

  async findContribution(memberId: string, cycle: number): Promise<EqubContribution | null> {
    return this.db.equbContribution.findUnique({
      where: { memberId_cycle: { memberId, cycle } },
    });
  }
}
