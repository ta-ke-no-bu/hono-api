ARG BUN_VERSION
ARG NODE_VERSION

FROM imbios/bun-node:${BUN_VERSION}-${NODE_VERSION}-debian

WORKDIR /app

# Playwright がブラウザを実行するために必要な依存関係をインストール
RUN apt-get update && apt-get install -y \
    libnspr4 \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install

CMD ["bun", "run", "dev"]