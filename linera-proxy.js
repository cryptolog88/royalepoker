import http from 'http';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({});
const PORT = 8081;
const TARGET = 'http://localhost:8080';

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    proxy.web(req, res, { target: TARGET }, (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(502);
        res.end('Bad Gateway');
    });
});

server.listen(PORT, () => {
    console.log(`CORS Proxy running on http://localhost:${PORT} -> ${TARGET}`);
});
