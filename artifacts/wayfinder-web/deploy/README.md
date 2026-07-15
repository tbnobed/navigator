# Deploying Wayfinder Web on your Ubuntu server (Docker)

The app is a fully static single-page app — no backend, no database. The
container just serves the built files with nginx.

## 1. Get the code onto the server

Copy the whole project folder (it's a pnpm monorepo; the app depends on the
workspace root files) to the server, e.g. with git or:

```bash
rsync -a --exclude node_modules ./ user@your-server:~/wayfinder/
```

## 2. Build & run

On the server, from the project root:

```bash
docker compose -f artifacts/wayfinder-web/deploy/docker-compose.yml up -d --build
```

The app is now on port **8080** (change the mapping in `docker-compose.yml`).

Or without compose:

```bash
docker build -f artifacts/wayfinder-web/deploy/Dockerfile -t wayfinder-web .
docker run -d -p 8080:80 --restart unless-stopped --name wayfinder wayfinder-web
```

## 3. HTTPS is REQUIRED

iPhone Safari only allows the compass, motion sensors, and camera on
**HTTPS** pages. Plain `http://your-server:8080` will load, but navigation
won't work. Put a TLS reverse proxy in front — the standard setup:

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d wayfinder.example.com
```

Then proxy your domain to the container in the host nginx config:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
}
```

(Any equivalent works too: Caddy, Traefik, or Cloudflare in front.)

## 4. Print the QR codes

Open `https://wayfinder.example.com/qr` **on the deployed site** and print
the posters from there — the QR codes encode the URL of the site they're
generated on, so they'll point at your server.

## Updating

Pull/copy the new code, then re-run the compose command — it rebuilds and
restarts in place.
