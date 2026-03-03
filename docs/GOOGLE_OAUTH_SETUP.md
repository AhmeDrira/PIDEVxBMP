# Google Sign-In Setup

If you see **"The given origin is not allowed for the given client ID"** or **"Invalid Google token"**, fix the OAuth client in Google Cloud Console as below.

## 1. Open the correct credential

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Open your **OAuth 2.0 Client ID** (the one whose Client ID matches `GOOGLE_CLIENT_ID` in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `.env`).
3. Ensure the application type is **Web application**.

## 2. Authorized JavaScript origins (required)

Add **all** of these (no trailing slash). Browsers can use either `localhost` or `127.0.0.1`, so both must be allowed:

| URI |
|-----|
| `http://localhost:3000` |
| `http://localhost:5173` |
| `http://127.0.0.1:3000` |
| `http://127.0.0.1:5173` |

- **3000** = if your app or API runs on port 3000.
- **5173** = Vite dev server default.

If you use another port, add `http://localhost:YOUR_PORT` and `http://127.0.0.1:YOUR_PORT`.

## 3. Authorized redirect URIs (optional for this app)

This app uses the **Google One Tap / button** flow (ID token in the page), not a redirect. You can leave redirect URIs empty or keep e.g. `http://localhost:3000/api/auth/callback/google` if you add a redirect flow later.

## 4. Save and wait

- Click **Save**.
- Changes can take **a few minutes** to apply. If it still fails, wait 5–10 minutes and try again.

## 5. Use the same origin in the browser

- Open the app using **exactly** one of the origins you added (e.g. `http://localhost:5173` or `http://127.0.0.1:5173`).
- Do not mix: if you added only `localhost`, open `http://localhost:5173`, not `http://127.0.0.1:5173`.

## 6. Restart after changing env

- After changing `GOOGLE_CLIENT_ID` or `VITE_GOOGLE_CLIENT_ID`, restart the **backend** and the **Vite dev server**.
