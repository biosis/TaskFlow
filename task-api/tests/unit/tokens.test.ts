import { signAccess, signRefresh, verifyAccess, verifyRefresh } from '../../src/utils/tokens.js';

describe('token utils', () => {
  describe('access tokens', () => {
    it('signs and verifies an access token', () => {
      const token = signAccess({ sub: 'user-id', email: 'a@test.local' });
      const payload = verifyAccess(token);
      expect(payload.sub).toBe('user-id');
      expect(payload.email).toBe('a@test.local');
      expect(payload.typ).toBe('access');
    });

    it('throws on tampered access token', () => {
      const token = signAccess({ sub: 'uid', email: 'b@test.local' });
      expect(() => verifyAccess(token + 'x')).toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('signs and verifies a refresh token', () => {
      const token = signRefresh({ sub: 'user-id', jti: 'session-id' });
      const payload = verifyRefresh(token);
      expect(payload.sub).toBe('user-id');
      expect(payload.jti).toBe('session-id');
      expect(payload.typ).toBe('refresh');
    });

    it('throws on tampered refresh token', () => {
      const token = signRefresh({ sub: 'uid', jti: 'jti' });
      expect(() => verifyRefresh(token + 'y')).toThrow();
    });

    it('rejects an access token used as refresh token', () => {
      const accessToken = signAccess({ sub: 'uid', email: 'c@test.local' });
      expect(() => verifyRefresh(accessToken)).toThrow();
    });
  });
});
