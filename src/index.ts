import { serve } from '@hono/node-server'; import { createNodeWebSocket } from '@hono/node-ws';
import { app } from './app.js'; import { env } from './config/env.js'; import { hourlyTick } from './routes/tick.js'; import { joinMap, leave } from './realtime/ws.js';
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get('/ws', upgradeWebSocket(c => ({ onOpen: (_e, ws) => joinMap(Number(c.req.query('map') ?? 1), ws), onClose: (_e, ws) => leave(ws) })));
setInterval(() => hourlyTick().catch(console.error), 3600_000);
injectWebSocket(serve({ fetch: app.fetch, port: env.port }));
