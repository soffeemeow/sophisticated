FROM node:22-alpine AS build
WORKDIR /build

RUN apk add python3 make g++ && corepack enable

COPY pnpm*.yaml ./
COPY packages ./packages
COPY proto ./proto

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
RUN pnpm -r build
RUN pnpm --filter=bot --legacy --prod deploy /build/pruned

FROM node:22-alpine AS final

ARG USERNAME=sophisticated
ARG USER_UID=967
ARG USER_GID=$USER_UID

RUN adduser -D -u $USER_UID -h /app $USERNAME $USER_GID

RUN mkdir /data && chown $USERNAME:$USERNAME /data
VOLUME /data

USER $USERNAME

WORKDIR /app
COPY --from=build /build/pruned/package*.json ./
COPY --from=build /build/pruned/dist ./dist
COPY --from=build /build/pruned/node_modules ./node_modules

ENTRYPOINT [ "docker-entrypoint.sh", "node", "dist/main.js" ]