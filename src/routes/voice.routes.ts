/**
 * JanPramaan — Voice routes
 * Multilingual voice-to-text translation endpoints.
 * No authentication required — these are utility endpoints for the issue form.
 */
import { Router } from 'express';
import * as voiceCtrl from '../controllers/voice.controller';

const router = Router();

/**
 * @openapi
 * /api/voice/translate:
 *   post:
 *     summary: Translate text from any language to English
 *     tags: [Voice]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "मुख्य सड़क पर गड्ढा है"
 *     responses:
 *       200:
 *         description: Translation result with detected language
 */
router.post('/translate', voiceCtrl.translateText);

/**
 * @openapi
 * /api/voice/translate-fields:
 *   post:
 *     summary: Translate title and description fields to English
 *     tags: [Voice]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Translated fields with detected languages
 */
router.post('/translate-fields', voiceCtrl.translateMultipleFields);

/**
 * @openapi
 * /api/voice/languages:
 *   get:
 *     summary: List supported Indian languages
 *     tags: [Voice]
 *     responses:
 *       200:
 *         description: Array of supported languages with codes
 */
router.get('/languages', voiceCtrl.listLanguages);

export default router;
