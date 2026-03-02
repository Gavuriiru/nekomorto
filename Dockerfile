FROM node:24.13.0-bookworm-slim AS base

WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

ARG APP_COMMIT_SHA=""
ARG APP_BUILD_TIME=""
ARG VITE_APP_COMMIT_SHA=""
ARG VITE_APP_BUILD_TIME=""

ENV VITE_APP_COMMIT_SHA=${VITE_APP_COMMIT_SHA}
ENV VITE_APP_BUILD_TIME=${VITE_APP_BUILD_TIME}

COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM base AS runtime

ARG APP_COMMIT_SHA=""
ARG APP_BUILD_TIME=""
ARG VITE_APP_COMMIT_SHA=""
ARG VITE_APP_BUILD_TIME=""

ENV NODE_ENV=production
ENV PORT=8080
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV APP_BUILD_TIME=${APP_BUILD_TIME}
ENV VITE_APP_COMMIT_SHA=${VITE_APP_COMMIT_SHA}
ENV VITE_APP_BUILD_TIME=${VITE_APP_BUILD_TIME}

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/public/uploads && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "server/index.js"]
