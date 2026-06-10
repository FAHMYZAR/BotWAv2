
# Build
sudo docker build -t fahmyzzx/botwav2:latest .

# Login
docker login

# Push
sudo docker push fahmyzzx/botwav2:latest

Copy
bash
Cara deploy:

docker-compose up -d