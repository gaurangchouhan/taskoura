export interface RawNotification {
  id: string;
  message: string;
  isRead?: boolean;
  read?: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function normalizeNotification(
  raw: RawNotification | Record<string, unknown>
): Notification {
  const isRead =
    typeof raw.isRead === 'boolean'
      ? raw.isRead
      : typeof raw.read === 'boolean'
      ? raw.read
      : false;

  return {
    id: typeof raw.id === 'string' ? raw.id : String(raw.id ?? ''),
    message: typeof raw.message === 'string' ? raw.message : String(raw.message ?? ''),
    isRead,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : String(raw.createdAt ?? ''),
  };
}
