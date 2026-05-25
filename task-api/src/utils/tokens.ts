import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AccessPayload {
  sub: string;
  email: string;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}

export function signAccess(payload: Omit<AccessPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'access' }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL,
    algorithm: 'HS256',
  });
}

export function signRefresh(payload: Omit<RefreshPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'refresh' }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_TTL,
    algorithm: 'HS256',
  });
}

export function verifyAccess(token: string): AccessPayload {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessPayload;
  if (payload.typ !== 'access') throw new Error('Invalid token type');
  return payload;
}

export function verifyRefresh(token: string): RefreshPayload {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as RefreshPayload;
  if (payload.typ !== 'refresh') throw new Error('Invalid token type');
  return payload;
}
