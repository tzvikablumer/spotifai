FROM node:20-alpine

WORKDIR /app

# Install Python (for lyrics alignment script)
RUN apk add --no-cache python3 py3-pip

COPY package*.json ./
RUN npm ci --production

COPY . .

# Install Python dependencies for alignment
RUN pip3 install --break-system-packages stable-ts 2>/dev/null || true

# Create data directories
RUN mkdir -p /data/tracks /data/covers

ENV PORT=3000
ENV MUSIC_DIR=/data/tracks
ENV COVERS_DIR=/data/covers
ENV DB_PATH=/data/dreamify.db
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
