export const env = { pg: process.env.DATABASE_URL ?? 'postgres://ange:ange@localhost:5432/angemoniaque', redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: process.env.JWT_SECRET ?? 'dev-secret', adminEmail: process.env.ADMIN_EMAIL ?? 'admin@ange.local', port: 3000 };
