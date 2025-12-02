
# Build
sudo docker build -t fahmyzzx/botwa:latest .

# Login
docker login

# Push
sudo docker push fahmyzzx/botwa:latest

Copy
bash
Cara deploy:

docker-compose up -d