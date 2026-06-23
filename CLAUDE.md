# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stato del progetto

**Slice verticale end-to-end funzionante.** Monorepo pnpm + Turborepo. Si può creare Organizzazione → Progetto → Istanza di connettore (GitHub), con `testConnection`, credenziali cifrate a riposo (AES-256-GCM), e invocazione delle capability **senza AI**. Persistenza su Postgres via Prisma. Aggiornare questo file man mano che il codice cresce.

## Comandi

Richiede **Node 20** (`nvm use 20`) e **pnpm** (via `corepack enable`). Dalla root:

```bash
pnpm install          # installa tutto il workspace
pnpm build            # build di tutti i pacchetti/app (turbo, in ordine di dipendenza)
pnpm dev              # avvia core (3001) e web (3000) in watch
pnpm typecheck        # typecheck di tutto
pnpm lint             # lint di tutto

# singola app/pacchetto:
pnpm --filter @orbit/core dev
pnpm --filter @orbit/web build
pnpm --filter @orbit/core... build   # build di un'app + le sue dipendenze interne

# ambiente locale:
docker compose up                       # solo Postgres (per sviluppo con pnpm dev)
docker compose --profile full up --build  # Postgres + core + web in container

# database (da apps/core, richiede Postgres attivo e .env):
pnpm --filter @orbit/core prisma:migrate   # crea/applica migrazioni in dev
pnpm --filter @orbit/core prisma:generate  # rigenera il Prisma Client
pnpm --filter @orbit/core prisma:studio    # GUI sul DB
```

Prima esecuzione: `cp .env.example .env`, genera `ORBIT_ENCRYPTION_KEY` (`openssl rand -base64 32`) e `JWT_SECRET` (`openssl rand -base64 48`), `docker compose up -d postgres`, poi `pnpm --filter @orbit/core prisma:migrate`. Quindi `POST /api/auth/register` per creare il primo utente e usare il suo `accessToken`.

Endpoint core attuali (tutto richiede `Authorization: Bearer <accessToken>` salvo i `@Public`):
- `GET  /api/health` *(public)*
- `GET  /api/connectors` · `GET /api/connectors/:type/tools` *(public — catalogo, non dati tenant)*
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/refresh` *(public)* · `GET /api/auth/me`
- `POST /api/organizations` — crea org e rende il creatore `owner` · `GET /api/organizations` *(solo le proprie)* · `GET /api/organizations/:id`
- `POST /api/projects` · `GET /api/projects?orgId=` · `GET /api/projects/:id`
- `POST /api/projects/:projectId/connectors` — crea istanza (valida config/credentials, `testConnection`, cifra le credenziali)
- `GET  /api/projects/:projectId/connectors`
- `POST /api/connector-instances/:id/capabilities/:name` — invoca una capability (path senza AI)

## Auth & RBAC

- **Auth nel core, OIDC-ready.** Local email/password (argon2) + JWT access/refresh. `JwtAuthGuard` è globale (`APP_GUARD`); le rotte pubbliche usano `@Public()`. L'utente autenticato si legge con `@CurrentUser()`.
- **Seam OIDC:** `IdentityProvider` (oggi `LocalPasswordProvider`) + campi `provider`/`externalId` su `User`. Keycloak/OIDC si innesta qui in futuro come layer `identity`, senza toccare l'autorizzazione.
- **RBAC per organizzazione:** `Membership(userId, orgId, role)` con ruoli `owner > admin > member > viewer` ([ROLE_RANK in auth.ts](packages/shared/src/auth.ts)). Le autorizzazioni si fanno nei service via `AccessControlService.assertMember(userId, orgId, minRole)`. Progetti e connettori sono scopizzati all'org del progetto; le capability read-only richiedono `viewer`, quelle che mutano `member`.

## Struttura del monorepo

```
apps/
  core/                @orbit/core  — NestJS (CommonJS)
    prisma/            schema + migrazioni (User, Membership, Organization, Project, ConnectorInstance)
    src/prisma/        PrismaModule/Service (global)
    src/crypto/        CryptoService AES-256-GCM per credenziali (global)
    src/auth/          register/login/refresh, JWT strategy, JwtAuthGuard, @Public/@CurrentUser, IdentityProvider
    src/authz/         AccessControlService (assertMember + ruoli, global)
    src/common/        ZodValidationPipe
    src/organizations/ src/projects/   CRUD dominio (scopizzati per utente)
    src/connectors/    registry connettori, tipi+tool MCP, istanze, invoke capability
  web/                 @orbit/web   — Next.js (App Router, React 19)
packages/
  shared/              @orbit/shared        — tipi dominio con zod (Org, Project, Layer, Connector)
  connector-sdk/       @orbit/connector-sdk — contratto connettori (Capability, ApiCatalog, Registry, mcp)
  connectors/
    github/            @orbit/connector-github — prima integrazione (repos/issues, read-only)
