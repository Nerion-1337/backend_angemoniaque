import pg from 'pg'; import { env } from '../config/env.js';
export const pool = new pg.Pool({ connectionString: env.pg, options: '-c search_path=game_schema' });
