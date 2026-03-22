import { getConnection } from '../../db.js';

export default async function onRequestPost(context) {
  const { request, env } = context;
  let connection;
  
  try {
    const cookie = request.headers.get('Cookie') || '';
    const tokenMatch = cookie.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    if (token) {
      connection = await getConnection(env);
      await connection.execute('DELETE FROM sessions WHERE token = ?', [token]);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
      }
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
