# 🪡 StitchDrive

**Unified Cloud Storage Pooler** — Stitch Drive aggregates multiple free Google Drive accounts into a single, high-performance storage pool. Never worry about reaching the 15GB limit again.

> **Privacy First:** StitchDrive is self-hosted. Your files stay in your own Google accounts, and your credentials never leave your control.

---

## ✨ Features

-   **🌐 Unified Storage Pool:** Combine as many Google accounts as you want into one seamless dashboard (N × 15GB free storage).
-   **🚀 Smart Upload Routing:** Automatically routes uploads to the account with the most available space using a Least-Used-Space strategy.
-   **📁 Advanced File Management:** Full folder hierarchy navigation, breadcrumbs, grid/list views, and powerful searching.
-   **📤 Drag-and-Drop:** Intuitive file uploads and folder organization via a modern, slide-in interface.
-   **♻️ Smart Trash System:** Safely delete files to Google Drive trash; restore or permanently purge them with a single click.
-   **📊 Real-time Analytics:** Visual breakdowns of storage usage per account, file type distributions, and activity charts.
-   **🔒 Secure by Design:**
    -   **Clerk Authentication:** Enterprise-grade identity management.
    -   **Client-Side Credentials:** decentralised credential management ensures your Google Cloud secrets are handled securely.
    -   **Encrypted Tokens:** All OAuth refresh tokens are encrypted at rest using AES-256.
-   **🎨 Premium UI:** A stunning "glassmorphism" aesthetic with full dark/light mode support and smooth micro-animations.

---

## 🛠️ Tech Stack

-   **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), [Tailwind CSS](https://tailwindcss.com/)
-   **Backend:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
-   **Database:** [MongoDB](https://www.mongodb.com/) (Local or Atlas)
-   **Auth:** [Clerk](https://clerk.com/)
-   **API:** [Google Drive API v3](https://developers.google.com/drive/api)

---

## 🚀 Quick Start

### 1. Prerequisites
-   **Node.js 18+** & **npm**
-   **MongoDB** (running locally or a MongoDB Atlas connection string)
-   **Clerk Account** (for authentication)
-   **Google Cloud Project** (for Drive API access)

### 2. Clerk Configuration
1.  Create a new application in the [Clerk Dashboard](https://dashboard.clerk.com/).
2.  Enable **Email** and/or **Google** social login.
3.  Copy your **Publishable Key** and **Secret Key**.

### 3. Google Cloud Setup
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project named `StitchDrive`.
3.  Enable the **Google Drive API**.
4.  Configure the **OAuth Consent Screen**:
    -   User Type: **External**.
    -   Add yourself (and any other accounts you plan to connect) as **Test Users**.
5.  Create **OAuth Client ID** (Web Application):
    -   Authorized Redirect URI: `http://localhost:8000/api/auth/callback`
6.  Download the JSON credentials file. **Keep this file safe**; you will upload it into the app later.

### 4. Installation & Environment

Clone the repository:
```bash
git clone https://github.com/Atifhasan250/stitch-drive.git
cd stitch-drive
```

#### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```
Edit `backend/.env`:
-   `MONGO_URI`: Your MongoDB connection string.
-   `CLERK_PUBLISHABLE_KEY`: Your Clerk keys.
-   `CLERK_SECRET_KEY`: Your Clerk keys.

#### Frontend Setup
```bash
cd ../frontend
npm install
cp .env.example .env
```
Edit `frontend/.env`:
-   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk keys.
-   `CLERK_SECRET_KEY`: Your Clerk keys.
-   `NEXT_PUBLIC_API_URL`: `http://localhost:8000`

### 5. Running the Application

Open two terminal windows:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to get started!

---

## 📖 Usage Guide

1.  **Login:** Sign up/Login via the Clerk authentication screen.
2.  **Initialize Credentials:** Upon first login, you will be prompted to upload the `credentials.json` file you downloaded from Google Cloud. This is stored securely in your browser's local context and used for API interaction.
3.  **Connect Accounts:** Navigate to **Settings** → **Connect another account**. Pick any Google account you want to add to your storage pool.
4.  **Upload:** Go to the **Dashboard** and start dragging files. StitchDrive will handle the rest!

---

## 🐳 Docker (Experimental)

A `docker-compose.yml` is provided for containerized deployment. Note that you must still provide the necessary environment variables in the `frontend` and `backend` directories before running:

```bash
docker-compose up --build
```

---

## 🛡️ Security & Privacy

-   **Data Ownership:** StitchDrive does not host your files. They reside on Google's infrastructure.
-   **Local Secrets:** Your `credentials.json` and OAuth tokens are stored and processed using secure, decentralized patterns.
-   **No Hidden Costs:** Completely open-source and free to use forever.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ❤️ by [Atif Hasan](https://atifs-info.vercel.app/)
