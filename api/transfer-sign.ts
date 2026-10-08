import { createTransferSignHandler } from '../server/transferSign.js';

export default {
  fetch: createTransferSignHandler({
    key: process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEYS?.split(',')[0]?.trim(),
    model: process.env.GEMINI_MODEL || undefined,
  }),
};
