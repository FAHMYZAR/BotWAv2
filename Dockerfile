FROM oven/bun:1-alpine

# Install runtime dependencies including Sharp requirements and FFmpeg with x264
RUN apk add --no-cache \
    gcompat \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    ffmpeg \
    ffmpeg-libs \
    x264-libs \
    x264 \
    util-linux-dev \
    vips-dev \
    build-base \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using Bun
RUN bun install

# Copy application code
COPY src ./src
COPY disk ./disk

# Copy only required files (WhatsApp session)
COPY baileys_store.json ./baileys_store.json

# Set environment
ENV NODE_ENV=production

# Run bot
CMD ["bun", "run", "src/index.js"]
