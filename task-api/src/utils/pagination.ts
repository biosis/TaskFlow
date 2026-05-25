import { z } from 'zod';
import { InvalidCursorError } from './errors.js';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export interface Cursor {
  v: string | number;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(encoded: string): Cursor {
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('v' in decoded) ||
      !('id' in decoded)
    ) {
      throw new InvalidCursorError();
    }
    return decoded as Cursor;
  } catch {
    throw new InvalidCursorError();
  }
}

export function nextCursor<T extends { id: string }>(
  items: T[],
  limit: number,
  getSortValue: (item: T) => string | number,
): string | null {
  if (items.length < limit) return null;
  const last = items[items.length - 1];
  if (!last) return null;
  return encodeCursor({ v: getSortValue(last), id: last.id });
}

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
