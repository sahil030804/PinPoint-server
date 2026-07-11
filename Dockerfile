FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache chromium
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

FROM node:22-alpine
RUN apk add --no-cache chromium
WORKDIR /app
COPY --from=builder /app ./
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_OPTIONS=--dns-result-order=ipv4first
EXPOSE 4000
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
