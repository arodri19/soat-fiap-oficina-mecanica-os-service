# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
# instala todas as deps (incluindo devDeps para o prisma generate)
RUN npm ci

COPY prisma ./prisma
# gera o Prisma Client no stage de build
RUN npx prisma generate

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:24-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# copia apenas as deps de produção
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# copia o cliente Prisma gerado, schema e CLI (necessários para migrate + queries)
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /usr/src/app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /usr/src/app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY prisma ./prisma

# copia o código da aplicação
COPY src ./src

# garante que o usuário node pode escrever nas engines do Prisma em runtime
RUN chown -R node:node /usr/src/app

USER node

EXPOSE 4000

CMD ["node", "src/index.js"]
