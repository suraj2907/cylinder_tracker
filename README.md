# 🛢️ Cylinder Tracker

A highly optimized, premium web dashboard and Progressive Web App (PWA) designed to track, manage, and reconcile commercial gas cylinder inventory (19.2kg and 21kg) with absolute accuracy.

Built with **React 19**, **Vite**, **Tailwind CSS**, and **Supabase**.

---

## ✨ Features

- **📊 Modern Analytics Dashboard**: Real-time overview of outstanding cylinders, total deliveries, and returns per product type (19.2kg & 21kg).
- **📅 Interactive Calendar View**: Track deliveries and empty returns day-by-day with customized daily highlights and list logs.
- **🏷️ Restaurant & Buyer Insights**: Deep dive into individual customer balance ledgers, transaction histories, and specific outstanding counts.
- **🛡️ Strict Quota-Based Reconciler**: Mathematical validation model that prevents over-allocation and correctly parses sales ledgers to resolve rate overlap.
- **🔌 Supabase Integration**: Reliable cloud synchronization and persistent storage for gas inventory entries.
- **📱 PWA Mobile First**: Fully offline-capable, custom app icons, installable to phone home screens, and smooth micro-animations.

---

## 🛠️ Tech Stack

- **Core**: React 19, Javascript (ES6+)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS, PostCSS
- **Database**: Supabase
- **PWA Capabilities**: Service Worker & Web App Manifest

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/suraj2907/cylinder_tracker.git
cd cylinder_tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

### 4. Run Locally
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

---

## ☁️ Deploying to Vercel (Recommended)

Vercel is the ideal hosting solution for this project. It provides instant deployments, automatic SSL, and continuous integration (CI) from GitHub.

### Step-by-Step Deployment Guide:

1. **Sign up/Log in to Vercel**:
   Go to [vercel.com](https://vercel.com/) and log in using your GitHub account.

2. **Import Project**:
   - Click the **"New Project"** button in your dashboard.
   - Find your **`cylinder_tracker`** repository and click **"Import"**.

3. **Configure Environment Variables**:
   In the Vercel project configuration page, expand the **Environment Variables** section and add the two variables from your `.env` file:
   - **Key**: `VITE_SUPABASE_URL` | **Value**: *(Your Supabase URL)*
   - **Key**: `VITE_SUPABASE_ANON_KEY` | **Value**: *(Your Supabase Anon Key)*

4. **Deploy**:
   - Click the **"Deploy"** button.
   - Vercel will automatically build the React Vite bundle and deploy it live!
   - Every time you push a commit to the `main` branch on GitHub, Vercel will automatically redeploy the latest changes.

---

## 🔒 Security Note
The `.env` file has been added to `.gitignore` to prevent database API keys from leaking online. Never check `.env` into git.
