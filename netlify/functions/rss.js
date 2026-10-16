// Proxy de RSS server-side: segue redirects e devolve com CORS liberado.
// Usado pelo módulo de Notícias do dashboard (evita bloqueio de CORS do navegador).
exports.handler = async (event) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  const target = (event.queryStringParameters && event.queryStringParameters.url) || '';
  if (!/^https?:\/\//i.test(target)) {
    return { statusCode: 400, headers: cors, body: 'parametro url invalido' };
  }
  try {
    const res = await fetch(target, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrometeusNews/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
    });
    const text = await res.text();
    return {
      statusCode: 200,
      headers: {
        ...cors,
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=900',
      },
      body: text,
    };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: 'fetch falhou: ' + (e && e.message) };
  }
};
