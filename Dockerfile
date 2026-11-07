FROM node:24-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY examples/checkout-demo/package.json examples/checkout-demo/package.json
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./

EXPOSE 3000
CMD ["node", "server.js"]
