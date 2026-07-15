/**
 * Wayfinder admin + sites API.
 *
 * Dev:  runs next to the vite dev server (see the `dev` script); vite proxies
 *       `<BASE_PATH>api/*` here.
 * Prod: run with SERVE_STATIC=1 — serves the built frontend from dist/public
 *       and the API from the same port (see deploy/).
 *
 * Storage is plain files under the data dir (JSON + uploaded images) so the
 * Docker deployment only needs a mounted volume, no database.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { validateStoredSite, type StoredSite } from '../src/lib/siteTypes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');

const SERVE_STATIC = process.env.SERVE_STATIC === '1';
const PORT = SERVE_STATIC
  ? Number(process.env.PORT || 3000)
  : Number(process.env.WAYFINDER_API_PORT || 8790);

const DATA_DIR = process.env.WAYFINDER_DATA_DIR || path.join(PKG_ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) {
  if (process.env.NODE_ENV === 'production' || SERVE_STATIC) {
    console.error('FATAL: ADMIN_PASSWORD environment variable must be set in production.');
    process.exit(1);
  }
  console.warn('[wayfinder] ADMIN_PASSWORD not set — using development default password "admin".');
}
const effectivePassword = ADMIN_PASSWORD || 'admin';

// Per-session random tokens (in-memory). Restarting the server signs everyone out.
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const sessions = new Map<string, number>(); // token -> expiry epoch ms

function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  // Opportunistic cleanup.
  for (const [t, exp] of sessions) if (exp < Date.now()) sessions.delete(t);
  return token;
}

// Admin surface should only ever be used over HTTPS in production.
const COOKIE_SECURE = process.env.NODE_ENV === 'production' || SERVE_STATIC;
const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${COOKIE_SECURE ? '; Secure' : ''}`;

// ---------- storage ----------

function loadSites(): StoredSite[] {
  try {
    const raw = fs.readFileSync(SITES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSites(sites: StoredSite[]) {
  const tmp = SITES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sites, null, 2));
  fs.renameSync(tmp, SITES_FILE);
}

// ---------- auth helpers ----------

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function isAuthed(req: express.Request): boolean {
  const cookie = parseCookies(req.headers.cookie)['wf_admin'];
  if (!cookie) return false;
  const expiry = sessions.get(cookie);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(cookie);
    return false;
  }
  return true;
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

// ---------- app ----------

const app = express();
app.use(express.json({ limit: '2mb' }));

// Simple login rate limiting.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.resetAt && entry.count >= 10) {
    res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    return;
  }
  const password = String(req.body?.password ?? '');
  const expected = Buffer.from(effectivePassword);
  const given = Buffer.from(password);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) {
    const cur = entry && now < entry.resetAt ? entry : { count: 0, resetAt: now + 60_000 };
    cur.count += 1;
    loginAttempts.set(ip, cur);
    res.status(401).json({ error: 'Wrong password' });
    return;
  }
  loginAttempts.delete(ip);
  res.setHeader(
    'Set-Cookie',
    `wf_admin=${createSession()}; ${cookieAttrs}; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  const cookie = parseCookies(req.headers.cookie)['wf_admin'];
  if (cookie) sessions.delete(cookie);
  res.setHeader('Set-Cookie', `wf_admin=; ${cookieAttrs}; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ authenticated: isAuthed(req) });
});

// Public: published, navigable sites for the visitor app.
app.get('/api/sites', (_req, res) => {
  const sites = loadSites().filter((s) => s.published && s.imageFile);
  res.json({ sites });
});

app.get('/api/admin/sites', requireAdmin, (_req, res) => {
  res.json({ sites: loadSites() });
});

app.post('/api/admin/sites', requireAdmin, (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const sites = loadSites();
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site';
  if (!/^[a-z0-9]/.test(base)) base = 's' + base;
  let id = base;
  let n = 2;
  while (sites.some((s) => s.id === id) || id === 'studios') id = `${base}-${n++}`;
  const now = new Date().toISOString();
  const site: StoredSite = {
    id,
    name,
    imageFile: null,
    imageWidth: 0,
    imageHeight: 0,
    metersPerPixel: 0.05,
    nodes: [],
    edges: [],
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  sites.push(site);
  saveSites(sites);
  res.status(201).json({ site });
});

app.get('/api/admin/sites/:id', requireAdmin, (req, res) => {
  const site = loadSites().find((s) => s.id === req.params.id);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  res.json({ site });
});

app.put('/api/admin/sites/:id', requireAdmin, (req, res) => {
  const sites = loadSites();
  const idx = sites.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const incoming = { ...req.body, id: sites[idx].id, createdAt: sites[idx].createdAt };
  if (!validateStoredSite(incoming)) {
    res.status(400).json({ error: 'Invalid site data' });
    return;
  }
  // Only allow image files this site actually uploaded.
  if (incoming.imageFile !== null && !incoming.imageFile.startsWith(`${incoming.id}-`)) {
    res.status(400).json({ error: 'Invalid image reference' });
    return;
  }
  if (
    incoming.posterLogoFile !== undefined &&
    incoming.posterLogoFile !== null &&
    !incoming.posterLogoFile.startsWith(`${incoming.id}-logo-`)
  ) {
    res.status(400).json({ error: 'Invalid logo reference' });
    return;
  }
  // Remove the stored logo file if the site no longer references it.
  const prevLogo = sites[idx].posterLogoFile;
  if (prevLogo && incoming.posterLogoFile !== prevLogo) {
    fs.rm(path.join(UPLOADS_DIR, path.basename(prevLogo)), { force: true }, () => {});
  }
  incoming.updatedAt = new Date().toISOString();
  sites[idx] = incoming;
  saveSites(sites);
  res.json({ site: incoming });
});

app.delete('/api/admin/sites/:id', requireAdmin, (req, res) => {
  const sites = loadSites();
  const site = sites.find((s) => s.id === req.params.id);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  saveSites(sites.filter((s) => s.id !== req.params.id));
  if (site.imageFile) {
    fs.rm(path.join(UPLOADS_DIR, path.basename(site.imageFile)), { force: true }, () => {});
  }
  if (site.posterLogoFile) {
    fs.rm(path.join(UPLOADS_DIR, path.basename(site.posterLogoFile)), { force: true }, () => {});
  }
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[
        file.mimetype
      ];
      if (!ext) {
        cb(new Error('Only PNG, JPEG or WebP images are allowed'), '');
        return;
      }
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.post('/api/admin/sites/:id/image', requireAdmin, (req, res) => {
  const sites = loadSites();
  const site = sites.find((s) => s.id === req.params.id);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  upload.single('image')(req, res, (err: unknown) => {
    if (err || !req.file) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    // Remove the previous image, if any.
    if (site.imageFile) {
      fs.rm(path.join(UPLOADS_DIR, path.basename(site.imageFile)), { force: true }, () => {});
    }
    res.json({ imageFile: req.file.filename });
  });
});

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[
        file.mimetype
      ];
      if (!ext) {
        cb(new Error('Only PNG, JPEG or WebP images are allowed'), '');
        return;
      }
      cb(null, `${req.params.id}-logo-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post('/api/admin/sites/:id/logo', requireAdmin, (req, res) => {
  const sites = loadSites();
  const site = sites.find((s) => s.id === req.params.id);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  logoUpload.single('image')(req, res, (err: unknown) => {
    if (err || !req.file) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    // Remove the previous logo, if any.
    if (site.posterLogoFile) {
      fs.rm(path.join(UPLOADS_DIR, path.basename(site.posterLogoFile)), { force: true }, () => {});
    }
    res.json({ logoFile: req.file.filename });
  });
});

app.use('/api/uploads', express.static(UPLOADS_DIR, { fallthrough: false, maxAge: '1d' }));

// ---------- production static serving ----------

if (SERVE_STATIC) {
  const distDir = path.join(PKG_ROOT, 'dist/public');
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[wayfinder] API listening on ${PORT}${SERVE_STATIC ? ' (serving static app)' : ''}`);
});
