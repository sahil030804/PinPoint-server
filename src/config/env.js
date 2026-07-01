import dotenv from 'dotenv';
dotenv.config();

const hasDbUrl = !!process.env.DATABASE_URL;
const hasIndividualDb = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
  .every((key) => !!process.env[key]);

if (!hasDbUrl && !hasIndividualDb) {
  console.error(
    'Missing database config: provide DATABASE_URL or all of DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD'
  );
  process.exit(1);
}

const required = [
  'REDIS_URL',
  'AUTH_SECRET',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  auth: {
    secret: process.env.AUTH_SECRET,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  },

  apiKey: {
    encryptionKey: process.env.API_KEY_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
  },

  email: {
    driver: process.env.EMAIL_DRIVER || 'smtp',
    from: process.env.EMAIL_FROM || 'noreply@pinpoint.dev',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@pinpoint.dev',
  },

  r2: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME || 'pinpoint-screenshots',
    publicUrl: process.env.R2_PUBLIC_URL,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
    businessPriceId: process.env.STRIPE_BUSINESS_PRICE_ID,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  },
};
