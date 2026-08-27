import type { DbClient } from '@/database/prisma';
import type { AuditEntry } from '@/modules/audit/audit.types';

export class AuditService {
  constructor(private readonly db: DbClient) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }
}
