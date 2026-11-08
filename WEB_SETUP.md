# Monei on the web (Vercel) — setup

The web app is the same code as the phone app, built with `expo export -p web`.
Phone and web share one file, `FinanceApp/finance-data.json` in your Google Drive, so
**use the same Google account on both**.

## 1. Put the files in your project
Extract the zip over your project folder (your own `google-services.json` and `.git` are not in it, so they stay).
Then:
```
npm install
npx expo start --web      # opens http://localhost:8081
```
Try it locally first (needs step 2 for sign-in; "Continue without signing in" works without it).

## 2. Google Cloud Console (one change)
APIs & Services → Credentials → open your existing **Web client** (the one whose ID is in `src/config.js`).
Under **Authorized JavaScript origins** add:
- `http://localhost:8081`
- `https://YOUR-PROJECT.vercel.app` (add after step 3, plus any custom domain)

Save. Changes can take a few minutes. No redirect URI is needed.
Your Google account must still be a **test user** on the OAuth consent screen (while it is in "Testing").

## 3. Deploy to Vercel
1. Commit and push the project to GitHub (`dist/` and `node_modules/` are git-ignored).
2. vercel.com → Add New → Project → import the repo. `vercel.json` already sets the build command (`npx expo export -p web`), output folder (`dist`) and page routing. Accept the defaults and Deploy.
3. Copy the `.vercel.app` URL into step 2's origins list.

No environment variables are required. (Optional: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to use a different client ID.)

## 4. Update the phone app
Rebuild and install the phone app (version 1.1.0, versionCode 2) as in your build reference, section 8A.
**Do this before relying on the web app.** An older phone build does not record deletions, so it could bring back things you deleted on the web.

## 5. First-time check (2 minutes)
1. Phone: sign in, add a transaction.
2. Web: open the Vercel URL → Continue with Google (same account). The transaction should appear.
3. Web: add one, delete one. On the phone, reopen the app (or wait up to a minute) — both changes appear.

If the web shows **"No backup found"** in the sidebar/Settings even though the phone has data, Google is treating the web and phone as different apps. Check that the Web client and the Android client are in the **same** Google Cloud project, and tell me — there is a fallback.

## How sync works
- Everything saves on the device first, so nothing waits on the network.
- Each change is stamped; deletes leave a small marker. Two devices merge record by record (newest edit wins; a delete beats an older edit).
- The app checks Drive when you return to it and once a minute while open.
- **Web only:** Google access lasts about an hour. If it can't renew silently, a "Reconnect" bar appears. Your changes stay saved and upload when you click it.
- Signing out on the web clears the browser's copy; your Drive data is untouched.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Popup says `origin_mismatch` | The exact site URL isn't in Authorized JavaScript origins (step 2). Check `https`, no trailing slash. |
| "Access blocked: app not verified" | Add your account under OAuth consent screen → Test users. |
| Popup blocked | Allow popups for the site, then click Reconnect. |
| Page is blank after deploy | Check the Vercel build log; confirm Output Directory is `dist`. |
| Refreshing `/budgets` gives 404 | `vercel.json` must be in the project root (it contains the rewrite). |

## Known limits
- Two devices editing the very same record at the same moment: the later edit wins.
- A device offline for over a year may resurrect items deleted elsewhere (delete markers expire after 365 days).
- Web sign-in needs a click about once an hour (no server-side refresh token by design; can be added later).
- Tests: `npm test` (merge logic). The browser tests used a fake Google Drive, not the real one.
