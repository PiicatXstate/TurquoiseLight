import { getConnection } from '../../db.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  let connection;
  
  try {
    const cookie = request.headers.get('Cookie') || '';
    const tokenMatch = cookie.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    if (!token) {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    connection = await getConnection(env);
    
    const [rows] = await connection.execute(
      'SELECT user_id, username FROM sessions WHERE token = ? AND expires_at > ?',
      [token, Date.now()]
    );
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: '会话已过期' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const session = rows[0];
    
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: session.user_id,
        username: session.username
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Verify error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
