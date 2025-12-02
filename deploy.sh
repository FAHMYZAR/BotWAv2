#!/bin/bash

echo "🚀 Deploying FAHMYZZX-BotWA..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Pull latest image from Docker Hub
echo "📥 Pulling latest image..."
sudo docker pull fahmyzzx/botwa:latest

# Stop old containers
echo "🛑 Stopping old containers..."
sudo docker-compose down

# Start services
echo "▶️ Starting services..."
sudo docker-compose up -d

# Show logs
echo "📋 Showing logs..."
sudo docker-compose logs -f
