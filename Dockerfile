# syntax=docker/dockerfile:1
#
# Runtime image for the resume optimizer.
# Multi-stage is unnecessary here: the service has no build step, so the runtime
# image only needs production dependencies and the two source files.

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Install only what the server needs at runtime (extractors are optional at
# require-time, but installing them means PDF / DOCX / OCR uploads work).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server.js prompt.js ./
COPY public ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
