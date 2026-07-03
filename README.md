<div align="center">

<img src="https://placehold.co/120x120/7c3aed/ffffff?text=SQL&font=montserrat" alt="SQL Studio Logo" width="96" height="96" style="border-radius: 20px;" />

<h1>SQL Studio</h1>

<p><strong>AI-powered, offline-first SQLite workspace that runs entirely in your browser.</strong></p>

<p>
  <a href="https://sqlstudio.app"><img src="https://img.shields.io/badge/Live%20Demo-sqlstudio.app-7c3aed?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  &nbsp;
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick%20Start-Get%20Running-10b981?style=for-the-badge&logo=gnometerminal&logoColor=white" alt="Quick Start" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" />
  &nbsp;
  <img src="https://img.shields.io/badge/SQLite-WebAssembly-blue?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite WASM" />
</p>

---

<!-- Hero Screenshot -->
<img src="https://placehold.co/1200x630/09090b/7c3aed?text=SQL+Studio+%E2%80%94+AI+SQLite+Workspace&font=montserrat" alt="SQL Studio workspace screenshot" width="100%" style="border-radius: 12px; border: 1px solid #27272a;" />

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **AI SQL Copilot** | Natural language → optimized SQL, powered by Hugging Face |
| 📝 **Monaco Editor** | VS Code-grade autocomplete, syntax highlighting, and error detection |
| 🗂️ **Schema Designer** | Drag-and-drop ER diagram builder with DDL export |
| 📊 **Data Explorer** | Spreadsheet-style table browser with inline cell editing |
| 🌱 **Mock Data Seeder** | Faker.js-powered data seeding — just pick a table and row count |
| 🔀 **SQL Diff & Migrations** | Snapshot schema changes and generate migration DDL scripts |
| 🔒 **100% Offline** | Everything runs in your browser via WebAssembly — zero data leaks |

---

## 🖼️ Screenshots

<table>
  <tr>
    <td align="center">
      <img src="https://placehold.co/560x340/09090b/8b5cf6?text=Query+Editor&font=montserrat" alt="Query Editor" width="100%" /><br />
      <sub><b>Monaco SQL Editor</b></sub>
    </td>
    <td align="center">
      <img src="https://placehold.co/560x340/09090b/6366f1?text=ER+Schema+Designer&font=montserrat" alt="Schema Designer" width="100%" /><br />
      <sub><b>Visual ER Graph Designer</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://placehold.co/560x340/09090b/0ea5e9?text=Data+Explorer&font=montserrat" alt="Data Explorer" width="100%" /><br />
      <sub><b>Spreadsheet Data Explorer</b></sub>
    </td>
    <td align="center">
      <img src="https://placehold.co/560x340/09090b/10b981?text=AI+Copilot+Chat&font=montserrat" alt="AI Copilot" width="100%" /><br />
      <sub><b>AI Copilot Assistant</b></sub>
    </td>
  </tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** `>=18.x`
- **npm** `>=9.x` (or yarn / pnpm / bun)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/sqlstudio.git
cd sqlstudio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Required — Hugging Face Space endpoint for AI Copilot
HUGGINGFACE_SPACE_URL=https://your-space.hf.space

# Optional — override the public site URL for SEO / OG tags
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Project Structure

```
sqlstudio/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Landing page
│   │   ├── workspace/          # Main SQL editor workspace
│   │   ├── designer/           # ER schema designer
│   │   ├── explorer/           # Data table explorer
│   │   ├── mock-data/          # Mock data seeder
│   │   ├── diff/               # SQL diff & migrations
│   │   ├── api/                # API routes (AI chat, DB ops)
│   │   ├── layout.tsx          # Root layout + SEO metadata
│   │   └── sitemap.ts          # Auto-generated sitemap
│   └── components/             # Shared UI components
├── public/
│   ├── sql-wasm.wasm           # SQLite WebAssembly binary
│   ├── robots.txt              # Crawler configuration
│   └── site.webmanifest        # PWA manifest
├── next.config.ts              # Next.js config + security headers
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Database Engine** | [sql.js](https://sql.js.org) — SQLite compiled to WebAssembly |
| **Code Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **AI Backend** | [Hugging Face Spaces](https://huggingface.co/spaces) (Gradio API) |
| **Diagrams** | [React Flow](https://reactflow.dev) |
| **Mock Data** | [Faker.js](https://fakerjs.dev) |
| **Icons** | [Lucide React](https://lucide.dev) |

---

## 🔐 Security

SQL Studio ships with a full suite of HTTP security headers configured in [`next.config.ts`](./next.config.ts):

- **Content-Security-Policy** — strict source allowlist (WASM-compatible)
- **Strict-Transport-Security** — enforces HTTPS for 1 year
- **X-Frame-Options: SAMEORIGIN** — prevents clickjacking
- **X-Content-Type-Options: nosniff** — stops MIME-sniffing
- **Permissions-Policy** — disables camera, mic, geolocation, payments
- **Cross-Origin-Opener / Embedder / Resource Policy** — full isolation

---

## 📦 Available Scripts

```bash
npm run dev        # Start development server (http://localhost:3000)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

---

## 🚢 Deployment

### Deploy to Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new?utm_source=github&utm_medium=readme&utm_campaign=sqlstudio)

Set the following environment variables in your Vercel project dashboard:

| Variable | Description |
|---|---|
| `HUGGINGFACE_SPACE_URL` | Your Hugging Face Space endpoint |
| `NEXT_PUBLIC_SITE_URL` | Your production domain (e.g. `https://sqlstudio.app`) |

---

## 📄 License

MIT © SQL Studio Team

---

<div align="center">
  <sub>Built with ❤️ for database engineers — entirely offline, entirely yours.</sub>
</div>
