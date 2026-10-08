import type { Prisma, GroupBudget, GroupBudgetMember, GroupBudgetExpense } from '@prisma/client';
import type { DbClient } from '@/database/prisma';

export type GroupBudgetWithRelations = GroupBudget & {
  createdBy: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    telegramUsername: string | null;
  };
  members: (GroupBudgetMember & {
    user: {
      id: string;
      telegramId: string;
      firstName: string | null;
      lastName: string | null;
      telegramUsername: string | null;
    };
  })[];
  expenses: (GroupBudgetExpense & {
    user: {
      id: string;
      telegramId: string;
      firstName: string | null;
      lastName: string | null;
      telegramUsername: string | null;
    };
    category: {
      id: string;
      name: string;
      icon: string | null;
    } | null;
  })[];
};

export class GroupBudgetRepository {
  constructor(private readonly prisma: DbClient) {}

  async listForUser(userId: string): Promise<GroupBudgetWithRelations[]> {
    return this.prisma.groupBudget.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        expenses: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
            category: {
              select: { id: true, name: true, icon: true },
            },
          },
          orderBy: { spentAt: 'desc' },
          take: 30,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<GroupBudgetWithRelations | null> {
    return this.prisma.groupBudget.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        expenses: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
            category: {
              select: { id: true, name: true, icon: true },
            },
          },
          orderBy: { spentAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async findByJoinToken(joinToken: string): Promise<GroupBudgetWithRelations | null> {
    return this.prisma.groupBudget.findUnique({
      where: { joinToken },
      include: {
        createdBy: {
          select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        expenses: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
            category: {
              select: { id: true, name: true, icon: true },
            },
          },
          orderBy: { spentAt: 'desc' },
          take: 30,
        },
      },
    });
  }

  async findByTelegramChatId(telegramChatId: string): Promise<GroupBudgetWithRelations | null> {
    return this.prisma.groupBudget.findFirst({
      where: { telegramChatId },
      include: {
        createdBy: {
          select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        expenses: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
            category: {
              select: { id: true, name: true, icon: true },
            },
          },
          orderBy: { spentAt: 'desc' },
          take: 30,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async countCreatedByUser(userId: string): Promise<number> {
    return this.prisma.groupBudget.count({
      where: { createdById: userId },
    });
  }

  async create(data: Prisma.GroupBudgetCreateInput): Promise<GroupBudget> {
    return this.prisma.groupBudget.create({ data });
  }

  async update(id: string, data: Prisma.GroupBudgetUpdateInput): Promise<GroupBudget> {
    return this.prisma.groupBudget.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.groupBudget.delete({ where: { id } });
  }

  async addMember(groupBudgetId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'): Promise<GroupBudgetMember> {
    return this.prisma.groupBudgetMember.upsert({
      where: {
        groupBudgetId_userId: { groupBudgetId, userId },
      },
      update: { role },
      create: { groupBudgetId, userId, role },
    });
  }

  async removeMember(groupBudgetId: string, userId: string): Promise<void> {
    await this.prisma.groupBudgetMember.deleteMany({
      where: { groupBudgetId, userId },
    });
  }

  async addExpense(data: Prisma.GroupBudgetExpenseCreateInput): Promise<GroupBudgetExpense> {
    return this.prisma.groupBudgetExpense.create({ data });
  }
}
