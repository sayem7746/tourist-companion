# Frontend

Angular 20 standalone app for Tourist Companion (web and mobile browsers).

## Prerequisites

- Node.js 20+ (this workspace was generated with Node 24)

## Commands

```bash
cd frontend
npm install
npm start                 # http://localhost:4200 (development environment)
npm run build             # production build
npm test -- --watch=false --browsers=ChromeHeadless
npm run lint
npm run format
```

Development API URL defaults to `http://localhost:3000`. See `.env.example` and `src/environments/`.
