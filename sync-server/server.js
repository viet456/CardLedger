const http = require('http');
const { Client } = require('pg');

const clients = new Map();
// Run with:
// DATABASE_URL="xxx" pm2 start server.js --name "sync-tower"

// MUST bypass PgBouncer. Connect directly to raw Postgres (eg port 5432)
const pgClient = new Client({
    connectionString: process.env.DATABASE_URL 
});

async function startServer() {
    await pgClient.connect();
    console.log('🔗 Connected to Postgres directly');

    await pgClient.query('LISTEN sync_channel');

    pgClient.on('notification', (msg) => {
        const updatedUserId = msg.payload;
        console.log(`📡 Database changed for user: ${updatedUserId}`);

        const userConnections = clients.get(updatedUserId);
        if (userConnections) {
            userConnections.forEach(res => {
                res.write(`data: {"type": "SYNC_REQUIRED"}\n\n`);
            });
        }
    });

    pgClient.on('error', (err) => {
        console.error('Postgres connection error:', err);
        process.exit(1); // let PM2 restart it
    });

    const server = http.createServer((req, res) => {
        // CORS: Allow any browser, any origin
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Connection');

        // Intercept Chrome's invisible Preflight request and give it approval
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }
        
        if (req.url.startsWith('/stream')) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const userId = url.searchParams.get('userId');

            if (!userId) {
                res.writeHead(400);
                return res.end('Missing userId');
            }

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            if (!clients.has(userId)) clients.set(userId, new Set());
            clients.get(userId).add(res);

            console.log(`💻 Browser connected! User ID: ${userId}. Total connections: ${clients.get(userId).size}`);

            const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);

            req.on('close', () => {
                clearInterval(heartbeat);
                clients.get(userId).delete(res);
                if (clients.get(userId).size === 0) clients.delete(userId);
                console.log(`❌ Browser disconnected. User ID: ${userId}`);
            });

            // Catch violent disconnects (Sleep mode, Wi-Fi drops)
            req.on('error', () => {
                clearInterval(heartbeat);
                clients.get(userId).delete(res);
                if (clients.get(userId).size === 0) clients.delete(userId);
                console.log(`⚠️ Browser connection dropped violently. User ID: ${userId}`);
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(8080, '0.0.0.0', () => {
        console.log('📻 SSE Radio Tower listening on port 8080');
    });
}

startServer();
