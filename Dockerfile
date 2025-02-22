FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npx drizzle-kit generate --dialect sqlite --schema ./server/db/schema.ts --out init

RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/init ./dist/init

COPY config/config.example.yml ./dist/config.example.yml
COPY server/db/names.json ./dist/names.json

COPY public ./public

CMD ["npm", "start"]
