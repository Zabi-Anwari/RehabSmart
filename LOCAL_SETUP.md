# RehabSmart - Local Development Guide

RehabSmart is a rehabilitation management platform built with React, Firebase, and Tailwind CSS. This guide covers running the app locally.

## Prerequisites

- **Node.js** 16+ and npm
- **Firebase Project** (for authentication and Firestore database)
- A modern web browser

## Setup Instructions

### 1. Clone/Download the Project

```bash
cd d:/LAB/RehabSmart
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Firebase

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your Firebase credentials:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Click **Project Settings** (gear icon)
   - Under **General** tab, find **Your apps** section
   - Copy the Firebase config values and paste them into `.env.local`:

   ```
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

3. Ensure your Firestore database is created in your Firebase project with the proper security rules (see `firestore.rules`)

### 4. Run the App Locally

#### Option A: Development Mode (Hot Reload)

```bash
npm run dev
```

The app will start on `http://localhost:3000` with hot module reloading. Perfect for development.

#### Option B: Production Mode (Build + Server)

```bash
npm run start
```

This builds the production bundle and serves it via Express on `http://localhost:3000`.

#### Option C: Build First, Then Run Server Separately

```bash
# Build the production bundle
npm run build

# Start the Express server
npm run server
```

## Project Structure

```
RehabSmart/
├── src/
│   ├── pages/              # Route pages
│   ├── components/         # React components
│   ├── lib/               # Firebase config, utilities
│   └── App.tsx            # Main app component
├── server.ts              # Express server for local deployment
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── firestore.rules        # Firestore security rules
└── firebase-applet-config.json  # Firebase configuration
```

## Features

- **User Authentication**: Firebase Auth (Email/Password, Google)
- **Patient Dashboard**: Track exercises and recovery progress
- **Doctor Dashboard**: Monitor patient progress
- **Exercise Tracking**: Record and monitor rehabilitation exercises
- **Progress Charts**: Visual representation of recovery metrics
- **Role-Based Access**: Separate views for patients and doctors

## Development Workflow

### TypeScript Checking

```bash
npm run lint
```

### Clean Build

```bash
npm run clean
```

### Preview Production Build

```bash
npm run preview
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
# For dev mode
npm run dev -- --port 3001

# For server mode, edit server.ts or set PORT env var
PORT=3001 npm run server
```

### Firebase Connection Issues

1. Ensure your `.env.local` has correct Firebase credentials
2. Check Firestore security rules in `firestore.rules`
3. Verify your IP/domain is allowed in Firebase Console authentication settings
4. Check browser console for detailed error messages

### Build Errors

```bash
npm run clean
npm install
npm run build
```

## Deployment

To deploy this app to production:

1. **Azure App Service**: Use `npm run start` as the startup command
2. **Vercel/Netlify**: Configure with `npm run build` and `dist/` as output
3. **Docker**: Build with the included Dockerfile configuration
4. **Firebase Hosting**: Use `npm run build` and deploy the `dist/` folder

## Environment Variables

The app uses the following environment variables (define in `.env.local`):

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Yes |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | Yes |
| `VITE_APP_PORT` | Server port (optional, defaults to 3000) | No |

## Related Files

- `firestore.rules` - Firestore database security rules
- `firebase-applet-config.json` - Firebase app configuration
- `firebase-blueprint.json` - Firebase project blueprint

## License

Apache 2.0

## Support

For issues or questions about the app:
1. Check browser console for error messages
2. Verify Firebase configuration
3. Check Firestore database rules
4. Review network requests in browser DevTools
