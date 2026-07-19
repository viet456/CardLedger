FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY server.js .
EXPOSE 8080
CMD ["node", "server.js"]