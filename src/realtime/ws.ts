import { Redis } from 'ioredis'; import { env } from '../config/env.js';
export const pub = new Redis(env.redis); const sub = new Redis(env.redis); [pub, sub].forEach(r => r.on('error', e => console.error('[redis]', e.message)));
const sockets = new Map<number, Set<any>>();
export const joinMap = (mapId: number, ws: any) => { (sockets.get(mapId) ?? sockets.set(mapId, new Set()).get(mapId)!).add(ws); };
export const leave = (ws: any) => sockets.forEach(s => s.delete(ws));
export const broadcast = (mapId: number, evt: unknown) => pub.publish(`map:${mapId}`, JSON.stringify(evt));
sub.psubscribe('map:*');
sub.on('pmessage', (_p, ch, msg) => sockets.get(Number(ch.split(':')[1]))?.forEach(ws => ws.send(msg)));
