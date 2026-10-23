// Developer aid for the realism pass: render each .glb from four sides (front = +z)
// and print its bounding box, so orientation and proportions can be checked by eye.
//   node scripts/model-render.mjs <dir-with-glbs> <out-dir> [name ...]
import { createServer } from "node:http";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { chromium } from "playwright-core";

const [dir, out, ...only] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: node scripts/model-render.mjs <glb-dir> <out-dir> [names]");
await mkdir(out, { recursive: true });
const three = join(process.cwd(), "node_modules/three");
const page = `<!doctype html><html><body style="margin:0;background:#fff">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const S = 320, r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(S * 2, S * 2); r.setClearColor(0xf4f1ea); document.body.appendChild(r.domElement);
window.render = async (url) => {
  const g = await new GLTFLoader().loadAsync(url), scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(3, 5, 4); scene.add(sun);
  const root = g.scene; scene.add(root);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  root.position.sub(c);
  const R = size.length() * 0.75, cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.01, R * 10);
  // A small marker at +z (the front) so each view shows which way is front.
  const mark = new THREE.Mesh(new THREE.ConeGeometry(R * 0.05, R * 0.15, 8), new THREE.MeshBasicMaterial({ color: 0xd04020 }));
  mark.rotation.x = Math.PI / 2; mark.position.set(0, -size.y / 2, size.z / 2 + R * 0.15); scene.add(mark);
  r.setScissorTest(true);
  const views = [[0, 0.35, 1, "front"], [1, 0.35, 0, "right"], [0, 0.35, -1, "back"], [-1, 0.35, 0, "left"]];
  views.forEach(([x, y, z], i) => {
    cam.position.set(x * R * 3, y * R * 3, z * R * 3); cam.lookAt(0, 0, 0);
    const vx = (i % 2) * S, vy = (1 - Math.floor(i / 2)) * S;
    r.setViewport(vx, vy, S, S); r.setScissor(vx, vy, S, S); r.render(scene, cam);
  });
  return { x: +size.x.toFixed(3), y: +size.y.toFixed(3), z: +size.z.toFixed(3) };
};
window.ready = true;
</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/") return res.writeHead(200, { "content-type": "text/html" }).end(page);
    const file = u.startsWith("/three/") ? join(three, u.slice(7)) : u.startsWith("/glb/") ? join(dir, u.slice(5)) : null;
    if (!file) return res.writeHead(404).end();
    const type = { ".js": "text/javascript", ".glb": "model/gltf-binary" }[extname(file)] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await browser.newPage({ viewport: { width: 640, height: 640 } });
await p.goto(`http://127.0.0.1:${port}/`);
await p.waitForFunction(() => window.ready);
const files = (await readdir(dir)).filter((f) => f.endsWith(".glb") && (!only.length || only.some((o) => f.startsWith(o))));
const dims = {};
for (const f of files) {
  try {
    dims[f] = await p.evaluate((u) => window.render(u), `/glb/${f}`);
    await p.locator("canvas").screenshot({ path: join(out, f.replace(".glb", ".png")) });
    console.log(f, JSON.stringify(dims[f]));
  } catch (e) {
    console.log(f, "FAILED", String(e).slice(0, 120));
  }
}
await writeFile(join(out, "dims.json"), JSON.stringify(dims, null, 1));
await browser.close();
server.close();
