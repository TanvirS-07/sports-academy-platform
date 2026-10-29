# Sign in with Google

Parents can log in or sign up with their Google account instead of making a password. Coaches can't: their accounts are made by the academy with `scripts/create_coach.py` and they keep logging in with their email and password.

Google sign-in is off until the backend has a Google client id, client secret and redirect URI. While it's off, the "Continue with Google" button doesn't show and everything else works as before.

## What happens when a parent signs in

1. "Continue with Google" on the login or register page goes to `GET /api/v1/auth/google/start`.
2. The backend makes a random `state`, `nonce` and PKCE code verifier, keeps them in a signed `google_login` cookie for 10 minutes, and sends the browser to Google.
3. The parent picks their Google account. Google sends the browser back to `GET /api/v1/auth/google/callback` with a code.
4. The backend checks the `state` against the cookie, swaps the code for an ID token (with the client secret and the code verifier) and checks the token's issuer, audience, expiry and nonce.
5. It then finds the account:
   * a Google account that has signed in before goes to the same account, even if its email has changed;
   * otherwise, an existing parent with the same email is linked to the Google account, as long as Google says the email is verified. Their password keeps working too;
   * otherwise, a new parent is created with the name and email from Google and no password.
6. The backend sets the usual refresh cookie and sends the browser to `/parent`. From there it works the same as a password login.

If anything goes wrong the browser goes back to `/login?google_error=<code>` and the login page says why:

| Code | Why |
|---|---|
| `cancelled` | The parent pressed Cancel on Google's page |
| `coach_account` | The email belongs to a coach |
| `unverified_email` | Google hasn't verified the email address |
| `inactive` | The account has been turned off |
| `linked_elsewhere` | The email's account is already linked to a different Google account |
| `expired` | The `google_login` cookie was missing or older than 10 minutes |
| `not_configured` | The backend has no Google settings |
| `failed` | Anything else, for example a `state` that doesn't match or Google refusing the code |

The `google_login` cookie is `SameSite=Lax`, because the browser only sends it on the way back from Google (another site) if it's Lax. The refresh cookie stays `SameSite=Strict`.

## Setting it up in Google Cloud

This needs a Google account. It's free.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project, for example `precision-cricket`.
2. Open **Google Auth Platform** (in older consoles it's **APIs & Services → OAuth consent screen**) and click **Get started**.
   * App name: `Precision Cricket Academy`. User support email: your email.
   * Audience: **External**.
   * Contact email: your email. Agree to the policy and create it.
3. Under **Data access**, add the scopes `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These are the only ones the app asks for, and none of them need Google to review the app.
4. Under **Audience**, the app starts in **Testing**, where only the Google accounts listed under "Test users" can sign in (up to 100). Add your own to try it. When you want anyone to be able to sign in, press **Publish app**. With only these three scopes Google doesn't need to verify the app first.
5. Under **Clients**, click **Create client**:
   * Application type: **Web application**. Name: `Sports academy web`.
   * **Authorised JavaScript origins**: not needed, leave it empty.
   * **Authorised redirect URIs**, one per place the app runs:
     * `http://localhost:5173/api/v1/auth/google/callback` for local development
     * `https://precisioncricket.vercel.app/api/v1/auth/google/callback` for the live demo
6. Create it and copy the **Client ID** and **Client secret**. Google only shows the secret once, so keep it somewhere safe (a password manager). If it's lost, add a new secret to the same client.

The redirect URI has to match exactly, including `http` or `https`, the port and no trailing slash, or Google shows a `redirect_uri_mismatch` error.

## Local development

Add these to `.env` in the repository root, then restart the stack with `docker compose up -d`:

```bash
GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=http://localhost:5173/api/v1/auth/google/callback
```

The redirect URI points at the Vite dev server, not at the backend on port 8000. Vite forwards `/api` to the backend, so the cookies belong to the same site as the frontend, like the refresh cookie does already.

Open the site at `http://localhost:5173`, not `127.0.0.1:5173`, because that's the address the redirect URI uses.

## Live demo (Vercel and Render)

On Render, open the `sports-academy-api` service, then **Environment**, and add:

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the client id |
| `GOOGLE_CLIENT_SECRET` | the client secret |
| `GOOGLE_REDIRECT_URI` | `https://precisioncricket.vercel.app/api/v1/auth/google/callback` |

Save, and Render redeploys. Nothing changes on Vercel: `vercel.json` already forwards `/api/...` to Render, so Google sends the browser back to the Vercel address and the cookies stay on that site.

The redirect URI uses the Vercel address on purpose, not the `onrender.com` one. If Google sent the browser to Render directly, the refresh cookie would be set on Render's site and the frontend would never see it.

## Things to know

* **Vercel previews:** pull request previews have their own addresses, and Google doesn't allow wildcards in redirect URIs, so Google sign-in only works on the main demo address. The button still shows on previews, but Google sends the browser back to the main address, which doesn't have the preview's `google_login` cookie, so it ends with the `expired` message. Password login works everywhere.
* **Linking by email:** an existing parent account is linked when Google says the email is verified. That's normal for Google accounts, and Gmail addresses are always verified. Coach accounts are never linked, so a coach's Google account can't be used to get into the coach area.
* **No password:** a parent who signs up with Google has no password, so the email and password form doesn't work for them. There's no "set a password" page yet.
* **Signature check:** the ID token comes straight from Google's token endpoint over HTTPS, so its signature isn't checked separately. OpenID Connect allows this, and Google's docs say the same. The other claims are checked.
