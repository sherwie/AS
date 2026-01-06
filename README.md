# Next.js App

A minimal Next.js application with TypeScript and the App Router.

## Project Structure

```
├── app/                  # App Router directory
│   ├── layout.tsx        # Root layout (wraps all pages)
│   ├── page.tsx          # Home page (/)
│   └── globals.css       # Global styles
├── public/               # Static assets
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
├── eslint.config.mjs     # ESLint configuration
└── package.json          # Dependencies and scripts
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)
- [TypeScript](https://www.typescriptlang.org/)
