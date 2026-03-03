/**
 * WitnessLedger — HTTP server entry point
 */
import app, { logger } from './app';
import { config } from './config';

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`🏗️  WitnessLedger API listening on http://localhost:${PORT}`);
  logger.info(`📋 Health check: http://localhost:${PORT}/health`);
});
