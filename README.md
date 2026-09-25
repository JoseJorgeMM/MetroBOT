<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

## Transporte público con Google Maps

El planificador consulta Google Routes (TRANSIT) y usa el enrutador local únicamente como respaldo identificado. Sigue la [guía de activación en Vercel](docs/GOOGLE_MAPS_SETUP.md) para configurar `GOOGLE_ROUTES_API_KEY` (privada) y `VITE_GOOGLE_MAPS_API_KEY` (pública, restringida por dominio). La plantilla `.env.example` no contiene credenciales.

Google requiere facturación habilitada; sus cuotas gratuitas no son ilimitadas. Configura restricciones y controles de consumo antes de activarlo. El planificador no necesita una clave Gemini.

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d31e5b94-6002-4b3f-b618-257965840df0

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---
Built with AI Studio. The fastest path from prompt to production with Gemini.
