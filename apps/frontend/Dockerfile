FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install --workspace @crm/frontend --include-workspace-root

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CRM_URL
ARG CRM_DOMAIN
ARG API_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CRM_URL=$NEXT_PUBLIC_CRM_URL
ENV CRM_DOMAIN=$CRM_DOMAIN
ENV API_DOMAIN=$API_DOMAIN
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CRM_URL
ARG CRM_DOMAIN
ARG API_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CRM_URL=$NEXT_PUBLIC_CRM_URL
ENV CRM_DOMAIN=$CRM_DOMAIN
ENV API_DOMAIN=$API_DOMAIN
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
