import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { WeakPasswordError } from './errors.js';

export function validateStrength(plain: string): void {
  if (plain.length < 8) throw new WeakPasswordError();
}

export async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.BCRYPT_COST);
}

export async function verify(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
