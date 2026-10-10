import { Sequelize } from 'sequelize';
import { env } from './env.js';

const dbConfig = {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.isDev ? (msg) => console.log(`[SQL] ${msg}`) : false,
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  // NOTE: managed poolers (Supabase Supavisor) present a chain Node
  // can't verify against public CAs. Encryption stays on (require);
  // chain verification only when an explicit CA is provided.
  dialectOptions: env.isProd && env.db.sslCaCert
    ? { ssl: { require: true, rejectUnauthorized: true, ca: env.db.sslCaCert, servername: env.db.host } }
    : env.isProd
      ? { ssl: { require: true, rejectUnauthorized: false, servername: env.db.host } }
      : {},
};

let sequelize;

if (env.db.url) {
  sequelize = new Sequelize(env.db.url, {
    ...dbConfig,
  });
} else {
  sequelize = new Sequelize(
    env.db.name,
    env.db.user,
    env.db.password,
    dbConfig
  );
}

export { Sequelize, sequelize };

export default sequelize;
