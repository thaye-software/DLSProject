FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Applies pending migrations before starting; prisma migrate deploy is a no-op when the schema is current.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
