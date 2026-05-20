# RehabSmart Quick Start

## 30-Second Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure Firebase credentials
cp .env.example .env.local
# Edit .env.local with your Firebase config

# 3. Start the app
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## Running Options

### Development (Hot Reload) ⚡
```bash
npm run dev
```
- Fast refresh when you save files
- Perfect for development
- Port: 3000

### Production (Build + Server) 🚀
```bash
npm run start
```
- Optimized production build
- Served by Express
- Port: 3000

### Build Only
```bash
npm build
```
Creates optimized `dist/` folder

### Run Server Only (after build)
```bash
npm run server
```

---

## Firebase Setup

1. Get credentials from [Firebase Console](https://console.firebase.google.com/)
2. Create `.env.local` from `.env.example`
3. Add your Firebase config values
4. Ensure Firestore is enabled in your Firebase project

---

## Common Issues

**Port 3000 already in use?**
```bash
npm run dev -- --port 3001
```

**Firebase connection error?**
- Check `.env.local` has all required keys
- Verify Firebase project is active
- Check Firestore security rules in `firestore.rules`

**Build errors?**
```bash
npm run clean
npm install
npm run build
```

---

## Scripts Reference

| Command | What It Does |
|---------|------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run start` | Build + run server |
| `npm run server` | Run server (needs build first) |
| `npm run preview` | Preview production build |
| `npm run lint` | Check TypeScript types |
| `npm run clean` | Delete build artifacts |

---

## Deployment

Ready to deploy? See [LOCAL_SETUP.md](LOCAL_SETUP.md) for Azure App Service, Vercel, and Docker options.
