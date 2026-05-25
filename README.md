# TaskFlow

A full-stack task management application built as a monorepo.

## Structure

```
TaskFlow/
├── task-api/   # REST API — Fastify 5, Prisma 5, PostgreSQL, Redis
└── task-web/   # Frontend — React 19, Vite 5, TanStack Router/Query
```

## Getting Started

### Prerequisites

- Node.js 22+
- Docker (for PostgreSQL + Redis)
- Yarn

### Backend (task-api)

```bash
cd task-api
cp .env.example .env   # fill in your values
docker-compose up -d   # start PostgreSQL + Redis
yarn install
yarn prisma migrate dev
yarn dev
```

### Frontend (task-web)

```bash
cd task-web
yarn install
yarn dev
```

The API runs on `http://localhost:3000` and the frontend on `http://localhost:5173`.
