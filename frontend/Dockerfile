FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install
RUN chmod +x node_modules/react-scripts/bin/react-scripts.js

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 3000

CMD ["node", "node_modules/react-scripts/bin/react-scripts.js", "start"]