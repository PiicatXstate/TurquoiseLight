import { getConnection, generateId, hashPassword, generateToken } from '../../db.js';

export async function onRequestPost(context) {
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
    
    if (username.length < 2 || username.length > 20) {
      return new Response(JSON.stringify({ error: '用户名长度需在2-20个字符之间' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: '密码长度至少6个字符' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    connection = await getConnection(env);
    
    const [ipRows] = await connection.execute(
      'SELECT user_id FROM ip_registrations WHERE ip = ?',
      [clientIP]
    );
    
    if (ipRows.length > 0) {
      return new Response(JSON.stringify({ error: '该IP地址已注册过账号' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const [userRows] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (userRows.length > 0) {
      return new Response(JSON.stringify({ error: '用户名已存在' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userId = generateId();
    const now = Date.now();
    const hashedPassword = await hashPassword(password);
    
    await connection.execute(
      'INSERT INTO users (id, username, password, ip, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, clientIP, now]
    );
    
    await connection.execute(
      'INSERT INTO ip_registrations (ip, user_id, created_at) VALUES (?, ?, ?)',
      [clientIP, userId, now]
    );
    
    const token = generateToken(userId);
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    
    await connection.execute(
      'INSERT INTO sessions (token, user_id, username, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      [token, userId, username, now, expiresAt]
    );
    
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: userId,
        username,
        createdAt: now
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
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
