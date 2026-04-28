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

## Nginx Configuration
The `nginx/sync.cardledger.io.conf` file contains the production reverse proxy settings required for Server-Sent Events to bypass buffering.

To apply updates to the VPS:
1. `sudo apt install nginx certbot python3-certbot-nginx -y`
2. `sudo nano /etc/nginx/sites-available/sync.cardledger.io`
3. Paste conf
4. `sudo cp sync-server/nginx/sync.cardledger.io.conf /etc/nginx/sites-available/sync.cardledger.io`
5. `sudo nginx -t` (Verify syntax)
6. `sudo systemctl reload nginx` (Apply gracefully)
7. `sudo certbot --nginx -d sync.cardledger.io`