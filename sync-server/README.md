# CardLedger Sync Tower
This runs on the VPS to hold open a Postgres connection and broadcast SSE pings.

## Deployment
1. SSH into VPS.
2. `mkdir ~/sync-server`
3. `cd sync-server`
3. `npm init -y`
4. `npm install pg`
5. `touch server.js`
6. `nano server.js`
7. Paste server.js
8. `npm install -g pm2`
9. `DATABASE_URL="postgres://user:pass@127.0.0.1:5432/cardledger" pm2 start server.js --name "sync-tower"`
10. `sudo ufw allow 8080/tcp`
11. `pm2 logs sync-tower`