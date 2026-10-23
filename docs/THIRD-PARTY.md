# Third-party audit

Last reviewed 22 October 2026. Re-check whenever a dependency or outside service is added.

## Services the site talks to

| Service | Called from | When | What is sent | Consent / control |
| --- | --- | --- | --- | --- |
| Google Identity Services (`accounts.google.com/gsi/client`) | Browser | Sign-in pages, only after the visitor allows it (cookie banner) or clicks "Continue with Google" | Google handles the sign-in; we receive an ID token | Optional; cookie banner, Cookie Policy |
| Google Gemini API | Server | Someone asks the design assistant | Their request and the design it concerns | Using the assistant; disclosed in the Privacy Policy. `AI_PROVIDER=mock` sends nothing |
| Tripo 3D API | Server | Someone ticks "Make a 3D model from the photo" (unticked by default) | The product photo's web address | Opt-in tick box; disclosed. `MESH_PROVIDER=mock` sends nothing |
| Google Apps Script (Sheets + Gmail) | Server | A contact message is sent, if `CONTACT_WEBHOOK_URL` is set | The message and the details on the form | Contact-form consent box; disclosed |
| Product web pages | Server | Someone imports a product link | A normal page request (SSRF-guarded) | The person's own action |
| MongoDB Atlas | Server | Only if `MONGODB_URI` is set | All stored data | Hosting choice; otherwise private files on the server |

**Not used:** analytics, advertising, tag managers, session recording, social widgets, web fonts, CDNs.

## Things checked in the code

- No web fonts are downloaded; text uses system fonts.
- The 3D loader's default of fetching a Draco decoder from `gstatic.com` is switched off (`useGLTF(url, false)`). No bundled model uses Draco.
- `detect-gpu`, pulled in by `@react-three/drei`, would fetch benchmarks from a CDN, but only through drei hooks this app doesn't use (it imports `OrbitControls`, `PointerLockControls` and `useGLTF` only).
- A scan of the built bundle for `https://` hosts finds only links, error-message URLs, and the consent-gated Google script.

## Libraries and licences

161 production packages (direct and indirect). Licences: MIT 137, Apache-2.0 8, ISC 7, BSD-2/3-Clause 4, plus `webgl-constants` (MIT; licence file present, not declared in its package.json) and this project's own four packages. **No GPL, AGPL, SSPL or non-commercial licences.**

| Package | Where | Licence |
| --- | --- | --- |
| react, react-dom, react-router-dom, zustand | browser | MIT |
| three, @react-three/fiber, @react-three/drei | browser (3D) | MIT |
| express, cors, cookie-parser, jose, zod | server | MIT |
| dotenv | server | BSD-2-Clause |
| mongodb | server (optional) | Apache-2.0 |

Build-only tools (vite, tailwindcss, TypeScript types, mongodb-memory-server) are MIT and are not shipped to visitors.

## Content

- 3D models: CC BY 4.0, credited on `/credits` and in `client/public/models/LICENSES.md`.
- Icons, plan drawings, favicon: made for this project.
