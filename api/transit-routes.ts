import { createTransitHandler } from '../server/transit.js';

export default {
  fetch: createTransitHandler({
    key: process.env.GOOGLE_ROUTES_API_KEY,
    enabled: process.env.GOOGLE_TRANSIT_ENABLED !== 'false',
  }),
};
