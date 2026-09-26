# SuaraDuit

A Progressive Web App (PWA) for voice-based personal expense tracking with Indonesian-language input. 
Built using React, Tailwind CSS, Express, Firebase (Auth + Firestore), and the Gemini API (`gemini-3.1-flash-lite`).

## Features
- **Instant Flow**: Tap, speak your expense ("Makan ayam prep 25 ribu"), and done.
- **AI-Powered**: Uses Gemini Multimodal to transcribe and structure audio straight into JSON without a separate STT step.
- **Offline Installability**: Standard PWA manifest and service worker.
- **Zero Click Happy Path**: Automatically saves unless you tap "Undo" on the popup.
- **Visual Feedback**: Pulse animations and real-time audio volume visualizations.

## Environment Variables
Before running the application, provide your configuration API keys. Copy `.env.example` to `.env` and configure:

1. **Firebase**: Create a Firebase project, configure Firestore and Email/Google Auth. Add your `VITE_FIREBASE_*` keys.
2. **Gemini API**: Add your actual `GEMINI_API_KEY` from Google AI Studio.

## Local Development
1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
2. Run the development server (runs full-stack Express + Vite proxy):
   \`\`\`bash
   npm run dev
   \`\`\`
3. Open \`http://localhost:3000\`.

## Cloud Run Deployment Instructions

1. **Build the Production Bundle**
   Build both the frontend assets (Vite) and backend server (esbuild bundle) in a single step:
   \`\`\`bash
   npm run build
   \`\`\`

2. **Containerize & Deploy**
   Ensure you have the Google Cloud CLI installed and authenticated. Then, simply deploy your working source folder to Cloud Run using `gcloud run deploy`. Cloud Build will automatically handle containerizing this Express/Node application context.

   \`\`\`bash
   gcloud run deploy suaraduit \
     --source . \
     --region as-southeast1 \
     --allow-unauthenticated \
     --set-env-vars="GEMINI_API_KEY=your_key_here" \
     --port=3000
   \`\`\`

*(Note: In a true production CI/CD setup, you should use Google Cloud Secret Manager instead of setting plain-text API keys via command-line args!)*
