# API and worker image (one image, two commands). Build from the repository root:
#   docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so code changes do not reinstall them. The schema is needed by
# "prisma generate", which runs after install.
COPY package.json package-lock.json ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
COPY --chown=node:node packages/shared/package.json packages/shared/package.json
COPY --chown=node:node apps/api/prisma apps/api/prisma
# --include=dev: the API runs TypeScript with tsx, and migrations use the prisma CLI
RUN npm ci --include=dev -w @briefklar/api -w @briefklar/shared --include-workspace-root \
  && npm cache clean --force

COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/shared packages/shared
COPY --chown=node:node apps/api apps/api

RUN mkdir -p /data/uploads && chown -R node:node /data
ENV UPLOAD_DIR=/data/uploads
USER node

WORKDIR /app/apps/api
EXPOSE 4000
# The worker runs the same image with: npm run start:worker
CMD ["npm", "run", "start"]
