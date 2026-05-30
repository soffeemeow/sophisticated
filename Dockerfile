FROM node:22-alpine AS build
WORKDIR /build

RUN apk add python3 make g++ && corepack enable

COPY package*.json pnpm*.yaml tsconfig.json buf.gen.yaml ./
RUN pnpm install --frozen-lockfile

COPY src ./src
COPY proto ./proto
RUN pnpm run build && pnpm prune --prod

FROM node:22-alpine AS final

ARG USERNAME=sophisticated
ARG USER_UID=967
ARG USER_GID=$USER_UID

RUN adduser -D -u $USER_UID -h /app $USERNAME $USER_GID

RUN mkdir /data && chown $USERNAME:$USERNAME /data
VOLUME /data

USER $USERNAME

WORKDIR /app
COPY --from=build /build/package*.json ./
COPY --from=build /build/dist ./dist
COPY --from=build /build/node_modules ./node_modules

ENTRYPOINT [ "docker-entrypoint.sh", "node", "dist/main.js" ]