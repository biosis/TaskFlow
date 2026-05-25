import { buildApp } from './server.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'Unhandled rejection');
    process.exit(1);
  });

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info({ port: config.PORT }, 'Server started');
}

void main();
