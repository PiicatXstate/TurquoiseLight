import { getConnection, generateId } from '../../../db.js';

export default async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  
  if (method === 'POST') {
    return toggleLike(context);
  } else if (method === 'GET') {
    return checkLiked(context);
  }
  
  return new Response(JSON.stringify({ error: '方法不允许' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function toggleLike(context) {
  const { request, env, params } = context;
  let connection;
  
  try {
    const articleId = params.id;
    
    if (!articleId) {
      return new Response(JSON.stringify({ error: '文章ID不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const cookie = request.headers.get('Cookie') || '';
    const tokenMatch = cookie.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    if (!token) {
      return new Response(JSON.stringify({ error: '请先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    connection = await getConnection(env);
    
    const [sessionRows] = await connection.execute(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?',
      [token, Date.now()]
    );
    
    if (sessionRows.length === 0) {
      return new Response(JSON.stringify({ error: '会话已过期' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userId = sessionRows[0].user_id;
    
    const [likeRows] = await connection.execute(
      'SELECT id FROM likes WHERE article_id = ? AND user_id = ?',
      [articleId, userId]
    );
    
    let liked;
    let likes;
    
    if (likeRows.length > 0) {
      await connection.execute(
        'DELETE FROM likes WHERE article_id = ? AND user_id = ?',
        [articleId, userId]
      );
      await connection.execute(
        'UPDATE articles SET likes = GREATEST(0, likes - 1) WHERE id = ?',
        [articleId]
      );
      liked = false;
    } else {
      await connection.execute(
        'INSERT INTO likes (id, article_id, user_id, created_at) VALUES (?, ?, ?, ?)',
        [generateId(), articleId, userId, Date.now()]
      );
      await connection.execute(
        'UPDATE articles SET likes = likes + 1 WHERE id = ?',
        [articleId]
      );
      liked = true;
    }
    
    const [articleRows] = await connection.execute(
      'SELECT likes FROM articles WHERE id = ?',
      [articleId]
    );
    likes = articleRows[0]?.likes || 0;
    
    return new Response(JSON.stringify({
      success: true,
      liked,
      likes
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Like article error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}

async function checkLiked(context) {
  const { request, env, params } = context;
  let connection;
  
  try {
    const articleId = params.id;
    
    const cookie = request.headers.get('Cookie') || '';
    const tokenMatch = cookie.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    
    if (!token) {
      return new Response(JSON.stringify({ liked: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    connection = await getConnection(env);
    
    const [sessionRows] = await connection.execute(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?',
      [token, Date.now()]
    );
    
    if (sessionRows.length === 0) {
      return new Response(JSON.stringify({ liked: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userId = sessionRows[0].user_id;
    
    const [likeRows] = await connection.execute(
      'SELECT id FROM likes WHERE article_id = ? AND user_id = ?',
      [articleId, userId]
    );
    
    return new Response(JSON.stringify({
      success: true,
      liked: likeRows.length > 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Check like error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
