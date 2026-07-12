import type { SyncQueueItem } from "../domain/models";
import type { PosRepository } from "../database/repository";

export type RemoteSyncResult = { firebaseId?: string; remoteUpdatedAt?: string };
export interface FirebaseSyncPort {
  isOnline(): Promise<boolean>;
  push(item: SyncQueueItem, idempotencyKey: string): Promise<RemoteSyncResult>;
  pullProducts(since: string | null): Promise<unknown[]>;
}
export type SyncSummary = { state: "offline" | "synced" | "pending"; pending: number; failed: number };

export async function flushSyncQueue(repository: PosRepository, remote: FirebaseSyncPort): Promise<SyncSummary> {
  const queue = await repository.pendingSyncItems(100);
  if (!(await remote.isOnline())) return { state: "offline", pending: queue.length, failed: 0 };
  let failed = 0;
  for (const item of queue) {
    try {
      await remote.push(item, `${item.entityType}:${item.entityId}:${item.action}`);
      await repository.markSyncResult(item.id, "synced", new Date().toISOString());
    } catch {
      failed += 1;
      await repository.markSyncResult(item.id, "failed");
    }
  }
  return { state: failed > 0 ? "pending" : "synced", pending: failed, failed };
}

export function shouldAcceptRemoteStock(localUpdatedAt: string, remoteUpdatedAt: string) {
  return Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt);
}
