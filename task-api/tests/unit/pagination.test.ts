import { encodeCursor, decodeCursor, nextCursor, DEFAULT_LIMIT } from '../../src/utils/pagination.js';
import { InvalidCursorError } from '../../src/utils/errors.js';

describe('pagination utils', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips a string sort value', () => {
      const cursor = { v: '2024-01-01T00:00:00.000Z', id: 'abc-123' };
      expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    });

    it('round-trips a numeric sort value', () => {
      const cursor = { v: 42, id: 'xyz-789' };
      expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    });

    it('throws InvalidCursorError for garbage input', () => {
      expect(() => decodeCursor('not-base64url!')).toThrow(InvalidCursorError);
    });

    it('throws InvalidCursorError for valid base64url missing fields', () => {
      const bad = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
      expect(() => decodeCursor(bad)).toThrow(InvalidCursorError);
    });
  });

  describe('nextCursor', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      id: `id-${i}`,
      createdAt: new Date(2024, 0, i + 1).toISOString(),
    }));

    it('returns null when fewer items than limit', () => {
      expect(nextCursor(items.slice(0, 10), DEFAULT_LIMIT, (i) => i.createdAt)).toBeNull();
    });

    it('returns a cursor when items equal limit', () => {
      const cursor = nextCursor(items, DEFAULT_LIMIT, (i) => i.createdAt);
      expect(cursor).not.toBeNull();
      const decoded = decodeCursor(cursor!);
      expect(decoded.id).toBe('id-24');
    });

    it('returns null for empty array', () => {
      expect(nextCursor([], DEFAULT_LIMIT, (i: { createdAt: string }) => i.createdAt)).toBeNull();
    });
  });
});
