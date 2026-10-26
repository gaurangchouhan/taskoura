import { SessionInfo } from '../types';

export type AuthSyncEvent =
  | { type: 'activity'; timestamp: number }
  | { type: 'extended'; session: SessionInfo }
  | { type: 'logout'; reason?: string };

const CHANNEL_NAME = 'taskoura-auth';
const STORAGE_SYNC_KEY = 'taskoura_auth_channel_sync';

const activeInstances = new Set<SessionChannelManager>();

export class SessionChannelManager {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(event: AuthSyncEvent) => void>();
  private storageHandler: ((e: StorageEvent) => void) | null = null;

  constructor() {
    this.init();
    activeInstances.add(this);
  }

  private init() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent) => {
          if (event.data && typeof event.data === 'object' && 'type' in event.data) {
            this.emit(event.data as AuthSyncEvent);
          }
        };
      } catch {
        this.channel = null;
      }
    }

    if (typeof window !== 'undefined') {
      this.storageHandler = (event: StorageEvent) => {
        if (event.key === STORAGE_SYNC_KEY && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue) as AuthSyncEvent & { _ts?: number };
            this.emit(parsed);
          } catch {
            // ignore JSON parse errors
          }
        }
      };
      window.addEventListener('storage', this.storageHandler);
    }
  }

  public post(event: AuthSyncEvent): void {
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch {
        // Fallback to storage event
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const payload = JSON.stringify({ ...event, _ts: Date.now() + Math.random() });
        localStorage.setItem(STORAGE_SYNC_KEY, payload);
      } catch {
        // ignore storage errors
      }
    }

    // In simulated/single-process environments, notify other instances directly
    activeInstances.forEach((instance) => {
      if (instance !== this) {
        instance.emit(event);
      }
    });
  }

  public subscribe(listener: (event: AuthSyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: AuthSyncEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[SessionChannel] Error in subscriber:', err);
      }
    });
  }

  public destroy(): void {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // ignore
      }
      this.channel = null;
    }
    if (this.storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    this.listeners.clear();
    activeInstances.delete(this);
  }
}

export const sessionChannel = new SessionChannelManager();

export function broadcastAuthEvent(event: AuthSyncEvent): void {
  sessionChannel.post(event);
}

export function subscribeAuthEvents(listener: (event: AuthSyncEvent) => void): () => void {
  return sessionChannel.subscribe(listener);
}
