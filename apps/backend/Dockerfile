FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --workspace @crm/backend --include-workspace-root

FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libstdc++
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libstdc++
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["node", "dist/main.js"]
