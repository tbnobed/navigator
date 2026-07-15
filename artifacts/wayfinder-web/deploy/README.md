# Deploying Wayfinder Web on your Ubuntu server (Docker)

The container runs a small Node server that serves the built app **and** the
admin/sites API. Sites you create in the admin portal (JSON + uploaded floor
plans) are stored in a Docker volume, so they survive rebuilds and updates.

## 1. Get the code onto the server

Copy the whole project folder (it's a pnpm monorepo; the app depends on the
workspace root files) to the server, e.g. with git or:

```bash
rsync -a --exclude node_modules ./ user@your-server:~/wayfinder/
```

## 2. Build & run

On the server, from the project root:

```bash
ADMIN_PASSWORD=your-strong-password \
  docker compose -f artifacts/wayfinder-web/deploy/docker-compose.yml up -d --build
```

`ADMIN_PASSWORD` is **required** — it protects the admin portal at `/admin`.
The container refuses to start without it.

The app is now on port **8080** (change the mapping in `docker-compose.yml`).

Or without compose:

```bash
docker build -f artifacts/wayfinder-web/deploy/Dockerfile -t wayfinder-web .
docker run -d -p 8080:3000 --restart unless-stopped \
  -e ADMIN_PASSWORD=your-strong-password \
  -v wayfinder-data:/data \
  --name wayfinder wayfinder-web
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
    client_max_body_size 20m;   # floor-plan image uploads
}
```

(Any equivalent works too: Caddy, Traefik, or Cloudflare in front.)

## 4. Create your sites

Open `https://wayfinder.example.com/admin`, sign in with your admin password,
create a site, upload its floor plan, set the scale, then place entrances,
destinations and walkable paths. Publish when the checklist is green.

## 5. Print the QR codes

Open `https://wayfinder.example.com/qr` **on the deployed site** and print
the posters from there — the QR codes encode the URL of the site they're
generated on, so they'll point at your server. Published admin-created sites
appear automatically alongside the built-in demo site.

## Backups

All admin-created data lives in the `wayfinder-data` volume:

```bash
docker run --rm -v wayfinder-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/wayfinder-data.tgz -C /data .
```

## Updating

Pull/copy the new code, then rebuild:

```bash
ADMIN_PASSWORD=your-strong-password \
  docker compose -f artifacts/wayfinder-web/deploy/docker-compose.yml up -d --build
```

Your sites and floor plans are kept (they live in the volume, not the image).
