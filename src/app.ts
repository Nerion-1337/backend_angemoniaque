import { OpenAPIHono } from '@hono/zod-openapi'; import { cors } from 'hono/cors';
import { HttpError } from './lib/db.js'; import { auth, admin } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js'; import { characters } from './routes/characters.js'; import { actions } from './routes/actions.js'; import { combat } from './routes/combat.js';
import { divine } from './routes/divine.js'; import { mapRoutes } from './routes/map.js'; import { pacts } from './routes/pacts.js'; import { faiths } from './routes/faiths.js';
import { guilds } from './routes/guilds.js'; import { messages } from './routes/messages.js'; import { buildings } from './routes/buildings.js'; import { market } from './routes/market.js';
import { inventory } from './routes/inventory.js'; import { mounts } from './routes/mounts.js'; import { adminRoutes } from './routes/admin.js';
export const app = new OpenAPIHono();
app.use('*', cors()); app.use('*', auth); app.use('/admin/*', admin);
[authRoutes, characters, actions, combat, divine, mapRoutes, pacts, faiths, guilds, messages, buildings, market, inventory, mounts, adminRoutes].forEach(r => app.route('/', r));
app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Angemoniaque API', version: '0.2.0' } });
app.onError((e: any, c) => {
  if (e instanceof HttpError) return c.json({ error: e.message }, e.status as any);
  if (e.code === '23505') return c.json({ error: 'Déjà existant ou case occupée' }, 409);
  if (e.code === 'P0001' || e.code === '23514') return c.json({ error: e.message }, 400);
  console.error(e); return c.json({ error: 'Erreur interne' }, 500);
});
