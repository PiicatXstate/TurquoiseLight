import { getConnection } from '../../../db.js';

export default async function onRequestGet(context) {
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
      'SELECT id, title, content, annotations, author_name FROM articles WHERE id = ?',
      [articleId]
    );
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: '文章不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const article = rows[0];
    
    await connection.execute(
      'UPDATE articles SET downloads = downloads + 1 WHERE id = ?',
      [articleId]
    );
    
    const exportData = {
      version: '1.0',
      type: 'shared-article',
      exportedAt: Date.now(),
      article: {
        title: article.title,
        content: article.content,
        annotations: typeof article.annotations === 'string' ? JSON.parse(article.annotations) : article.annotations,
        author: article.author_name
      }
    };
    
    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(article.title)}.json"`
      }
    });
    
  } catch (error) {
    console.error('Download article error:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (connection) await connection.end();
  }
}
