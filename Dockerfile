FROM node:22-alpine AS deps
WORKDIR /app
# Only the manifests, so a source change does not reinstall every package.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Config is read at run time, not baked in — see docs/PANEL.md. What this build needs
# is a value that lets the pages compile; the real one arrives from the environment.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone output carries its own minimal node_modules; the static assets are not
# traced into it and have to come along separately.
#
# There is no public/ to copy: the favicon and the icon live under app/, through Next's
# file conventions, and are emitted into the build.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# node:alpine ships a `node` user at uid 1000.
USER node
EXPOSE 3000

CMD ["node", "server.js"]
