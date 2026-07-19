# Virtual Folder

This repository is a pnpm workspace for a virtual-folder library and its example applications.
The library is intended to remain independent of MQL5, React, databases, hosting providers,
and operating-system-specific absolute paths. Platform-specific behavior belongs in adapters.

## Requirements

- Node.js 22.18 or newer
- Corepack

No global pnpm, Java, or Python installation is required.

## Setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

`pnpm install` must be run once from the repository root. Do not run `npm install` in individual
workspace packages.

## Configuration

The Vite applications run without environment variables. The following variables are optional:

- `PORT`: development-server port
- `BASE_PATH`: deployed base path (defaults to `/`)

The API server requires `DATABASE_URL` only when database-backed functionality is started.

## Common commands

```sh
# Run the API server
pnpm --filter @workspace/api-server run dev

# Run the folder-organizer UI
pnpm --filter @workspace/folder-organizer run dev

# Regenerate API clients and schemas
pnpm --filter @workspace/api-spec run codegen

# Apply the database schema in development
pnpm --filter @workspace/db run push
```

The database commands and API runtime require a PostgreSQL connection string in
`DATABASE_URL`. Installation, type checking, and frontend builds do not require a database.

## Architecture direction

The reusable virtual-folder module must not depend on MQL5. MQL5 file operations and include
resolution will be added later as adapters that consume the generic library interface.
