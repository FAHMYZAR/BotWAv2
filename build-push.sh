#!/bin/bash

echo "🔨 Building and Pushing to Docker Hub..."

# Build bot
echo "📦 Building bot image..."
sudo docker build -t fahmyzzx/botwa:latest .

# Push to Docker Hub
echo "⬆️ Pushing bot to Docker Hub..."
sudo docker push fahmyzzx/botwa:latest

echo "✅ Done! Image pushed to Docker Hub"
echo ""
echo "📋 Image:"
echo "  - fahmyzzx/botwa:latest"
