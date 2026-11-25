import { cfgNum } from './content.js';
import { grantDivine } from './divine.js';
/**
 * Butin au death d'un monstre : or du monstre + entrées monster_loot tirées à la probabilité
 * (drop_rate de l'entrée × multiplicateur global game_config.drop_rate).
 *  - item     → character_items (quantité aléatoire dans [qty_min, qty_max])
 *  - resource → characters.resources (JSONB, incrément) — sauf la ressource spéciale `or` :
 *               elle crédite directement l'OR du vainqueur (gold), l'or faisant partie du
 *               butin donné au tueur (Étape 2 phase 3c).
 *  - divine   → grantDivine (transfert propre de la pièce désignée : UPDATE du holder, jamais
 *               d'insertion → aucune duplication ; si le plafond de détention du vainqueur est
 *               atteint, la pièce reste au gardien et l'échec est journalisé, pas bloquant).
 * Un monstre sauvage (data.spawned) tire le butin de son prototype (data.prototype).
 */

export async function rollLoot(db: any, monster: any, killerId: number, out: string[] = []): Promise<string[]> {
  if (monster.gold_current > 0) {
    await db.query('UPDATE characters SET gold=gold+$2 WHERE id=$1', [killerId, Number(monster.gold_current)]);
    out.push(`or ${monster.gold_current}`);
  }
  const sourceId = monster.data?.spawned ? monster.data?.prototype ?? monster.id : monster.id;   // monstre posé : SON butin (copié et réglé en admin)
  const { rows } = await db.query('SELECT * FROM monster_loot WHERE monster_id=$1 ORDER BY id', [sourceId]);
  const rate = await cfgNum('drop_rate', 1);
  for (const l of rows) {
    if (Math.random() * 100 >= Number(l.drop_rate) * rate) continue;
    const qmin = l.qty_min ?? 1, qmax = l.qty_max ?? l.qty_min ?? 1;
    const q = qmin === qmax ? qmin : qmin + Math.floor(Math.random() * (qmax - qmin + 1));
    if (l.item_id) {
      const r = await db.query('UPDATE character_items SET qty=qty+$3 WHERE character_id=$1 AND item_id=$2', [killerId, l.item_id, q]);
      if (!r.rowCount) await db.query('INSERT INTO character_items(character_id,item_id,qty) VALUES ($1,$2,$3)', [killerId, l.item_id, q]);
      out.push(`objet x${q}`);
    }
    if (l.resource) {
      if (l.resource === 'or') {   // l'or fait partie du butin donné au tueur
        await db.query('UPDATE characters SET gold=gold+$2 WHERE id=$1', [killerId, q]);
        out.push(`or x${q}`);
      } else {
        const { rows: [ch] } = await db.query('SELECT resources FROM characters WHERE id=$1', [killerId]);
        const res: Record<string, number> = { ...(ch?.resources ?? {}) };
        res[l.resource] = (res[l.resource] ?? 0) + q;
        await db.query('UPDATE characters SET resources=$2 WHERE id=$1', [killerId, JSON.stringify(res)]);
        out.push(`${l.resource} x${q}`);
      }
    }
    if (l.divine_id) {
      try {
        await grantDivine(db, killerId, null, l.divine_id);
        out.push('objet divin (transfert)');
      } catch (e: any) {
        out.push(`objet divin indisponible (${e?.message ?? 'plafond atteint'})`);
      }
    }
  }
  return out;
}
