import { writeFileSync } from 'node:fs';

const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error('\n[Netlify] Variabel environment belum lengkap:\n- ' + missing.join('\n- '));
  process.exit(1);
}

const config = `window.APP_CONFIG = ${JSON.stringify({
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  }
}, null, 2)};\n`;

writeFileSync('runtime-config.js', config, 'utf8');
console.log('[Netlify] runtime-config.js berhasil dibuat.');
