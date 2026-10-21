# ── Stage 1: Build Frontend ──────────────────────────────────────────────────
# node:20-slim (glibc/Debian) thay vì -alpine (musl): lockfile hiện tại thiếu
# field "libc" cho các optional deps của lightningcss/@tailwindcss/oxide nên
# npm ci trên Alpine không cài đúng binary native — glibc tránh được vấn đề này.
FROM node:24-bookworm-slim AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps

# Copy source code & build static site
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:stable-alpine

# Copy built dist files to nginx html root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
