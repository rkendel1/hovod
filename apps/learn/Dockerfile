FROM node:22-bookworm-slim AS base
WORKDIR /app/apps/learn

COPY apps/learn/package.json apps/learn/package-lock.json ./
COPY packages/contracts /app/packages/contracts
RUN npm ci

COPY apps/learn ./
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
