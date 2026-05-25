import { z } from 'zod';

export const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
});

export const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const userPublic = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
});

export const authResponse = z.object({
  user: userPublic,
  accessToken: z.string(),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type UserPublic = z.infer<typeof userPublic>;
