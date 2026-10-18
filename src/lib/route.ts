import { createRoute, z } from '@hono/zod-openapi';
export { z };
/** Déclare une route OpenAPI en une ligne ; le handler retourne l'objet JSON (erreurs via fail()). */
export function def(app: any, method: 'get'|'post'|'put'|'delete', path: string, schema: any, handler: (c: any, body: any) => Promise<any>) {
  app.openapi(createRoute({ method, path, request: schema ? { body: { content: { 'application/json': { schema } } } } : {}, responses: { 200: { description: 'ok' } } }),
    async (c: any) => c.json(await handler(c, schema ? c.req.valid('json') : undefined)));
}
export const P = (c: any, k: string) => Number(c.req.param(k));
/** Routeur dont les erreurs de validation Zod sont renvoyées en {error:"message lisible"} (HTTP 400). */
import { OpenAPIHono } from '@hono/zod-openapi';
export const router = () => new OpenAPIHono({ defaultHook: (r: any, c: any) => {
  if (!r.success) return c.json({ error: r.error.issues.map((i: any) => (i.path.length ? i.path.join('.') + ' : ' : '') + i.message).join(' ; ') }, 400);
} });
