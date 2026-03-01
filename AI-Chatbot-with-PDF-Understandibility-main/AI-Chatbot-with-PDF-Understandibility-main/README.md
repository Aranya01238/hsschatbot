
---

# 🤖 Gemini Hospital Chatbot

A modern, AI-powered hospital receptionist chatbot built with **Next.js**, **Shadcn UI**, **Tailwind CSS**, and **Gemini API**. This chatbot supports:

* ✅ Smart AI chat powered by Gemini
* 📄 PDF upload and content extraction
* 🗑️ File removal with tooltip UX
* 🌞 Light/Dark theme support
* ⚡ Responsive and clean UI


---

## 🚀 Features

* **Conversational AI**: Uses Google's Gemini API for smart, contextual chat.
* **PDF Understanding**: Upload a medical report or document—chatbot understands and responds with context.
* **Tooltip with File Remove**: Hover to remove uploaded files from memory.
* **Shadcn UI**: Clean, accessible, and responsive components.
* **Light/Dark Mode**: Follows system preference for themes.
* **Typed with TypeScript**: Full type safety and scalability.

---

## 🛠️ Installation

```bash
git clone https://github.com/your-username/gemini-hospital-chatbot.git
cd gemini-hospital-chatbot
npm install
```

---

## 🧪 Running Locally

1. **Start Backend (Node.js)**

Ensure you have a Gemini backend running (e.g., with a FastAPI or Node.js service exposing the Gemini API).

Example: `http://localhost:3001/gemini`

2. **Run Frontend**

```bash
npm run dev
```

App runs at `http://localhost:3000`

---

## ⚙️ Environment Variables

Create a `.env.local` file for any required environment settings (optional):

```
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/gemini
```

> You can also hardcode `API_URL` directly in `Chat.tsx`.

---

## 📁 Project Structure

```
/components       → Reusable UI (Input, Button, Tooltip, etc.)
/pages            → Entry point for Next.js
/lib/utils.ts     → Utility functions (like `cn`)
/public           → Static files (e.g., screenshot)
/styles           → Global styles
```

---

## 📦 Dependencies

* [Next.js](https://nextjs.org/)
* [Shadcn UI](https://ui.shadcn.com/)
* [Tailwind CSS](https://tailwindcss.com/)
* [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist)
* [Lucide React](https://lucide.dev/)
* [TypeScript](https://www.typescriptlang.org/)

---

## 🧠 AI Integration

* Uses Gemini API to generate conversational responses.
* Merges chat history and extracted PDF text before sending queries.

---

## 📄 PDF Support

* Extracts text using `pdfjs-dist`
* Worker is configured locally (`pdf.worker.mjs`) for sandbox compatibility.

---

## 💡 TODO

* [ ] Add authentication (JWT or Clerk)
* [ ] Save chat history to database
* [ ] Support multiple file types
* [ ] Add emoji or image support in chat

---

## 🤝 Contribution

Pull requests and suggestions are welcome!
Please open an issue first to discuss changes.

---

## 📄 License

[MIT](LICENSE)

---
