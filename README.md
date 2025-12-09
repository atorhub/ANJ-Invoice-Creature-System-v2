# ANJ Invoice — Hybrid-D v3

Single-page client-side invoice/bill parser & PWA:
- PDF reading via PDF.js
- Offline OCR via Tesseract.js (optional)
- Simple heuristic parser (regex + keyword scoring)
- Local history (IndexedDB)
- Creature / badge system for categories
- PWA manifest + simple service worker (static caching)
- HTML2Canvas + jsPDF export (PDF download)

## Files
- `index.html` — main UI
- `style.css` — theme
- `script.js` — parser, UI logic, IndexedDB
- `creatures.js` — creature registry (editable)
- `manifest.json` — PWA manifest
- `service-worker.js` — simple caching
- Icons & assets (see below)

## Folder / asset expectations
Place creature icons and badges at repository root or inside `assets/`. If you move them, update `creatures.js` paths.

**Recommended asset names** (matching the registry used in creatures.js):
- `food-xp1-Nibbi.png`
- `food-xp2-Nibbo.png`
- `food-xp3-Nibblaze.png`
- `shopping-xp1-Shoppy.png`
- `shopping-xp2-Shoppero.png`
- `shopping-xp3-Shopstorm.png`
- `finance-xp1-Penny.png`
- `finance-xp2-Coino.png`
- `finance-xp3-Goldflare.png`
- badges: `badges-512-food.png`, `badges-512-shopping.png`, `badges-512-finance.png`
- app icons: `icon-48.png`, `icon-72.png`, `icon-128.png`, `icon-192.png`, `icon-256.png`, `icon-512.png`

## Recommended sizes & optimization
- App icons: 48, 72, 128, 192, 256, 512 px (PNG). Keep under ~200KB each ideally.
- Mascot/creature images: 512x512 PNG for each XP stage. You may also include 256 px versions to serve in UI.
- Badges: 512x512 PNG, square.
- If asset uploads are large, run them through a lossless compressor or use tinyjpg/pngquant to reduce size. Avoid >2–3MB images for web.

## Notes & next steps
- Tesseract is heavy — for faster parsing prefer text/PDF input; use OCR only on images.
- Improve parser by adding region-specific rules (India receipts) in `script.js` -> `parseText`.
- To add creatures: add files and update `creatures.js`.
