import { getConnection } from '../../db.js';

export default async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  
  if (method === 'GET') {
    return getArticle(context);
  } else if (method === 'DELETE') {
    return deleteArticle(context);
  }
  
  return new Response(JSON.stringify({ error: '方法不允许' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getArticle(context) {
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
    
    connection = await getConnection(env);
    
    const [rows] = await connection.execute(
      'SELECT id, title, content, annotations, author_id, author_name, likes, downloads, created_at FROM articles WHERE id = ?',
      [articleId]
    );
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: '文章不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const article = rows[0];
    
    return new Response(JSON.stringify({
      success: true,
      article: {
        id: article.id,
        title: article.title,
        content: article.content,
        annotations: typeof article.annotations === 'string' ? JSON.parse(article.annotations) : article.annotations,
        author: article.author_name,
        authorId: article.author_id,
        likes: article.likes,
        downloads: article.downloads,
        createdAt: article.created_at
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Get article error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}

async function deleteArticle(context) {
  const { request, env, params } = context;
  let connection;
  
  try {
    const articleId = params.id;
    
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
    
    const [articleRows] = await connection.execute(
      'SELECT author_id FROM articles WHERE id = ?',
      [articleId]
    );
    
    if (articleRows.length === 0) {
      return new Response(JSON.stringify({ error: '文章不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (articleRows[0].author_id !== userId) {
      return new Response(JSON.stringify({ error: '无权删除此文章' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await connection.execute('DELETE FROM articles WHERE id = ?', [articleId]);
    await connection.execute('DELETE FROM likes WHERE article_id = ?', [articleId]);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Delete article error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
