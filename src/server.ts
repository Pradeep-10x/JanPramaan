/**
 * JanPramaan — HTTP server entry point
 */
import app, { logger } from './app';
import { config } from './config';
import { runEscalationCheck } from './services/escalation.service.js';
import { initFirebase } from './services/push.service.js';

const PORT = config.port;

// ─── Firebase push notifications ──────────────────────────────────────────────
initFirebase();

// ─── Escalation background job ────────────────────────────────────────────────
// Runs every hour. First run is delayed 30 s to let the DB pool warm up.
const ESCALATION_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

setTimeout(async () => {
  try {
    await runEscalationCheck();
  } catch (err) {
    logger.error('[Escalation] Initial run failed', { err });
  }
  setInterval(async () => {
    try {
      await runEscalationCheck();
    } catch (err) {
      logger.error('[Escalation] Scheduled run failed', { err });
    }
  }, ESCALATION_INTERVAL_MS);
}, 30_000);

app.listen(PORT, () => {
  logger.info(`🏗️  JanPramaan API listening on http://localhost:${PORT}`);
  logger.info(`📋 Health check: http://localhost:${PORT}/health`);
  logger.info(`⏰  Escalation job scheduled every ${ESCALATION_INTERVAL_MS / 60_000} min (first run in 30 s)`);
});
