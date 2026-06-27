FROM node:22-alpine

RUN apk add --no-cache chromium

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "src/server.js"]
