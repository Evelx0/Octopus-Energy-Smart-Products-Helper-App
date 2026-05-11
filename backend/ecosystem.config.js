/**
 * PM2 Ecosystem Config — internal-webapp backend
 *
 * Usage (VPS):
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup   ← run the printed command so PM2 restarts on reboot
 *
 * All secrets are read from OS environment variables — do NOT hard-code values here.
 * Set them on the VPS with one of these approaches (see VPS DEPLOYMENT GUIDE below):
 *   - Export in /etc/environment (system-wide, requires reboot/re-login to take effect)
 *   - Export in ~/.bashrc / ~/.profile (user-level)
 *   - Use a secrets manager and inject at deploy time
 *
 * After changing any env var: pm2 restart octopus-smartproducts && pm2 save
 */

module.exports = {
  apps: [
    {
      name:             'octopus-smartproducts',
      script:           'server.js',
      cwd:              '/var/www/octotool/backend',
      instances:        1,
      autorestart:      true,
      watch:            false,
      max_memory_restart: '256M',

      // ── Environment — production ───────────────────────────────────────────
      // Values are read from the OS environment at startup.
      // The env block below documents which variables are required; their actual
      // values must be set on the server (never committed here).
      env_production: {
        NODE_ENV:          'production',
        PORT:              3001,

        // ── Required secrets (set on VPS — see deployment guide below) ────────
        OCTOPUS_API_KEY:   process.env.OCTOPUS_API_KEY,
        OCM_API_KEY:       process.env.OCM_API_KEY,
        ELEXON_API_KEY:    process.env.ELEXON_API_KEY,
        ELEXON_QUEUE_NAME: process.env.ELEXON_QUEUE_NAME,
        ELEXON_QUEUE_URL:  process.env.ELEXON_QUEUE_URL,
        BASIC_AUTH_USER:   process.env.BASIC_AUTH_USER,
        BASIC_AUTH_PASS:   process.env.BASIC_AUTH_PASS,

        // ── Optional overrides ─────────────────────────────────────────────────
        // FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,  // default: http://localhost:5174
        // EXPECTED_EXTENSION_VERSION: process.env.EXPECTED_EXTENSION_VERSION,
        // FEATURE_FLAGS_JSON: process.env.FEATURE_FLAGS_JSON,  // e.g. '{"showGridStress":false}'
        // ANNOUNCEMENTS_JSON: process.env.ANNOUNCEMENTS_JSON,
      },
    },
  ],
};

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 * VPS DEPLOYMENT GUIDE — moving secrets out of .env into the server environment
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * STEP 1 — Set secrets as OS environment variables on the VPS
 * ─────────────────────────────────────────────────────────────
 * SSH into the VPS, then add the following to /etc/environment
 * (available to all users/processes) or to the PM2 user's ~/.bashrc:
 *
 *   sudo nano /etc/environment
 *
 * Add these lines (replace <VALUE> with actual secrets — do NOT commit this file):
 *
 *   OCTOPUS_API_KEY="<your-live-key>"
 *   OCM_API_KEY="<ocm-key>"
 *   ELEXON_API_KEY="<elexon-key>"
 *   ELEXON_QUEUE_NAME="<queue-name>"
 *   ELEXON_QUEUE_URL="<azure-servicebus-url>"
 *   BASIC_AUTH_USER="smartproducts"
 *   BASIC_AUTH_PASS="<your-new-password>"
 *
 * Save and reload environment (logout and back in, or run):
 *   source /etc/environment
 *
 *
 * STEP 2 — Upload the updated backend files to the VPS
 * ──────────────────────────────────────────────────────
 * Via SFTP or rsync, upload:
 *   internal-webapp/backend/server.js
 *   internal-webapp/backend/middleware/validation.js
 *   internal-webapp/backend/ecosystem.config.js
 *   internal-webapp/backend/package.json
 *   internal-webapp/backend/package-lock.json
 *
 *
 * STEP 3 — Install new dependencies (morgan was added)
 * ──────────────────────────────────────────────────────
 *   cd /var/www/octopus-smartproducts/internal-webapp/backend
 *   npm install
 *
 *
 * STEP 4 — Delete the .env file from the server (secrets now in environment)
 * ───────────────────────────────────────────────────────────────────────────
 *   rm /var/www/octopus-smartproducts/internal-webapp/backend/.env
 *
 * NOTE: The .env file is still used locally for development convenience.
 * On the VPS it is no longer needed once env vars are set in the OS.
 *
 *
 * STEP 5 — Switch PM2 to use ecosystem.config.js
 * ────────────────────────────────────────────────
 * If you currently run PM2 with a bare `pm2 start server.js` command:
 *
 *   pm2 delete octopus-smartproducts        # remove the old process entry
 *   cd /var/www/octopus-smartproducts/internal-webapp/backend
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save                                # persist across reboots
 *
 * If PM2 startup hasn't been configured yet (run once per server):
 *   pm2 startup                             # prints a command — run it
 *   pm2 save
 *
 *
 * STEP 6 — Build and upload the frontend
 * ─────────────────────────────────────────
 * Build locally:
 *   cd internal-webapp/frontend
 *   npm run build
 *
 * Upload dist/ to VPS:
 *   rsync -avz dist/ user@your-vps:/var/www/octopus-smartproducts/internal-webapp/frontend/dist/
 *
 *
 * STEP 7 — Verify
 * ─────────────────
 *   pm2 logs octopus-smartproducts --lines 30
 *   # Look for:
 *   #   [STARTUP SUCCESS] Octopus API Key loaded successfully.
 *   #   [AUTH] Basic auth enabled — realm: Smart Products Hub
 *   #   Internal webapp backend running on http://localhost:3001
 *
 *
 * SUBSEQUENT DEPLOYS (backend-only changes)
 * ──────────────────────────────────────────
 *   # Upload changed server.js / route files via SFTP
 *   cd /var/www/octopus-smartproducts/internal-webapp/backend
 *   npm install                              # only if package.json changed
 *   pm2 restart octopus-smartproducts
 *   pm2 logs --lines 20
 *
 * SUBSEQUENT DEPLOYS (frontend-only changes)
 * ────────────────────────────────────────────
 *   # Build locally, rsync dist/, no PM2 restart needed
 *   cd internal-webapp/frontend && npm run build
 *   rsync -avz dist/ user@your-vps:/var/www/octopus-smartproducts/internal-webapp/frontend/dist/
 *   # Nginx serves the new files immediately — no reload required
 *   # (index.html is no-cache so users get new JS hashes on next page load)
 *
 *
 * NGINX CONFIG REMINDER
 * ──────────────────────
 * Ensure your nginx server block includes:
 *
 *   # Force HTTPS (HTTP → HTTPS redirect)
 *   server {
 *     listen 80;
 *     server_name octotool.app;
 *     return 301 https://$host$request_uri;
 *   }
 *
 *   server {
 *     listen 443 ssl;
 *     server_name octotool.app;
 *     # ... ssl_certificate / ssl_certificate_key ...
 *
 *     location /api/ {
 *       proxy_pass         http://localhost:3001;
 *       proxy_http_version 1.1;
 *       proxy_set_header   Host $host;
 *       proxy_set_header   X-Real-IP $remote_addr;
 *       proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
 *       proxy_set_header   X-Forwarded-Proto $scheme;
 *     }
 *
 *     # /assets — long-lived immutable cache (Vite content-hashes filenames)
 *     location /assets/ {
 *       root /var/www/octopus-smartproducts/internal-webapp/frontend/dist;
 *       add_header Cache-Control "public, max-age=31536000, immutable";
 *     }
 *
 *     # Everything else — no-cache so deploys take effect immediately
 *     location / {
 *       root /var/www/octopus-smartproducts/internal-webapp/frontend/dist;
 *       try_files $uri $uri/ /index.html;
 *       add_header Cache-Control "no-cache, no-store, must-revalidate";
 *     }
 *   }
 *
 * After editing nginx config:
 *   sudo nginx -t && sudo systemctl reload nginx
 */
