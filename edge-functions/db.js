async function getConnection(env) {
  const mysql = await import('mysql2/promise');
  return await mysql.createConnection({
    host: 'mysql6.sqlpub.com',
    port: 3311,
    user: 'pxstate',
    password: 'bUsopkwLrRbHiFvM',
    database: 'turquoise'
  });
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'turquoise_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(userId) {
  const random = Math.random().toString(36).substring(2);
  const timestamp = Date.now().toString(36);
  return `${userId}_${timestamp}_${random}`;
}

export { getConnection, generateId, hashPassword, generateToken };
