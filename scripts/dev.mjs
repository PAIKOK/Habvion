import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const option = (key, fallback) => args.find(x => x.startsWith(`--${key}=`))?.split('=')[1] ?? fallback;
const apiPort = option('api-port', process.env.PORT || '4000');
const clientPort = option('client-port', '5173');
const mock = args.includes('--mock');
const dataDir = option('data-dir', resolve('server/data'));
// Both spellings of the local address may open the site; the server refuses posts from any other origin.
const common = { CORS_ORIGIN: `http://localhost:${clientPort},http://127.0.0.1:${clientPort}`, ...process.env, PORT: apiPort, HB_API_PROXY: `http://127.0.0.1:${apiPort}` };
// Mock: no paid AI or 3D keys. Google sign-in (public client id) and contact forwarding still follow server/.env.
if (mock) Object.assign(common, { NODE_ENV:'development', AI_PROVIDER:'mock', MESH_PROVIDER:'mock', SESSION_SECRET:randomBytes(48).toString('base64'), GOOGLE_API_KEY:'', MONGODB_URI:'', TRIPO_API_KEY:'', USERS_FILE:resolve(dataDir,'mock-users.json'), DESIGNS_FILE:resolve(dataDir,'mock-designs.json'), MESSAGES_FILE:resolve(dataDir,'mock-messages.json'), ASSETS_DIR:resolve(dataDir,'mock-assets'), CORS_ORIGIN:`http://localhost:${clientPort},http://127.0.0.1:${clientPort}` });
const children = [spawn('npm', ['run','dev','--workspace=server'], { stdio:'inherit', env:common, detached:process.platform !== 'win32' }), spawn('npm', ['run','dev','--workspace=client','--','--port',clientPort,'--host','127.0.0.1'], { stdio:'inherit', env:common, detached:process.platform !== 'win32' })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) { try { process.platform === 'win32' ? child.kill('SIGTERM') : process.kill(-child.pid, 'SIGTERM'); } catch {} } setTimeout(() => process.exit(code), 500).unref(); }
for (const child of children) { child.on('error', error => { console.error(error.message); stop(1); }); child.on('exit', code => stop(code ?? 1)); }
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => stop());
console.log(`Habvion: http://127.0.0.1:${clientPort} (API :${apiPort}; ${mock ? 'mock, no keys used' : 'configured providers'})`);
