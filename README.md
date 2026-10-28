# Paint Analyzer (app-bubina)

Web app (React + Vite) che legge i numeri presenti in un'immagine, per esempio uno schema "dipingi coi numeri", tramite OCR ([tesseract.js](https://github.com/naptha/tesseract.js)), e li evidenzia sull'immagine.

1. Carica una foto.
2. L'app la converte in bianco/nero ad alto contrasto e riconosce solo le cifre.
3. Usa la "tastiera numerica" per evidenziare tutte le zone con un certo numero.

L'elaborazione avviene interamente nel browser: l'immagine non viene caricata su nessun server.

## Sviluppo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Il deploy su Vercel è automatico a ogni push su `main` (preset Vite, output `dist/`).
