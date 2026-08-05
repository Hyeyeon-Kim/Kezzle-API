const http = require('http');
const similarCakes = require('./fixtures/similar-cakes.mock.json');

const port = Number(process.env.MOCK_AI_PORT || 4001);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const delayMs = Number(url.searchParams.get('delayMs') || 0);

  const sendJson = (statusCode, payload) => {
    const respond = () => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(JSON.stringify(payload));
    };
    if (Number.isFinite(delayMs) && delayMs > 0) {
      setTimeout(respond, delayMs);
      return;
    }
    respond();
  };

  if (req.method === 'GET' && url.pathname === '/vit/cakes/similar-search') {
    const size = Number(url.searchParams.get('size'));
    const result = Number.isNaN(size)
      ? similarCakes.result
      : similarCakes.result.slice(0, size);

    sendJson(200, { result });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/clip/cakes/ko-search') {
    const size = Number(url.searchParams.get('size'));
    const result = Number.isNaN(size)
      ? similarCakes.result
      : similarCakes.result.slice(0, size);

    sendJson(200, { result });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/clip/cakes/ko-search-page') {
    const size = Number(url.searchParams.get('size'));
    const page = Number(url.searchParams.get('page'));
    const result = Number.isNaN(size)
      ? similarCakes.result
      : similarCakes.result.slice(0, size);

    sendJson(200, {
      result,
      nextPage: Number.isFinite(page) ? page + 1 : 1,
      isLastPage: true,
    });
    return;
  }

  sendJson(404, { message: 'Not found' });
});

server.listen(port, () => {
  console.log(`Mock AI server listening on http://localhost:${port}`);
});
