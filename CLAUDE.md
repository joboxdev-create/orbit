# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stato del progetto

**Slice verticale end-to-end funzionante.** Monorepo pnpm + Turborepo. Si può creare Organizzazione → Progetto → Istanza di connettore (GitHub o **Keycloak**), con `testConnection`, credenziali cifrate a riposo (AES-256-GCM), e invocazione delle capability **senza AI**. Persistenza su Postgres via Prisma. **L'autenticazione a ORBIT è interna**: ORBIT è autorità d'identità di sé stesso (email/password con argon2id, JWT emessi dal core), con un **admin di bootstrap** seedato da env. **Keycloak è solo un connettore** (data plane), mai l'IdP di login. Aggiornare questo file man mano che il codice cresce.

**Copertura attuale (web vs API):** il **web** copre login, navigazione context-aware (sidebar piattaforma + sidebar org/progetto), CRUD Organizzazioni e Progetti via Dialog, visualizzazione layer e istanze connettore per progetto. **Creazione di istanze connettore** e **invocazione capability** esistono solo a livello di **API core** (nessuna UI ancora) — vedi *Prossimi passi*. La dashboard è accessibile a tutti gli utenti autenticati (il gate `admin`-only è stato rimosso).

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
docker compose up -d postgres            # Postgres (sufficiente per l'auth interna)
docker compose up -d postgres keycloak   # + Keycloak (solo per testare il CONNETTORE Keycloak)
docker compose --profile full up --build # Postgres + core + web in container

