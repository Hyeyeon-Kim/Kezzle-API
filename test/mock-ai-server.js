const http = require('http');
const similarCakes = require('./fixtures/similar-cakes.mock.json');

const port = Number(process.env.MOCK_AI_PORT || 4001);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/vit/cakes/similar-search') {
    const size = Number(url.searchParams.get('size'));
    const result = Number.isNaN(size)
      ? similarCakes.result
      : similarCakes.result.slice(0, size);

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify({ result }));
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify({ message: 'Not found' }));
});

server.listen(port, () => {
  console.log(`Mock AI server listening on http://localhost:${port}`);
});
