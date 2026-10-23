# Habvion — fresh implementation

**Design it. See it. Make it yours.**

This directory is built from scratch; it does not reuse the existing project's source.

## Run

```sh
npm install --legacy-peer-deps
npm run dev:mock
```

The default client is on :5173 and API on :4000. The mock launcher creates an ephemeral session secret in memory; no API keys are needed. For Gemini, copy `server/.env.example` to `server/.env`, supply your own secret/key, and run `npm run dev`.

An isolated verification instance can be run without interrupting another app:

```sh
npm run dev:mock -- --client-port=5175 --api-port=4001
npm run check
npm test --workspace=server
npm run smoke -- 1
```

## Demo homes

Six ready-to-explore homes are available on the landing page. The sixth, **Garden
Bungalow**, is a single-floor 3 BHK on a 40×60 ft plot with two bathrooms, a
landscaped front garden, a rear patio and one-car parking. Open
`/demos/garden-bungalow` to view its 2D plan or 3D model, or use **Customize This
House** to save your own editable copy.

## Walking navigation

Choose **3D → Walk** to explore a house. A small north-up map shows your current
room, floor, position and facing direction, and switches floors as you climb the
stairs. Use the **− / +** button to collapse or expand it; the room label stays
visible when collapsed. Click the 3D scene to look around, use WASD or arrow keys
to walk, and press Escape to free the mouse for the map and view controls.

## Verification status

No phase is marked complete until build, headless tests, Chrome smoke, and screenshot inspection have all passed. See `docs/PHASES.md`.

Designs, building-rule checks and budgets are planning estimates, not legal compliance certification or construction drawings.

## Deploy to Vercel

Use the project root, not just `client`. `vercel.json` builds the client and a
serverless Express API. See [the deployment guide](docs/VERCEL.md) for required
environment variables, the existing production business-details guard, and the
photo-to-3D serverless limitation. Rotate any exposed database password before
using its new URI; do not send credentials through chat.
