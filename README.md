# MCP Panel

A control panel on Bootstrap 5 / CoreUI, running on the Next.js 16 App Router.

The panel is the **control plane** for an MCP (Model Context Protocol) server: it manages AI
model connections, tool definitions and the host inventory, and it starts runs. The MCP
server itself is a separate application; it reads the definitions kept here and exposes the
tool surface.

## Running it

The panel talks to the **`mcp-gateway`** backend; on its own it shows nothing.

```bash
cp .env.example .env.local        # CONFIG_SERVER_URL, http://127.0.0.1:8888 by default
npm install
npm run dev
```

It opens on [http://localhost:3000](http://localhost:3000) and redirects to `/login` when
there is no session. Create an account through `/register`; the first user arrives as a
`viewer` and has to be made `admin` in the database before it can write.

`npm run dev:logged` runs the same server and appends its output to
`$MCP_LOG_DIR/mcp-panel.log` (`~/mcp-logs` by default), which is where the log stack reads
it from.

## Where the settings come from

The panel's settings live in **`mcp-config`**, in `config-repo/mcp-panel.yml`. The panel
reads that on the server, resolves `${NAME:default}` placeholders against its own
environment, and passes the browser's share of it through `/api/config`.

The backend address is not baked in with `NEXT_PUBLIC_API_URL` any more. `NEXT_PUBLIC_`
variables are written into the bundle at build time — the address would be fixed at
compilation and a settings change would mean rebuilding. So the value is read at run time
instead; only the `/api/config` route is dynamic, and the rest of the pages stay static.

`NEXT_PUBLIC_API_URL` remains as a **last resort**: if the config server cannot be reached
the panel carries on with it and says so in a banner. Falling back silently would be
indistinguishable from a panel that is configured correctly.

The environment badge in the header comes from the same file; anything other than `local` is
coloured to be noticed.

## Documentation

| Document | What it holds |
|---|---|
| [`docs/PANEL.md`](docs/PANEL.md) | This application — routes, the definition model, file layout, theme, known limits |

The rest belongs to the stack rather than to the panel, and lives in `mcp-starter`:

| Where | What |
|---|---|
| `mcp-starter/docs/changes/` | Why things are the way they are — one note per area of work |
| `mcp-starter/docs/database/` | The schema, its migrations, and the rules embedded in it |
| `mcp-starter/env/` | One environment template per service |
| `mcp-starter/observability/` | Loki, Grafana and Alloy — where the six services' logs go |

## Scripts

```bash
npm run dev         # development server
npm run dev:logged  # the same, with its output appended to a log file
npm run build       # production build
npm run lint        # eslint
npm test            # vitest
```

## Status

Models, definitions, host groups, users and logs come from a real database through
`mcp-gateway`. The browser stores nothing but the session tokens and the language and theme
preference.

Actions **run**. A sentence typed into the console is routed to a tool, planned, checked by
the guardrails, and — with the box ticked — dispatched to the executor, which carries it out
over SSH, against a database, or as an HTTP call. What it returns comes back as a table.
Anything that writes and was not typed by a person is held until somebody approves the
command they can see.

What is not finished is listed in the "Known limits" section of
[`docs/PANEL.md`](docs/PANEL.md), and there is enough of it to be worth reading before
relying on any one part.
