export default function onRequest(context) {
  return new Response(JSON.stringify({
    message: 'Turquoise API is running',
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
