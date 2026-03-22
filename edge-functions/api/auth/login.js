import { getConnection, hashPassword, generateToken } from '../../db.js';

export default async function onRequestPost(context) {
  const { request, env } = context;
  let connection;
  
  try {
    const body = await request.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    connection = await getConnection(env);
    
    const [rows] = await connection.execute(
      'SELECT id, username, password, created_at FROM users WHERE username = ?',
      [username]
    );
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = rows[0];
    const hashedPassword = await hashPassword(password);
    
    if (user.password !== hashedPassword) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const now = Date.now();
    const token = generateToken(user.id);
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    
    await connection.execute(
      'INSERT INTO sessions (token, user_id, username, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      [token, user.id, user.username, now, expiresAt]
    );
    
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.created_at
      },
      token
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
