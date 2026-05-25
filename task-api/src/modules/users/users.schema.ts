import { z } from 'zod';

export const updateMeBody = z.object({
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  archiveThresholdDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const deleteMeBody = z.object({
  password: z.string().min(1),
});

export type UpdateMeBody = z.infer<typeof updateMeBody>;
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;
export type DeleteMeBody = z.infer<typeof deleteMeBody>;
