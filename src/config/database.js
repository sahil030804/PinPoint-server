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
  dialectOptions: env.isProd && env.db.sslCaCert
    ? { ssl: { require: true, rejectUnauthorized: true, ca: env.db.sslCaCert } }
    : env.isProd
      ? { ssl: { require: true, rejectUnauthorized: true } }
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
