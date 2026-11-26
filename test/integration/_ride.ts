// Aide de test (migration 43) : un type de monstre montable, un sort qui l'invoque, appris par le personnage, lancé avec
// « monter dessus ». Remplace les anciennes montures possédées. Renvoie le type, le sort et l'invocation montée.
type Call = (path: string, body?: any, tk?: string, method?: string) => Promise<{ status: number; j: any }>;
export async function summonAndRide(call: Call, adm: string, charId: number, tk: string, monster: Record<string, any>, ride = true) {
  const type = (await call('/admin/content/monsters', { hp_max: 50, energy_max: 50, mountable: true, locomotion: ['land'], ...monster }, adm)).j.id;
  const spell = (await call('/admin/content/spells', { name: `Appel ${monster.name}`, energyCost: 0, shop: false, effects: { summon: { kind: 'monster', refId: type } } }, adm)).j.id;
  await call(`/admin/players/${charId}/grant`, { kind: 'spell', refId: spell }, adm);
  const cast = await call('/spells/cast', { characterId: charId, spellId: spell, ride }, tk);
  if (cast.status !== 200) throw new Error(`invocation refusée : ${JSON.stringify(cast.j)}`);
  const summon = (await call(`/summons/${charId}`, undefined, tk)).j.find((x: any) => x.monster_id === type);
  return { type, spell, summon, cast };
}
