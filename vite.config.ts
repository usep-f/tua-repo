import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'supabase-credential-sync',
        configureServer(server) {
          server.middlewares.use('/api/sync-supabase-creds', (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const { url, anonKey } = JSON.parse(body);
                  if (url && anonKey) {
                    const trimmedUrl = String(url).trim();
                    const trimmedKey = String(anonKey).trim();
                    const envContent = `VITE_SUPABASE_URL=${trimmedUrl}\nVITE_SUPABASE_ANON_KEY=${trimmedKey}\n`;
                    fs.writeFileSync(path.resolve(process.cwd(), '.env'), envContent);
                    fs.writeFileSync(path.resolve(process.cwd(), '.env.production'), envContent);
                    process.env.VITE_SUPABASE_URL = trimmedUrl;
                    process.env.VITE_SUPABASE_ANON_KEY = trimmedKey;
                    console.log('✅ Supabase credentials saved to .env & .env.production for production builds');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                    return;
                  }
                } catch (err) {
                  console.error('Failed to parse supabase credentials sync body:', err);
                }
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payload' }));
              });
            } else {
              res.writeHead(404);
              res.end();
            }
          });
        },
      },
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
