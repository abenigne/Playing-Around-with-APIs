# Hourly Weather Planner

Shows the next 24 hours of weather for a city so you can plan your day. You can search, filter and sort the hours.

## Links
- **Live app (load balancer):** http://18.133.180.242
- **Web-01:** http://18.133.182.194
- **Web-02:** http://13.135.166.54
- **Demo video:** PASTE-VIDEO-LINK-HERE
- **Repo:** https://github.com/abenigne/Playing-Around-with-APIs

## Credentials
No API key or login is needed. Open-Meteo is free and keyless.

## Features
- City buttons (Kigali, Nairobi, Kampala, London) or custom coordinates
- 24 hours of temperature, humidity, wind and rain
- Search by hour, filter (rainy, windy, warm), sort by any metric
- Badge showing which server answered (Local-Dev, Web-01 or Web-02)
- Clear error messages for bad input, API timeout or API failure

## API used
[Open-Meteo](https://open-meteo.com/en/docs) (CC BY 4.0). Weather data by Open-Meteo.com.

## Run locally
```bash
git clone https://github.com/abenigne/Playing-Around-with-APIs.git
cd Playing-Around-with-APIs
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```
Open http://127.0.0.1:5000 (not Live Server).

## Deployment (Web-01 and Web-02)
Run on each web server (use `SERVER_NAME=Web-02` on the second one):
```bash
sudo apt update
sudo apt install -y python3-pip python3-venv nginx git ufw curl
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
cd /var/www
sudo git clone https://github.com/abenigne/Playing-Around-with-APIs.git forecast-app
sudo chown -R $USER:$USER /var/www/forecast-app
cd forecast-app
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
printf 'SERVER_NAME=Web-01\n' > .env
```
- **systemd service** `/etc/systemd/system/forecast.service` runs Gunicorn:
  `ExecStart=/var/www/forecast-app/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 app:app`
  with `WorkingDirectory=/var/www/forecast-app` and `EnvironmentFile=/var/www/forecast-app/.env`.
  Then: `sudo systemctl daemon-reload` and `sudo systemctl enable --now forecast`.
- **Nginx** `/etc/nginx/sites-available/forecast`: `listen 80;` and `location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }`.
  Enable it, remove the default site, run `sudo nginx -t`, then `sudo systemctl restart nginx`.

## Load balancer (Lb-01)
Install nginx and ufw, then create `/etc/nginx/sites-available/loadbalancer`:
```nginx
upstream forecast_cluster {
    server 18.133.182.194:80;
    server 13.135.166.54:80;
}
server {
    listen 80;
    location / {
        proxy_pass http://forecast_cluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Enable the site, remove the default, run `sudo nginx -t` and `sudo systemctl restart nginx`.

**Test:**
```bash
for i in {1..6}; do curl -s http://18.133.180.242/api/forecast | grep -o '"node_identity": *"[^"]*"'; done
```
Result: Web-01 and Web-02 alternate, so traffic is shared between both servers.

## Challenges
- **Live Server instead of Flask:** the page showed raw template text. Fixed by opening http://127.0.0.1:5000.
- **Empty table:** typos in `script.js` were hidden by a catch-all error message. The browser Console showed the real error.
- **SSH key problems:** I had keys in Git Bash and WSL. I found the one the servers accepted and used `ssh -i`.
- **Servers rebuilt:** new IP addresses meant updating the load balancer config.



## Credits
Open-Meteo (weather data), Flask, Requests, python-dotenv, Gunicorn, Nginx.
