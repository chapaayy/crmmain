import { Injectable } from "@nestjs/common";

export interface RealtimePayload {
  event: string;
  data?: unknown;
}

type RealtimeSender = (payload: RealtimePayload) => void;

@Injectable()
export class RealtimeService {
  private readonly subscribers = new Map<string, Set<RealtimeSender>>();

  subscribe(userId: string, sender: RealtimeSender) {
    const userSubscribers = this.subscribers.get(userId) ?? new Set<RealtimeSender>();
    userSubscribers.add(sender);
    this.subscribers.set(userId, userSubscribers);

    sender({
      event: "connected",
      data: {
        connectedAt: new Date().toISOString()
      }
    });

    return () => {
      userSubscribers.delete(sender);

      if (userSubscribers.size === 0) {
        this.subscribers.delete(userId);
      }
    };
  }

  emitToUser(userId: string | undefined | null, event: string, data?: unknown) {
    if (!userId) {
      return;
    }

    const userSubscribers = this.subscribers.get(userId);

    if (!userSubscribers?.size) {
      return;
    }

    for (const sender of userSubscribers) {
      sender({ event, data });
    }
  }

  emitToUsers(userIds: Array<string | null | undefined>, event: string, data?: unknown) {
    for (const userId of new Set(userIds.filter((item): item is string => Boolean(item)))) {
      this.emitToUser(userId, event, data);
    }
  }
}
