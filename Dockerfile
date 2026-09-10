# Stage 1: Build Backend
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/tsconfig*.json backend/nest-cli.json ./
COPY backend/src/ ./src/

RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY frontend/ ./frontend/
COPY data/ ./data/

EXPOSE 8080

CMD ["node", "dist/main.js"]
