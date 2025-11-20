ARG WORK_DIR="/app/apps/api"

ARG BUN_VERSION
ARG NODE_VERSION

FROM imbios/bun-node:${BUN_VERSION}-${NODE_VERSION}-debian AS base

ARG WORK_DIR
# コンテナのワーキングディレクトリをモノレポのルートに設定
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY packages/ packages/

#このディレクトリの必要ファイルをコピー
COPY apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts apps/api/

# api のディレクトリに移動
WORKDIR ${WORK_DIR}

# --- 開発環境ランタイムステージ ---
FROM base AS development

ARG WORK_DIR
WORKDIR ${WORK_DIR}
CMD ["bun", "run", "dev"]

# CMD ["sleep", "infinity"]
