# Production setup

## Firebase console

1. Enable Email/Password in Authentication > Sign-in method.
2. Create a Firestore database in the Tokyo region.
3. Register the production dashboard domain in Authentication > Settings > Authorized domains.
4. Register the web app with App Check using reCAPTCHA Enterprise and place its site key in `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`.
5. Put a unique, non-secret site identifier in `NEXT_PUBLIC_MOGCIA_SITE_ID`.

## Install and test

```sh
npm install
npm --prefix functions install
npx firebase-tools login
npx firebase-tools use YOUR_FIREBASE_PROJECT_ID
npx firebase-tools functions:secrets:set OPENAI_API_KEY
npx firebase-tools emulators:start
npm run dev
```

Use an App Check debug token for local testing when App Check enforcement is enabled in the Firebase console.

## Deploy

```sh
npm run build
npm run functions:build
npx firebase-tools deploy --only functions,firestore
```

After deployment, set `NEXT_PUBLIC_MOGCIA_COLLECTOR_URL` to the deployed `collect` URL and deploy the Next.js application. Change the site domain in the dashboard before placing the analytics tag on the measured website.

The OpenAI key must only be stored as the Firebase Functions secret. Do not add it to a `NEXT_PUBLIC_` variable or to the frontend hosting environment.
