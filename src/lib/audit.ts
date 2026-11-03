import { pool } from './db.js';
/** Traile d'audit : qui a modifié quoi, avant/après. Appelé après chaque mutation d'administration. */
export const audit = async (c: any, action: string, target?: string, targetId?: number, before?: unknown, after?: unknown) => {
  await pool.query(
    'INSERT INTO admin_audit(actor_id,action,target,target_id,before,after) VALUES ($1,$2,$3,$4,$5,$6)',
    [c.get('acc')?.sub ?? null, action, target ?? null, targetId ?? null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null],
  );
};
