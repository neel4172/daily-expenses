# Daily Expenses

A phone-first expense tracker: expenses and income, bank balances that update automatically, a monthly budget, category breakdown, CSV export, and an app PIN lock with auto-lock.

- **Login:** email + password (Firebase Authentication). Anyone can create their own account.
- **Data:** Cloud Firestore. Each person's data is private to them and syncs across all their devices. Works offline and syncs when back online.
- **Hosting:** GitHub Pages (free).

## Files

| File | What it is |
|---|---|
| `index.html` | The app |
| `app-auth.js` | Login screen + Firestore sync |
| `firebase-config.js` | **Your** Firebase project keys (you fill this in) |
| `firestore.rules` | Security rules: each user can only read/write their own data |
| `manifest.webmanifest`, `*.png` | Home-screen app icon and name |
| `sw.js` | Lets the app open without internet |

## Setup (about 10 minutes, all free)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** → name it `daily-expenses` → you can turn off Google Analytics → **Create**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** → pick a location (e.g. `northamerica-northeast2 (Toronto)`) → **Start in production mode** → **Create**.
4. In Firestore open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. **Project settings (gear icon) → General → Your apps → Web (`</>`)** → nickname `web` → **Register app**. Copy the `firebaseConfig` values into `firebase-config.js`.

### 2. Put it on GitHub Pages
1. On GitHub create a new **public** repository, e.g. `daily-expenses` (empty, no README).
2. Upload all files in this folder → **Commit**.
3. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
4. After a minute your app is at `https://neel4172.github.io/daily-expenses/`.

### 3. Allow your website to sign in
Firebase console → **Authentication → Settings → Authorized domains → Add domain** → `neel4172.github.io`.

### 4. Add it to your iPhone
Open the GitHub Pages link in **Safari** → **Share** → **Add to Home Screen** → **Add**.

## Security notes
- Firebase web keys in `firebase-config.js` are designed to be public; access is enforced by `firestore.rules` and Firebase Authentication.
- The PIN is stored only as a salted PBKDF2 hash. It locks the app on the device; the account password protects the data.
- Optional: in Firebase → Authentication → Settings, turn on **email enumeration protection** and consider password policy settings.
