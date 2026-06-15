# Sysopoly PDF Tools

A lightweight, privacy-focused web application for merging, reordering, and deeply compressing PDF files. 

This project combines an incredibly fast React/Astro frontend for simple client-side tasks (like page reordering) with a Go-based backend microservice utilizing Ghostscript for aggressive image compression downsampling when you need to severely reduce PDF file sizes.

## 🚀 Features

- **100% Client-Side Merging**: Rearrange, delete, and merge PDFs directly in your browser securely using `@libpdf/core`.
- **Drag-and-Drop Organization**: Seamlessly reorder extracted pages interactively with `@dnd-kit`.
- **Deep Compress Mode**: Offloads massive PDF reductions to a secure Go backend microservice powered by `ghostscript`. Files are optimized entirely in-memory/temp-storage and are immediately destroyed.
- **Multiple Compression Levels**: Choose between Extreme (Screen), High (eBook), and Medium (Printer) quality settings for compression.

## 🛠️ Stack

- **Frontend**: Astro, React, Tailwind CSS, pdfjs-dist
- **Backend Compression API**: Go (Gin)
- **Containerization**: Docker Compose

## 🧞 Getting Started

### 1. Start the Backend API (Docker)

Make sure you have Docker Desktop running.

```sh
docker compose up -d --build
```

The Go Gin backend will run on port `8080`, exposing the `/api/compress` endpoint.

### 2. Start the Frontend (Astro/Node)

```sh
npm install
npm run dev
```

The frontend will run at `http://localhost:4321`. Vite proxy automatically routes `/api/*` to the Docker backend.

## 🔒 Privacy & Security

We believe in strict data privacy. When making non-destructive edits and merges, your file stays 100% locally in your RAM. When utilizing Deep Compress, the PDF is securely piped into a temporary backend environment, crushed using Alpine Linux + Ghostscript, returned to your browser, and immediately eradicated from the backend server perfectly synchronizing speed and privacy.
