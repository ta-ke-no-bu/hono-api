# 変数
ARG WORK_DIR="/app/apps/web"

ARG BUN_VERSION
ARG NODE_VERSION

##### ベース ######################################################
FROM imbios/bun-node:${BUN_VERSION}-${NODE_VERSION}-debian AS base

ARG WORK_DIR
# コンテナのワーキングディレクトリをモノレポのルートに設定
WORKDIR /app


# モノレポのルートにある共通設定ファイル群をコピー
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY packages/ packages/

#このディレクトリの必要ファイルをコピー
COPY apps/web/package.json apps/web/tsconfig.json apps/web/svelte.config.* apps/web/vite.config.* apps/web/

RUN bun install

##### 開発環境 ######################################################
FROM base AS development

# 一回build
# RUN bun run build

ARG WORK_DIR
WORKDIR ${WORK_DIR}
RUN bun install
CMD ["bun", "run", "start"]

# CMD ["tail", "-f", "/dev/null"]
