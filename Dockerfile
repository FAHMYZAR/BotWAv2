FROM node:20-alpine

# Install runtime dependencies including Sharp requirements
RUN apk add --no-cache \
    gcompat \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    ffmpeg \
    util-linux-dev \
    vips-dev \
    build-base \
    python3 \
    make \
    g++

WORKDIR /app

# Copy node_modules first (layer besar, jarang berubah)
COPY node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Install Sharp for Alpine Linux
RUN npm install --platform=linux --arch=x64 --libc=musl sharp

# Copy application code (sering berubah)
COPY src ./src
COPY keynoteDB.js ./
COPY disk ./disk

# Set environment
ENV NODE_ENV=production

# Run bot
CMD ["node", "src/index.js"]