```

**Aggiungere un connettore:** creare `packages/connectors/<nome>` che esporta una `ConnectorDefinition` (vedi `github`), poi registrarlo nel registry in `apps/core/src/connectors/connectors.module.ts`. Il core non importa mai gli interni di un connettore: dipende solo dal contratto `@orbit/connector-sdk`.

**Credenziali:** mai in chiaro nel DB o nelle risposte. Si validano contro `credentialsSchema` del connettore, si cifrano con `CryptoService` (`ORBIT_ENCRYPTION_KEY`), e i campi restituiti escludono `encryptedCredentials`.

**Vincolo ESM/CJS:** i pacchetti condivisi compilano in **CommonJS** (niente `"type": "module"`) così sia Nest (CJS) sia Next (bundler) li consumano senza interop. Il core usa `module: commonjs` + `moduleResolution: node`. Non reintrodurre `"type": "module"` nei pacchetti senza adeguare il core.

## Visione

**ORBIT** è un orchestratore/centralizzatore/connettore open source che unifica i principali applicativi enterprise usati da un'azienda. Non ha lock-in verso un singolo vendor: è la **vista dall'alto** sull'intera infrastruttura di un'organizzazione, con la possibilità di entrare nel dettaglio di ogni strumento connesso.

Due livelli di valore, in quest'ordine:
1. **Senza AI (priorità iniziale):** navigare, cercare e visualizzare un **grafo** dell'infrastruttura e delle relazioni tra servizi/progetti; chiamare le API dei servizi connessi.
2. **Con AI (fase successiva, NON da costruire per prima):** uno o più agenti (multi-agente orchestrato) che operano su tutto — documentazione, task, sviluppo, deploy, workflow — con tool/permessi/contesti, usando i connettori già mappati.

Principio guida: **prima una base solida senza AI**, poi l'AI ci si appoggia sopra.

## Architettura di alto livello

- **Core** — NestJS. API, auth, gestione Organizzazioni/Progetti, registry dei connettori, knowledge/grafo. Richiede **Node 20 LTS** (Node 18 minimo).
- **Frontend** — **Next.js (React)**, web-first. Grafo con React Flow o Cytoscape.js; tabelle dense con TanStack Table; dati server con TanStack Query (+ Zustand per stato UI). Multipiattaforma desktop/mobile rimandato a fasi successive (valutare Tauri o app dedicata). *Scelta presa dopo aver valutato e scartato Flutter ed Electron per l'MVP web-first.*
- **Connettori/Integrazioni** — pacchetti separati e indipendenti (probabilmente NestJS). **DA DECIDERE esplicitamente in fase di design:** se ogni connettore sia un **MCP server** (modello stile Claude Desktop), una libreria interna, o entrambi.

## Concetto centrale: registry unificato Connettori (API + MCP)

Il cuore del progetto. Per ogni servizio si mappa **una volta sola**:
- la lista di **API** del servizio (organizzate per argomento);
- il/i suo/i **MCP server**.

La stessa definizione deve essere utilizzabile sia come **tool MCP** (per gli agenti) sia come **chiamata fetch API** diretta (utilizzabile anche senza AI). Astrazione comune dei connettori → aggiungere un nuovo servizio deve costare poco.

Servizi self-hosted via Docker (es. Keycloak) espongono API proprie che vanno tracciate nel registry. **Da chiarire:** se siano "connettori" veri o un concetto separato — seguire best practice enterprise, separare i concetti solo quando serve, evitare over-engineering.

## Modello di dominio

```
Organizzazione → Progetti → Layer → Connettori (API + MCP)
```
Si può creare un'organizzazione con i suoi progetti, oppure un progetto diretto. Dal **dettaglio progetto** si vedono tutti i layer collegati e le relative integrazioni.

## Layer / Domini da mappare

Ogni layer è una categoria di servizi intercambiabili (con varianti):
- **Server / hosting:** Aruba, Hetzner, OVH, …
- **Cloud:** AWS, GCP, Azure (valutare se includere subito o rimandare)
- **Infrastruttura:** Kubernetes, Docker, Docker Compose, Terraform (decidere se l'IaC è un layer a sé)
- **Repository:** Git, GitHub, GitLab, …
- **Task management:** Jira e alternative
- **Documentazione:** Confluence e alternative
- **Test:** security, integration, servizi esterni
- **Monitoring:** log, metriche, alerting
- **Posta elettronica:** Gmail e alternative enterprise
- **Servizi self-hosted (Docker):** Keycloak e altri

## Knowledge / RAG / Grafo + Modelli

- **Grafo della conoscenza** del progetto, popolato prendendo dati dai servizi integrati; navigabile, ricercabile, visualizzabile.
- **Chat** per discutere dell'intera infrastruttura.
- **Connettore unificato verso i modelli:** il sistema si collega a *tutti* i modelli che l'utente usa — **locali** (Ollama / LM Studio) o **a pagamento** (Anthropic, OpenAI, …). È l'utente a scegliere quale modello alimenta chat e agenti.

## Principi

- **Open source**, senza lock-in; supporto a prodotti europei e americani.
- **Non costruire l'agente AI per primo.** Prima configurazione, modello dati, e gestione connettori.
- **MVP verticale, non orizzontale:** portare end-to-end UN layer + UN connettore (org → progetto → connessione → dati nel grafo → ricerca) prima di replicare sugli altri.
- Best practice enterprise; separare i concetti solo quando serve, niente over-engineering.

## Decisioni aperte (da risolvere prima/durante l'implementazione)

- Connettori: MCP server vs libreria vs entrambi.
- Struttura monorepo e gestione dei pacchetti.
- Quale sia il primo connettore dell'MVP (candidato naturale: GitHub).
- Se Cloud (AWS/GCP/Azure) entra nell'MVP o viene rimandato.
- Collocazione di Terraform/IaC e dei servizi self-hosted nel modello.

## Prerequisiti ambiente

- **Node 20** (`nvm use 20`; un `.nvmrc` è presente in root) e **pnpm** via `corepack enable`.
- Per l'ambiente locale completo: Docker + Docker Compose.
- I segreti vanno in `.env` (copiare da `.env.example`). Le **credenziali per-connettore** NON vanno in env: si inseriscono per progetto nell'app e si salvano cifrate nel DB (vedi nota in `.env.example`).
