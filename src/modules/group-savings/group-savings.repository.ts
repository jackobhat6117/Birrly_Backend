import type { Prisma, GroupSavingsGoal, GroupSavingsMember, GroupSavingsContribution } from '@prisma/client';
import type { DbClient } from '@/database/prisma';

export type GroupSavingsWithRelations = GroupSavingsGoal & {
  createdBy: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    telegramUsername: string | null;
  };
  members: (GroupSavingsMember & {
    user: {
      id: string;
      telegramId: string;
      firstName: string | null;
      lastName: string | null;
      telegramUsername: string | null;
    };
  })[];
  contributions: (GroupSavingsContribution & {
    user: {
      id: string;
      telegramId: string;
      firstName: string | null;
      lastName: string | null;
      telegramUsername: string | null;
    };
  })[];
};

export class GroupSavingsRepository {
  constructor(private readonly prisma: DbClient) {}

  async listForUser(userId: string): Promise<GroupSavingsWithRelations[]> {
    return this.prisma.groupSavingsGoal.findMany({
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
        contributions: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { contributedAt: 'desc' },
          take: 30,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<GroupSavingsWithRelations | null> {
    return this.prisma.groupSavingsGoal.findUnique({
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
        contributions: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { contributedAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async findByJoinToken(joinToken: string): Promise<GroupSavingsWithRelations | null> {
    return this.prisma.groupSavingsGoal.findUnique({
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
        contributions: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { contributedAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async findByTelegramChatId(telegramChatId: string): Promise<GroupSavingsWithRelations | null> {
    return this.prisma.groupSavingsGoal.findFirst({
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
        contributions: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, lastName: true, telegramUsername: true },
            },
          },
          orderBy: { contributedAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async countCreatedByUser(userId: string): Promise<number> {
    return this.prisma.groupSavingsGoal.count({
      where: { createdById: userId },
    });
  }

  async update(id: string, data: Prisma.GroupSavingsGoalUpdateInput): Promise<GroupSavingsGoal> {
    return this.prisma.groupSavingsGoal.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.groupSavingsGoal.delete({
      where: { id },
    });
  }

  async addMember(groupSavingsGoalId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'): Promise<GroupSavingsMember> {
    return this.prisma.groupSavingsMember.create({
      data: {
        groupSavingsGoalId,
        userId,
        role,
      },
    });
  }

  async removeMember(groupSavingsGoalId: string, userId: string): Promise<void> {
    await this.prisma.groupSavingsMember.deleteMany({
      where: {
        groupSavingsGoalId,
        userId,
      },
    });
  }

  async addContribution(data: Prisma.GroupSavingsContributionCreateInput): Promise<GroupSavingsContribution> {
    return this.prisma.groupSavingsContribution.create({
      data,
    });
  }
}
