#!/bin/bash

echo "🔨 Building and Pushing to Docker Hub..."

# Build bot
echo "📦 Building bot image..."
docker build -t fahmyzzx/botwav2:latest .

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Login to Docker Hub
echo "🔑 Logging in to Docker Hub..."
docker login

if [ $? -ne 0 ]; then
    echo "❌ Login failed!"
    exit 1
fi

# Push to Docker Hub
echo "⬆️ Pushing bot to Docker Hub..."
docker push fahmyzzx/botwav2:latest

if [ $? -ne 0 ]; then
    echo "❌ Push failed!"
    exit 1
fi

echo ""
echo "✅ Done! Image pushed to Docker Hub"
echo ""
echo "📋 Image:"
echo "  - fahmyzzx/botwav2:latest"
echo ""
echo "🚀 Deploy command:"
echo "  docker pull fahmyzzx/botwav2:latest"
echo "  docker compose up -d"
