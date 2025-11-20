# 変数
ARG WORK_DIR="/app/apps/admin"

ARG BUN_VERSION
ARG NODE_VERSION

FROM imbios/bun-node:${BUN_VERSION}-${NODE_VERSION}-debian AS base

ARG WORK_DIR
# コンテナのワーキングディレクトリをモノレポのルートに設定
WORKDIR /app

# モノレポのルートにある共通設定ファイル群をコピー
COPY package.json bun.lock turbo.json ./
COPY packages/ packages/

#このディレクトリの必要ファイルをコピー
COPY apps/admin/package.json apps/admin/tsconfig.json apps/admin/svelte.config.* apps/admin/vite.config.* apps/admin/

# admin のディレクトリに移動
WORKDIR ${WORK_DIR}

# --- 開発環境ランタイムステージ ---
FROM base AS development

ARG WORK_DIR
WORKDIR ${WORK_DIR}
CMD ["bun", "run", "dev"]

# CMD ["sleep", "infinity"]
