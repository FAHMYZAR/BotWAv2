FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    gcompat \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    ffmpeg \
    util-linux-dev

WORKDIR /app

# Copy node_modules first (layer besar, jarang berubah)
COPY node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Copy application code (sering berubah)
COPY src ./src
COPY keynoteDB.js ./
COPY disk ./disk

# Set environment
ENV NODE_ENV=production

# Run bot
CMD ["node", "src/index.js"]
