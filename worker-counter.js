export default {
  async fetch(request, env) {
    const count = await env.VISITOR_COUNT.get('count') || '0';
    const newCount = parseInt(count) + 1;
    await env.VISITOR_COUNT.put('count', newCount.toString());
    
    const origin = request.headers.get('Origin');
    const allowedOrigin = origin?.endsWith('.kiquetal.dev') || 
                          origin === 'https://kiquetal.dev' ||
                          origin?.includes('localhost')
      ? origin 
      : 'https://kiquetal.dev';
    
    return new Response(JSON.stringify({ visitors: newCount }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin
      }
    });
  }
};
