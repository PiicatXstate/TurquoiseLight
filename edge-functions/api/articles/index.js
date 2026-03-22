import { getConnection, generateId } from '../../db.js';

export default async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  
  if (method === 'GET') {
    return getArticles(context);
  } else if (method === 'POST') {
    return createArticle(context);
  }
  
  return new Response(JSON.stringify({ error: '方法不允许' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getArticles(context) {
  const { request, env } = context;
  let connection;
  
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    connection = await getConnection(env);
    
    const [countRows] = await connection.execute('SELECT COUNT(*) as total FROM articles');
    const total = countRows[0].total;
    
    const [rows] = await connection.execute(
      `SELECT id, title, author_name, author_id, 
        LEFT(content, 150) as preview, 
        JSON_LENGTH(annotations) as annotation_count,
        likes, downloads, created_at 
       FROM articles 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    
    const articles = rows.map(row => ({
      id: row.id,
      title: row.title,
      author: row.author_name,
      authorId: row.author_id,
      preview: row.preview,
      annotationCount: row.annotation_count || 0,
      likes: row.likes,
      downloads: row.downloads,
      createdAt: row.created_at
    }));
    
    return new Response(JSON.stringify({
      success: true,
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Get articles error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}

async function createArticle(context) {
  const { request, env } = context;
  let connection;
  
  try {
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
      'SELECT user_id, username FROM sessions WHERE token = ? AND expires_at > ?',
      [token, Date.now()]
    );
    
    if (sessionRows.length === 0) {
      return new Response(JSON.stringify({ error: '会话已过期' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const session = sessionRows[0];
    
    const body = await request.json();
    const { title, content, annotations } = body;
    
    if (!title || !content) {
      return new Response(JSON.stringify({ error: '标题和内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const articleId = generateId();
    const now = Date.now();
    
    await connection.execute(
      `INSERT INTO articles (id, title, content, annotations, author_id, author_name, likes, downloads, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [articleId, title, content, JSON.stringify(annotations || []), session.user_id, session.username, now, now]
    );
    
    return new Response(JSON.stringify({
      success: true,
      article: {
        id: articleId,
        title,
        author: session.username,
        createdAt: now
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Create article error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
