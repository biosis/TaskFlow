import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),
  SHADOW_DATABASE_URL: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379/0'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(1209600),

  COOKIE_SECURE: z.coerce.boolean().default(true),
  COOKIE_DOMAIN: z.string().optional(),

  BCRYPT_COST: z.coerce.number().default(12),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_USER_PER_MIN: z.coerce.number().default(100),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().default(10),

  SOFT_DELETE_RETENTION_DAYS: z.coerce.number().default(30),
  MAX_ASSIGNEES_PER_TASK: z.coerce.number().default(10),
  MAX_SUBTASK_DEPTH: z.coerce.number().default(3),

  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().default(10),

  ENABLE_SWAGGER: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;
