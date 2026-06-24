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
infra/
  keycloak/            realm-export.json importato da docker-compose (--import-realm)
packages/
  shared/              @orbit/shared        — tipi dominio con zod (Org, Project, Layer, Connector, auth)
  connector-sdk/       @orbit/connector-sdk — contratto connettori (Capability, ApiCatalog, Registry, mcp)
  connectors/
    github/            @orbit/connector-github   — repos/issues (read-only)
    keycloak/          @orbit/connector-keycloak — realms/clients/users via Admin API (read-only)
```

Convenzioni frontend dettagliate in [apps/web/CLAUDE.md](apps/web/CLAUDE.md).

**Aggiungere un connettore:** creare `packages/connectors/<nome>` che esporta una `ConnectorDefinition` (vedi `github`), poi registrarlo nel registry in `apps/core/src/modules/connectors/connectors.module.ts`. Il core non importa mai gli interni di un connettore: dipende solo dal contratto `@orbit/connector-sdk`.

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

## Decisioni ancora aperte

- **Uso connettore via API vs via MCP**: come si distingue, in UI e nel contratto, l'invocazione diretta (fetch, senza AI) dall'esposizione come tool MCP (per gli agenti). Da progettare nel blocco *configure & connect* (vedi *Prossimi passi*).
- **Stati istanza oltre `configured`/`connected`**: serve `error`/`disconnected` e i relativi endpoint.

## Fatto di recente

- **Auth completa**: refresh token silenzioso in Auth.js (sessione 8h, refresh 30s prima della scadenza, redirect a `/login` su `RefreshError`); CRUD utenti admin (lista, dettaglio, edit, delete); CRUD org/progetti (PATCH/DELETE con RBAC).
- **Tassonomia layer** a 13 layer in 5 macro-aree.
- **Connettori — register**: modale a 2 tab (catalog/custom) nella sidebar connector-centric. Registra l'istanza (status `configured`).

## Prossimi passi (priorità: base senza AI prima)

1. **Connettori — configure & connect** *(il prossimo grande blocco)* — form guidato da `configSchema`/`credentialsSchema` del connettore per inserire le credenziali, lanciare `testConnection`, cifrare e portare lo status a `connected`. **Qui si decide il distinguo uso via API vs via MCP** (da progettare insieme, approccio enterprise). Richiede di esporre gli schemi del connettore via API (oggi `/connectors` ritorna solo i conteggi).
2. **UI invocazione capability** — `POST /connector-instances/:id/capabilities/:name` esiste; nessuna UI. Dal dettaglio istanza connettore.
3. **Ciclo di vita istanza** — oggi `configured`/`connected`; aggiungere almeno `error` (testConnection fallita) e `disconnected`; endpoint per ri-testare e disconnettere.
4. **Grafo** (React Flow o Cytoscape) — relazioni tra layer/connettori, dal dettaglio progetto.
5. **Membership UI** — invitare utenti a un'org, assegnare ruoli (`owner/admin/member/viewer`); oggi solo via DB/API.
6. **Connettori reali** per i nuovi layer (oggi solo `repository`/`identity`).

## Prerequisiti ambiente

- **Node 20** (`nvm use 20`; un `.nvmrc` è presente in root) e **pnpm** via `corepack enable`.
- Per l'ambiente locale completo: Docker + Docker Compose.
- I segreti vanno negli env file per-app (vedi **Configurazione ambiente** nei *Comandi*): `apps/core/.env`, `apps/web/.env.local`, `/.env` per docker-compose. Le **credenziali per-connettore** NON vanno in env: si inseriscono per progetto nell'app e si salvano cifrate nel DB.
