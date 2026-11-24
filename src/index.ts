import { serve } from '@hono/node-server'; import { createNodeWebSocket } from '@hono/node-ws';
import { app } from './app.js'; import { env } from './config/env.js'; import { startClock } from './game/clock.js'; import { joinMap, leave } from './realtime/ws.js';
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
app.get('/ws', upgradeWebSocket(c => ({ onOpen: (_e, ws) => joinMap(Number(c.req.query('map') ?? 1), ws), onClose: (_e, ws) => leave(ws) })));
startClock();   // horloge persistante : rattrape les heures écoulées (même serveur arrêté), vérifie chaque minute
injectWebSocket(serve({ fetch: app.fetch, port: env.port }));