# database (da apps/core, richiede Postgres attivo e .env):
pnpm --filter @orbit/core prisma:migrate   # crea/applica migrazioni in dev
pnpm --filter @orbit/core prisma:generate  # rigenera il Prisma Client
pnpm --filter @orbit/core prisma:studio    # GUI sul DB
```

Prima esecuzione (vedi **Configurazione ambiente** sotto per chi legge cosa): copia i tre `.env.example`, genera i segreti, `docker compose up -d postgres`, poi `pnpm --filter @orbit/core prisma:migrate`. All'avvio il core seeda l'admin di bootstrap (idempotente) da `ORBIT_ADMIN_EMAIL`/`ORBIT_ADMIN_PASSWORD`. Il login avviene dal web (`:3000`, pagina `/login`) con email/password; il `Bearer` token usato dal core è **emesso dal core stesso**.

### Configurazione ambiente

Tre file env distinti, **uno per consumatore** — non un unico `.env` di root. Ogni cartella ha il suo `.env.example` da copiare; tutti i file reali sono gitignorati (`.env`, `.env.*`, tranne `*.example`).

| File | Chi lo legge | Variabili |
|------|--------------|-----------|
| **`apps/core/.env`** | NestJS (`ConfigModule`) **e** Prisma CLI | `DATABASE_URL`, `ORBIT_ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_*_TTL`, `ORBIT_ADMIN_EMAIL/PASSWORD`, `PORT` |
| **`apps/web/.env.local`** | Next.js | `AUTH_SECRET`, `AUTH_URL`, `CORE_API_URL`, `PORT` |
| **`/.env`** (root) | solo `docker-compose` | `POSTGRES_*`, + interpolazione per il profilo `full` |

Punti che fanno perdere tempo se non noti:
- **NestJS** legge `.env.local` poi `.env` ([app.module.ts](apps/core/src/app.module.ts) imposta `envFilePath`); **Prisma CLI** legge **solo `.env`**. Per questo le var del core stanno in un **unico `apps/core/.env`**, letto da entrambi — niente `DATABASE_URL` duplicata.
- **Next.js** legge file env solo dalla **propria** cartella (`apps/web/`), mai dalla root del monorepo. `AUTH_SECRET` mancante → errore `MissingSecret` di Auth.js.
- Le var d'ambiente si leggono **all'avvio**: dopo aver modificato un `.env`, riavvia `pnpm dev` (l'hot reload non basta).
- Segreti: `openssl rand -base64 32` per `ORBIT_ENCRYPTION_KEY` e `AUTH_SECRET`; `openssl rand -base64 48` per `JWT_SECRET`. `DATABASE_URL` deve combaciare con le credenziali del Postgres in `docker-compose` (`POSTGRES_USER`/`POSTGRES_PASSWORD`).

Endpoint core attuali (tutto richiede `Authorization: Bearer <accessToken ORBIT>` salvo i `@Public`):
- `GET  /api/health` *(public)*
- `GET  /api/connectors` · `GET /api/connectors/:type/tools` *(public — catalogo, non dati tenant)*
- `POST /api/auth/login` *(public)* — verifica email/password, ritorna `{ user, tokens }`
- `POST /api/auth/refresh` *(public)* — scambia un refresh token per nuovi token
- `GET  /api/auth/me` — profilo dell'utente autenticato
- **Gestione utenti** *(solo `admin`)*: `POST /api/auth/users` (crea, niente self-registration) · `GET /api/auth/users` · `GET /api/auth/users/:id` · `PATCH /api/auth/users/:id` (nome/email/ruolo/password) · `DELETE /api/auth/users/:id` (non può eliminare se stesso)
- **Organizzazioni**: `POST` (crea + creatore `owner`) · `GET` *(solo le proprie)* · `GET /:id` · `PATCH /:id` *(ruolo org `admin`+)* · `DELETE /:id` *(solo `owner`)*
- **Progetti**: `POST` · `GET ?orgId=` · `GET /:id` · `PATCH /:id` *(`member`+)* · `DELETE /:id` *(`admin`+)*
- **Connettori (istanze)**:
  - `POST /api/projects/:projectId/connectors/register` — **registra** un'istanza senza credenziali (status `configured`); `source: "catalog"` (da registry) o `"custom"` (servizio dichiarato dall'utente, `connectorType: "custom"` + layer scelto)
  - `POST /api/projects/:projectId/connectors` — **configura & connette**: valida config/credentials, `testConnection`, cifra le credenziali, status `connected`
  - `GET  /api/projects/:projectId/connectors`
  - `PATCH /api/connector-instances/:id` *(`member`+)* — rinomina; per i `custom` anche layer/config
  - `DELETE /api/connector-instances/:id` *(`member`+)*
  - `POST /api/connector-instances/:id/capabilities/:name` — invoca una capability (path senza AI; non disponibile per i `custom`)

## Auth & RBAC

Due piani distinti, da non confondere:
- **Control plane (login a ORBIT) = auth interna.** ORBIT possiede il proprio store identità: password con **argon2id** ([local-password.provider.ts](apps/core/src/modules/auth/identity/local-password.provider.ts), dietro il seam `IdentityProvider`), JWT (access+refresh, stateless) **emessi dal core** firmati con `JWT_SECRET`. La [`JwtStrategy`](apps/core/src/modules/auth/jwt.strategy.ts) valida i token del core; `JwtAuthGuard` è globale (`APP_GUARD`), rotte pubbliche con `@Public()`, utente con `@CurrentUser()`. Niente self-registration pubblica: gli utenti li crea un `admin` via `POST /auth/users`. Un **admin di bootstrap** viene seedato all'avvio da `ORBIT_ADMIN_EMAIL`/`ORBIT_ADMIN_PASSWORD` (`AuthService.onModuleInit`, idempotente) — come l'admin di Keycloak o il superuser di un DB. Il web usa **Auth.js (NextAuth)** con un **Credentials provider** ([auth.ts](apps/web/src/shared/auth.ts)) che chiama `/auth/login` (sessione in cookie httpOnly; l'access token del core è inoltrato come Bearer da [api.ts](apps/web/src/shared/api.ts)).
- **Data plane = Keycloak come connettore** (layer `identity`): un'istanza Keycloak può essere registrata come ConnectorInstance per gestirla via Admin API. **Keycloak non è coinvolto nel login a ORBIT.**
- **Ruoli a due livelli:** *platform role* (`admin` | `member`, [PlatformRole](packages/shared/src/auth.ts)) è nativo ORBIT, salvato su `User.platformRole` e portato nell'access token; applicato con `@Roles('admin')` + [RolesGuard](apps/core/src/modules/auth/roles.guard.ts). *Ruoli per organizzazione* (`owner > admin > member > viewer`, [ROLE_RANK](packages/shared/src/auth.ts)) restano in `Membership` ed enforced nei service via `AccessControlService.assertMember(userId, orgId, minRole)`. Capability read-only richiedono `viewer`, quelle che mutano `member`.
- **Keycloak locale (per il connettore):** `docker-compose` può avviare Keycloak con `--import-realm` da [infra/keycloak/realm-export.json](infra/keycloak/realm-export.json) come istanza dev contro cui testare il **connettore** `@orbit/connector-keycloak`. Non serve per l'auth di ORBIT.

## Struttura del monorepo

Il core separa **`src/modules/`** (feature con controller+service+module) da **`src/shared/`** (servizi trasversali global: prisma, crypto, authz).

```
apps/
  core/                @orbit/core  — NestJS (CommonJS)
    prisma/                    schema + migrazioni (User, Membership, Organization, Project, ConnectorInstance)
    src/main.ts               bootstrap (prefix /api, CORS, ZodValidationPipe globale)
    src/app.module.ts         wiring dei moduli + ConfigModule (.env.local poi .env)
    src/common/               ZodValidationPipe
    src/shared/prisma/        PrismaModule/Service (global)
    src/shared/crypto/        CryptoService AES-256-GCM per credenziali (global)
    src/shared/authz/         AccessControlService (assertMember + ruoli per-org, global)
    src/modules/auth/         auth interna: AuthService/Controller, JwtStrategy (valida i JWT del core),
                              JwtAuthGuard (APP_GUARD globale), RolesGuard, @Public/@CurrentUser/@Roles,
                              identity/ (IdentityProvider + local-password argon2id)
    src/modules/organizations/ src/modules/projects/   CRUD dominio (scopizzati per utente)
    src/modules/connectors/   registry connettori, tipi+tool MCP, istanze, invoke capability
    src/modules/health/       GET /api/health
  web/                 @orbit/web   — Next.js (App Router, React 19) + Auth.js (Credentials provider → core /auth/login)
    src/app/
      (app)/layout.tsx          auth gate + Navbar (redirect a /login se no session)
      (app)/(platform)/         sidebar piattaforma: dashboard, graph, chat, users, connectors, settings
        layout.tsx              fetcha orgs → PlatformSidebar (lista org + CreateOrgDialog)
        actions.ts              createOrgAction (ritorna { success } invece di redirect)
      (app)/orgs/[orgId]/       sidebar org/progetto context-aware
        layout.tsx              fetcha org+projects → OrgSidebar (client, usePathname)
        page.tsx                riepilogo org + card progetti
        actions.ts              createProjectAction (ritorna { success } invece di redirect)
        projects/[projectId]/
          page.tsx              overview progetto (mappa dei 13 layer, cliccabili)
          actions.ts            update/delete progetto + registerConnectorAction
          layers/[kind]/page.tsx  dettaglio di un layer: istanze + connettori disponibili
          chat/page.tsx         coming-soon
          graph/page.tsx        coming-soon
      login/page.tsx            form con server action inline (NextAuth signIn)
    src/common/app-shell/
      platform-sidebar.tsx      Server Component — nav piattaforma + lista org
      org-sidebar.tsx           "use client" — org view (lista progetti) o project view
                                (nav + sezione CONNECTORS connector-centric, raggruppata per layer)
      create-org-dialog.tsx     "use client" — Dialog + form + useActionState
      create-project-dialog.tsx "use client" — Dialog + form + useActionState + .bind(orgId)
      create-connector-dialog.tsx "use client" — Dialog 2 tab (catalog/custom) → register
                                (form rimontato a ogni apertura → chiusura affidabile su ogni submit)
      connector-row.tsx         "use client" — riga connettore con kebab (⋮): Edit/Delete dialog
      edit-*/delete-* dialogs   "use client" — modifica/eliminazione org e progetti
      nav-link.tsx, navbar.tsx, page-shell.tsx, breadcrumb.tsx, coming-soon.tsx, user-menu.tsx
    src/components/ui/         primitivi shadcn/ui (gestiti dalla CLI, non editare a mano salvo necessità)
    src/shared/               auth.ts (config NextAuth), api.ts (fetch verso il core con Bearer)
    src/lib/utils.ts          cn() (clsx + tailwind-merge)
  desktop/             @orbit/desktop — app desktop local-first (Vite + React; guscio Tauri da aggiungere)
    sidecar/server.ts         host locale del motore: HTTP su 127.0.0.1:4317 che espone @orbit/engine
                              sugli adapter **filesystem** (`.orbit/`), no DB/auth/org. Mirror locale del server.
    src/                      frontend Vite + React, riusa shadcn/ui + tema (copia di globals.css) +
                              componenti (button/input/label/card/select/dialog/dropdown-menu/brand-icon)
                              + connector-catalog; src/lib/api.ts → sidecar. **App-shell come la web**
                              (src/components/app-shell/): Navbar (con **Catalogue** explorer connettori
                              stile store + **Sync** placeholder con gate login) + Sidebar **connector-centric**
                              (lista progetti ↔ nav progetto: Overview/Chat/Graph + lista connettori con
                              **loghi** + "+" CreateConnectorDialog + kebab ⋮ Edit/Delete). Header progetto:
                              kebab ⋮ Edit/Delete progetto (ProjectActions). App.tsx orchestra (no router;
                              `selected` + `view`: overview/connector/graph/chat). **Niente org, niente login**
                              (local-first; auth solo alla sync col server, ancora da implementare).
    src-tauri/                guscio nativo Tauri v2 (Rust): finestra + frontend. src/lib.rs **avvia il
                              sidecar** all'apertura e lo **uccide all'uscita** — in **dev** lancia `node`
                              (CARGO_MANIFEST_DIR), in **release** il binario bundlato accanto all'eseguibile.
                              tauri.conf.json: externalBin `binaries/orbit-sidecar`, beforeBuildCommand
                              builda anche il binario, identifier com.orbit.desktop, package Cargo `orbit`.
    scripts/build-sidecar-bin.mjs compila il sidecar in un **eseguibile self-contained** (Node SEA: esbuild
                              bundle → blob → inject con postject), **cross-platform** (Linux/Mac/Windows:
                              gestisce codesign su macOS, `.exe` su Windows) → src-tauri/binaries/
                              orbit-sidecar-<triple>. Così l'app pacchettizzata gira **senza Node**.
    tsconfig.json (frontend) · tsconfig.sidecar.json (Node/CJS → dist-sidecar) · vite.config.ts
                              (nota: `commonjsOptions.include: [/packages\//]` perché i pacchetti workspace
                              sono CJS e Rollup non vede i loro named export in build — gotcha Vite+monorepo)
    Dev: **un solo comando** `pnpm --filter @orbit/desktop tauri dev` — builda il sidecar, avvia Vite,
         apre la finestra nativa e il guscio fa partire il sidecar da sé (lo spegne all'uscita).
  website/             @orbit/website — sito vetrina pubblico (Next.js statico, **self-contained**, zero
                       dipendenze workspace → deploy indipendente su **Vercel**, root dir `apps/website`).
                       Landing: hero + features + band loghi + Download + footer. Riusa tema shadcn +
                       Button/Card/Badge/BrandIcon. **Download Linux self-hosted**: il `.deb` sta in
                       `public/downloads/` (servito da Vercel, niente GitHub/CI); Mac/Windows = "Coming soon".
                       (Il binario ~37MB è committato nel repo — scelta "for now"; in futuro release/LFS.)
.github/
  workflows/release.yml  CI release desktop: matrix Linux/Mac/Windows + tauri-action; a ogni tag `v*`
                       builda i pacchetti (.deb/AppImage, .dmg, .msi) e pubblica una **GitHub Release** (draft).
                       Ogni runner costruisce il sidecar SEA per il proprio OS (build:sidecar-bin.mjs).
infra/
  keycloak/            realm-export.json importato da docker-compose (--import-realm)
packages/
  shared/              @orbit/shared        — tipi dominio con zod (Org, Project, Layer, Connector, auth)
  connector-sdk/       @orbit/connector-sdk — contratto connettori (Capability, ApiCatalog, Registry, mcp)
  engine/              @orbit/engine        — logica di dominio host-agnostica (no framework):
                       CryptoEngine (AES-256-GCM), createDefaultRegistry() (catalogo connettori),
                       i **ports** in src/domain/ (ProjectRepository, ConnectorInstanceRepository + tipi),
                       EngineError, ConnectorInstanceService (orchestrazione register/list/update/remove),
                       e gli **adapter filesystem** in src/adapters/fs/ (FsProjectRepository,
                       FsConnectorInstanceRepository su `.orbit/` JSON — lo store del desktop, niente DB).
                       Il server NestJS è l'altro adapter (Prisma) + governance/HTTP.
  connectors/
    github/            @orbit/connector-github   — repos/issues (read-only)
    keycloak/          @orbit/connector-keycloak — realms/clients/users via Admin API (read-only)
```

Convenzioni frontend dettagliate in [apps/web/CLAUDE.md](apps/web/CLAUDE.md).

**Aggiungere un connettore:** creare `packages/connectors/<nome>` che esporta una `ConnectorDefinition` (vedi `github`), poi registrarlo nel registry in `apps/core/src/modules/connectors/connectors.module.ts`. Il core non importa mai gli interni di un connettore: dipende solo dal contratto `@orbit/connector-sdk`.

**Credenziali:** mai in chiaro nel DB o nelle risposte. Si validano contro `credentialsSchema` del connettore, si cifrano con `CryptoService` (`ORBIT_ENCRYPTION_KEY`), e i campi restituiti escludono `encryptedCredentials`.

**Vincolo ESM/CJS:** i pacchetti condivisi compilano in **CommonJS** (niente `"type": "module"`) così sia Nest (CJS) sia Next (bundler) li consumano senza interop. Il core usa `module: commonjs` + `moduleResolution: node`. Non reintrodurre `"type": "module"` nei pacchetti senza adeguare il core.

## Visione

> Visione estesa e roadmap concettuale (multi-prodotto, local-first vs server-first, ecc.) in [summary.md](summary.md) — **leggere solo quando si discute della direzione**, non è una guida operativa. Lo stato reale del codice è questo CLAUDE.md.

**ORBIT** è un orchestratore/centralizzatore/connettore open source che unifica i principali applicativi enterprise usati da un'azienda. Non ha lock-in verso un singolo vendor: è la **vista dall'alto** sull'intera infrastruttura di un'organizzazione, con la possibilità di entrare nel dettaglio di ogni strumento connesso.

Due livelli di valore, in quest'ordine:
1. **Senza AI (priorità iniziale):** navigare, cercare e visualizzare un **grafo** dell'infrastruttura e delle relazioni tra servizi/progetti; chiamare le API dei servizi connessi.
2. **Con AI (fase successiva, NON da costruire per prima):** uno o più agenti (multi-agente orchestrato) che operano su tutto — documentazione, task, sviluppo, deploy, workflow — con tool/permessi/contesti, usando i connettori già mappati.

Principio guida: **prima una base solida senza AI**, poi l'AI ci si appoggia sopra.

## Architettura di alto livello

- **Core** — NestJS. API, auth, gestione Organizzazioni/Progetti, registry dei connettori, knowledge/grafo. Richiede **Node 20 LTS** (Node 18 minimo).
- **Frontend** — **Next.js (React)**, web-first. Grafo con React Flow o Cytoscape.js; tabelle dense con TanStack Table; dati server con TanStack Query (+ Zustand per stato UI). Multipiattaforma desktop/mobile rimandato a fasi successive (valutare Tauri o app dedicata). *Scelta presa dopo aver valutato e scartato Flutter ed Electron per l'MVP web-first.*
- **Connettori/Integrazioni** — pacchetti `@orbit/connector-*` separati e indipendenti, basati sul contratto `@orbit/connector-sdk`. **Decisione presa: entrambi.** Una `ConnectorDefinition` si mappa una volta e funge sia da **libreria** (capability invocabili via fetch, path senza AI) sia da **MCP** (`mcpToolsFromConnector` deriva i tool MCP dalla stessa definizione). Non sono processi MCP server separati: i tool sono generati dalla definizione.

## Concetto centrale: registry unificato Connettori (API + MCP)

Il cuore del progetto. Per ogni servizio si mappa **una volta sola**:
- la lista di **API** del servizio (organizzate per argomento);
- il/i suo/i **MCP server**.

La stessa definizione deve essere utilizzabile sia come **tool MCP** (per gli agenti) sia come **chiamata fetch API** diretta (utilizzabile anche senza AI). Astrazione comune dei connettori → aggiungere un nuovo servizio deve costare poco.

Servizi self-hosted via Docker (es. Keycloak) espongono API proprie che vanno tracciate nel registry. **Da chiarire:** se siano "connettori" veri o un concetto separato — seguire best practice enterprise, separare i concetti solo quando serve, evitare over-engineering.

### Tre concetti distinti (non confondere)

1. **Connector (definizione/catalogo)** — il pacchetto code-backed `@orbit/connector-*` (github, keycloak). Dichiara layer, schema config/credentials, capability e tool MCP. È il catalogo "pubblico".
2. **Connector Instance** — una connessione configurata di un connettore di catalogo dentro un progetto (con credenziali cifrate). Vive in `ConnectorInstance`.
3. **Custom/Local** — un servizio **dichiarato dall'utente** che non ha ancora un connettore code-backed (`connectorType: "custom"` + layer scelto). Appare nella lista/grafo del progetto ma non ha capability live finché non esiste un vero connettore. Serve la "vista dall'alto": mappare "usiamo X" anche senza integrazione.

### Ciclo di vita di un'istanza (deciso)

`register` (status `configured`, nessuna credenziale — sia catalog che custom) → *poi* `configure & connect` (config/credentials, `testConnection`, cifratura, status `connected`) → *poi* invocazione capability. La UI oggi copre **register** (modale a 2 tab nella sidebar); il passo *configure & connect* — incluso il distinguo **uso via API vs via MCP** — è il prossimo da progettare. Lo schema DB non cambia: il `custom` usa il sentinel `connectorType="custom"`.

## Modello di dominio

```
Organizzazione → Progetti → Layer → Connettori (API + MCP)
```
Si può creare un'organizzazione con i suoi progetti, oppure un progetto diretto. Dal **dettaglio progetto** si vedono tutti i layer collegati e le relative integrazioni.

## Layer / Domini da mappare

Ogni layer è una categoria di servizi intercambiabili. Sono organizzati lungo il
ciclo di vita del software (modello degli internal developer portal enterprise —
Backstage/Cortex). Definizione canonica in [packages/shared/src/layers.ts](packages/shared/src/layers.ts)
(`LayerKind`, `LAYER_LABELS`, `LAYER_GROUPS`). L'ordine dell'enum guida l'ordine in UI.

**🚀 Ship** *(sviluppo & delivery)*
- `repository` — Source control: GitHub, GitLab, Bitbucket *(connettore GitHub esistente)*
- `cicd` — CI/CD: GitHub Actions, GitLab CI, Jenkins, CircleCI

**⚙️ Run** *(infrastruttura)*
- `hosting` — Cloud & hosting: AWS, GCP, Azure, Aruba, Hetzner, OVH
- `orchestration` — Container & orchestration: Kubernetes, Docker, Nomad
- `iac` — Infrastructure as Code: Terraform, Pulumi, Ansible
- `database` — Database & data store: Postgres, MySQL, Redis

**📊 Operate** *(affidabilità & sicurezza)*
- `observability` — Log, metriche, tracce, alerting: Datadog, Grafana, Sentry
- `security` — Security & secrets: Vault, Snyk, SonarQube

**👥 Collaborate** *(organizzazione)*
- `task` — Project management: Jira, Linear, Asana
- `docs` — Documentazione: Confluence, Notion
- `workspace` — Workspace & comunicazione: Google Workspace, M365, Slack, Teams
- `identity` — Identity & access: Keycloak, Okta, Auth0 *(connettore Keycloak esistente)*

**🤖 AI** *(visione ORBIT)*
- `model` — LLM provider: locali (Ollama/LM Studio) o a pagamento (Anthropic/OpenAI)

I layer sono *categorie*: esistono anche senza connettori (nel dettaglio progetto
appaiono come "Not connected"), dipingendo la visione target. Fuori scope per ora:
payments/billing e analytics/product (sono *business-ops*, non infrastruttura).

## Knowledge / RAG / Grafo + Modelli

- **Grafo della conoscenza** del progetto, popolato prendendo dati dai servizi integrati; navigabile, ricercabile, visualizzabile.
- **Chat** per discutere dell'intera infrastruttura.
- **Connettore unificato verso i modelli:** il sistema si collega a *tutti* i modelli che l'utente usa — **locali** (Ollama / LM Studio) o **a pagamento** (Anthropic, OpenAI, …). È l'utente a scegliere quale modello alimenta chat e agenti.

## Principi

- **Open source**, senza lock-in; supporto a prodotti europei e americani.
- **Non costruire l'agente AI per primo.** Prima configurazione, modello dati, e gestione connettori.
- **MVP verticale, non orizzontale:** portare end-to-end UN layer + UN connettore (org → progetto → connessione → dati nel grafo → ricerca) prima di replicare sugli altri.
- Best practice enterprise; separare i concetti solo quando serve, niente over-engineering.

## Decisioni risolte

- **Connettori: entrambi** (libreria + MCP derivato dalla stessa `ConnectorDefinition`). Vedi *Architettura*.
- **Struttura monorepo:** pnpm workspace + Turborepo; pacchetti condivisi in CommonJS.
- **Primo connettore MVP:** GitHub (read-only); aggiunto anche Keycloak (layer `identity`).
- **Self-hosted come connettori:** sì — Keycloak è un ConnectorInstance del layer `identity`, non un concetto separato.
- **Tassonomia layer:** 13 layer in 5 macro-aree lungo il ciclo di vita (vedi *Layer / Domini*). Risolve i nodi aperti su server vs cloud (fusi in `hosting`), IaC vs runtime (`iac` separato da `orchestration`), e test (sciolto in `cicd`+`security`). Cloud è dentro l'MVP come layer `hosting`.
- **Direzione: local-first, Orbit Desktop come prodotto guida** (vedi [summary.md](summary.md)). App **Tauri** (Ubuntu/Mac/Windows), UI **Vite + React SPA** che riusa shadcn/ui + tema Tailwind + componenti (il "Next server": server actions/components/NextAuth **non** sopravvive in local-first — il data layer parla con un motore locale). `apps/web` attuale = UI del futuro "Orbit Server".
- **Un motore, più host:** la logica di dominio si estrae in **`@orbit/engine`** (host-agnostica), via **ports & adapters**. Server = NestJS adapter sopra il motore (Prisma/Postgres); Desktop = sidecar Node che esegue il motore + shell Tauri. *Fase 0 in corso*: crypto + registry + ports del dominio progetto già nel motore.
- **Desktop file-first, zero DB:** la verità del progetto sono **i file** (cartella con `.orbit/`, stile `.git/`), non un database — come git/VSCode/GitHub Desktop, dove il filesystem è la sorgente e l'eventuale SQLite è solo *cache/indice* dell'app. Un DB locale (SQLite) si aggiunge **solo dopo** come indice/cache (ricerca, grafo), mai come verità. → adapter **filesystem** (desktop) vs **Prisma/Postgres** (server).
- **Separazione dei concern nel motore:** *dominio progetto* (`Project`, `ConnectorInstance`, poi `Environment`/`Resource`/`Action`) è universale (entrambi gli host); *collaborazione/governance* (`User`, `Organization`, `Membership`, auth, RBAC) è **solo server**, un layer sopra i ports. Sul desktop, da soli, non esistono utenti/org/ruoli — solo progetti su disco.
- **Unità clonabile = il Project** (il "repo": manifest `.orbit/project.yaml`, push/pull git-like verso la Org, **segreti esclusi** → keychain OS). *Workspace* = contenitore locale (multi-root, stile VSCode); *Organization* = tenancy lato server.

## Decisioni ancora aperte

- **Uso connettore via API vs via MCP**: come si distingue, in UI e nel contratto, l'invocazione diretta (fetch, senza AI) dall'esposizione come tool MCP (per gli agenti). Da progettare nel blocco *configure & connect* (vedi *Prossimi passi*).
- **Stati istanza oltre `configured`/`connected`**: serve `error`/`disconnected` e i relativi endpoint.

## Fatto di recente

- **Auth completa**: refresh token silenzioso in Auth.js (sessione 8h, refresh 30s prima della scadenza, redirect a `/login` su `RefreshError`); CRUD utenti admin (lista, dettaglio, edit, delete); CRUD org/progetti (PATCH/DELETE con RBAC).
- **Tassonomia layer** a 13 layer in 5 macro-aree.
- **Connettori — CRUD istanza**: register (modale 2 tab catalog/custom), edit/delete via kebab in sidebar connector-centric; store catalogo ("mini playstore") con loghi.
- **Fase 0 (motore) quasi completa**: `@orbit/engine` con crypto + registry + ports (Project + ConnectorInstance) + `ConnectorInstanceService`; il core delega la persistenza di **progetti e connettori** al motore via **adapter Prisma** (`PrismaProjectRepository`, `PrismaConnectorInstanceRepository`) ed è un thin wrapper di governance/HTTP. Restano da spostare solo `create`/`invoke` connettore (col *configure & connect*).

## Prossimi passi

**Priorità guida — pivot local-first / Orbit Desktop** (vedi [summary.md](summary.md)):
- **Fase 0 — estrazione motore** *(completa per lo scopo)*: nel motore ci sono crypto, registry, **ports** (Project + ConnectorInstance), `ConnectorInstanceService`, `EngineError`, e **gli adapter filesystem** (`FsProjectRepository`, `FsConnectorInstanceRepository`). Lato server, `ProjectsService`/`ConnectorInstancesService` sono thin wrapper sopra gli **adapter Prisma**. Verificato: il motore gira identico su Postgres (server) e su file (`.orbit/`), provato con script (crea progetto + connettori su disco). Resta solo da spostare `create`/`invoke` connettore col blocco *configure & connect*.
- **Fase 1 — desktop offline** *(completa)*: `apps/desktop` ha i tre strati — **sidecar** (motore + adapter filesystem, compilabile in **binario self-contained** via SEA), **frontend Vite + React** (progetti + connettori), **guscio Tauri v2** che auto-avvia il sidecar. Dev: `pnpm --filter @orbit/desktop tauri dev`. **`tauri build --bundles deb` produce un `.deb` installabile** (`Orbit_0.1.0_amd64.deb`, ~37MB) con `/usr/bin/orbit` + `/usr/bin/orbit-sidecar` bundlato → gira **offline, senza Node**. Verificato.

## Prossimi passi

1. **Packaging desktop cross-platform** *(workflow pronto: `.github/workflows/release.yml`)* — resta da **verificare su GitHub**: push del repo + lockfile aggiornato, poi `git tag v0.1.0 && git push --tags` → la CI sforna i pacchetti e crea una Release draft. Caveat: macOS solo Apple Silicon (Intel = job `macos-13` da aggiungere poi); il workflow non è testabile in locale.
2. **Riadattare il sito ai download reali**: i bottoni di `apps/website` → asset delle **GitHub Releases** (risolve anche il limite Vercel sul `.deb`); poi si può rimuovere il `.deb` committato in `public/downloads/`.
3. **Sincronizzazione desktop ↔ server** (sviluppo dedicato, dove entra l'**auth**): manifest `.orbit/`, `clone`/`push`/`pull` verso le Organizations, login dal `SyncDialog` (oggi placeholder), segreti nel keychain OS.
4. **Configure & connect** dei connettori (credenziali, testConnection, API-vs-MCP) — vale sia per server sia per desktop via il motore.
- **Fase 2 — manifest + sync**: formato `.orbit/project.yaml`; `clone`/`push`/`pull` verso la Org (git-like); segreti esclusi.
- **Fase 3 — connettori locali**: configure & connect + segreti nel keychain OS.

**Backlog feature (indipendente dall'host, riusabile via motore):**
1. **Connettori — configure & connect**: form guidato da `configSchema`/`credentialsSchema`, `testConnection`, cifratura, status `connected`. **Qui il distinguo uso via API vs via MCP.** Richiede esporre gli schemi del connettore (oggi `/connectors` ritorna solo i conteggi).
2. **UI invocazione capability** — `POST /connector-instances/:id/capabilities/:name` esiste; manca UI.
3. **Ciclo di vita istanza** — aggiungere `error`/`disconnected` + endpoint ri-test/disconnetti.
4. **Modello**: Environments (dev/staging/prod), Resources, Actions sotto Project (dal summary).
5. **Grafo**, **Membership UI**, **connettori reali** per i nuovi layer.

## Prerequisiti ambiente

- **Node 20** (`nvm use 20`; un `.nvmrc` è presente in root) e **pnpm** via `corepack enable`.
- Per l'ambiente locale completo: Docker + Docker Compose.
- I segreti vanno negli env file per-app (vedi **Configurazione ambiente** nei *Comandi*): `apps/core/.env`, `apps/web/.env.local`, `/.env` per docker-compose. Le **credenziali per-connettore** NON vanno in env: si inseriscono per progetto nell'app e si salvano cifrate nel DB.
