import { pool } from '../db/pool.js';
export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const fail = (s: number, m: string): never => { throw new HttpError(s, m); };
export async function tx<T>(fn: (db: any) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const r = await fn(db); await db.query('COMMIT'); return r; }
  catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
export async function ownChar(db: any, c: any, id: number) {
  const { rows: [ch] } = await db.query('SELECT * FROM characters WHERE id=$1 AND account_id=$2', [id, c.get('acc').sub]);
  if (!ch) fail(403, 'Personnage inconnu'); if (ch.blocked) fail(403, 'Personnage bloqué'); return ch;
}
export const posOf = async (db: any, id: number) => (await db.query('SELECT * FROM positions WHERE character_id=$1', [id])).rows[0];
export const dist = (a: any, b: any) => Math.max(Math.abs(a.coord_x - b.coord_x), Math.abs(a.coord_y - b.coord_y));
export const log = (db: any, id: number, action: string) => db.query('INSERT INTO history_action(character_id,action) VALUES ($1,$2)', [id, action]);
export const trimLog = (db: any, id: number) => db.query('DELETE FROM history_action WHERE id IN (SELECT id FROM history_action WHERE character_id=$1 ORDER BY id DESC OFFSET 100)', [id]);
export { pool };
