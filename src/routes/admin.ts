import { router } from '../lib/route.js';
import { coreRoutes } from './admin/core.js';
import { raceRoutes } from './admin/races.js';
import { monsterRoutes } from './admin/monsters.js';
import { itemRoutes } from './admin/items.js';
import { mountRoutes } from './admin/mounts.js';
import { buildingRoutes } from './admin/buildings.js';
import { entityRoutes } from './admin/entity.js';
import { playerRoutes } from './admin/players.js';
import { bestiaryRoutes } from './admin/bestiary.js';
import { spellRoutes, monsterDetailRoutes } from './admin/monsterDetails.js';
/** Espace administrateur — monté dans app.ts sous la garde `admin` (rôle du JWT). */
import { tileRoutes } from './admin/tiles.js'; import { recipeRoutes } from './admin/recipes.js'; import { depositRoutes } from './admin/deposits.js';
export const adminRoutes = router();
[coreRoutes, raceRoutes, monsterRoutes, itemRoutes, mountRoutes, buildingRoutes, entityRoutes, playerRoutes, bestiaryRoutes, spellRoutes, monsterDetailRoutes, tileRoutes, recipeRoutes, depositRoutes].forEach(r => adminRoutes.route('/', r));
