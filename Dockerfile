FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# docker build --target test .  -> échoue si typecheck/tests unitaires échouent (utilisé par le hook pre-commit)
FROM node:22-alpine AS test
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY . .
RUN npm run typecheck && npm test

# docker compose -f docker-compose.yml -f docker-compose.dev.yml : rechargement à chaud
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm","run","dev"]

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node","dist/index.js"]
