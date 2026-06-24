# apps/web — convenzioni frontend

Estende il [CLAUDE.md di root](../../CLAUDE.md). Qui solo ciò che è specifico del frontend; architettura, dominio e auth di sistema stanno nel root.

**Stack:** Next.js 15 (App Router, React 19) · **shadcn/ui** su Tailwind v4 · Auth.js (NextAuth, Credentials provider). TanStack Query/Table e React Flow sono previsti ma non ancora introdotti.

## Struttura dei layout e delle rotte

I layout sono annidati per contesto. La navbar (`top-0 fixed h-14`) è sempre presente nell'area autenticata; la sidebar (`fixed left-0 top-14`) cambia in base al contesto.

```
(app)/layout.tsx            → auth gate + Navbar (redirect /login se no session)
│
├─ (platform)/layout.tsx    → sidebar PIATTAFORMA (60px sinistra)
│    PlatformSidebar: nav globale + lista org + CreateOrgDialog
│    Rotte: /dashboard  /graph  /chat  /users  /connectors  /settings
│
└─ orgs/[orgId]/layout.tsx  → sidebar ORG/PROGETTO (60px sinistra, stessa posizione)
     Il layout fetcha org + progetti + istanze-per-progetto + catalogo connettori,
     e li passa a OrgSidebar (client), che con usePathname() distingue due modalità:
       • contesto org  → lista progetti + CreateProjectDialog
       • contesto proj → back-link + nav (Overview / Chat / Graph) +
                         sezione CONNECTORS connector-centric: elenca le istanze
                         del progetto, raggruppate per layer quando ≥2 nello stesso
                         layer; "+" apre CreateConnectorDialog (tab catalog/custom)
     Rotte: /orgs/[orgId]
             /orgs/[orgId]/projects/[projectId]            (Overview: mappa 13 layer cliccabili)
             /orgs/[orgId]/projects/[projectId]/connectors (store catalogo, scoped al progetto, con back)
             /orgs/[orgId]/projects/[projectId]/layers/[kind]  (dettaglio layer)
             /orgs/[orgId]/projects/[projectId]/chat
             /orgs/[orgId]/projects/[projectId]/graph
```

Nota: `orgs/[orgId]/` è fuori da `(platform)/` per design — ha la propria sidebar e non eredita quella di piattaforma. La sidebar mostra **solo i connettori esistenti** (instances), non l'elenco dei layer: il layer è la *categoria* del connettore, e la mappa completa dei layer sta nella Overview del progetto.

## Dove sta cosa

- **`src/app/`** — rotte. `(app)/` è l'area autenticata; `login/`, `page.tsx` (landing pubblica), `api/auth/[...nextauth]` (handler NextAuth).
- **`src/components/ui/`** — primitivi **shadcn/ui**, gestiti dalla CLI. Non editarli a mano salvo necessità reale; per aggiungerne usa la CLI (`shadcn add <comp>`), che richiede **Node 20**.
- **`src/common/app-shell/`** — componenti compositi dell'app: sidebar, dialog di creazione, navbar, breadcrumb, coming-soon, page-shell, nav-link. Qui sta lo stile applicativo; i primitivi restano in `ui/`.
- **`src/common/connector-catalog.ts`** — catalogo curato dei tool enterprise per layer (slug Simple Icons + flag `connectorType` per quelli code-backed). **`connector-store.tsx`** — la "vetrina" stile store (ricerca + filtro layer + griglia loghi) usata da `/connectors`. **`brand-icon.tsx`** — mappa slug→logo (Simple Icons, import singoli per il tree-shaking); fallback `Plug` per slug ignoti.
- **`src/shared/`** — [auth.ts](src/shared/auth.ts) (config NextAuth) e [api.ts](src/shared/api.ts) (fetch verso il core con Bearer).
- **`src/lib/utils.ts`** — `cn()` (clsx + tailwind-merge). Usa `cn()` per comporre le classi, non template string concatenate.

## Lettura dati (Server Components)

I Server Component leggono dal core via le funzioni di [src/shared/api.ts](src/shared/api.ts). Regola del modulo: `coreFetch` inoltra l'access token ORBIT come `Bearer` (preso dalla sessione), usa `cache: "no-store"`, ed è **tollerante** al core spento — le `get*` ritornano `[]`/`null` invece di lanciare, così la UI degrada senza crashare. Le nuove letture seguono lo stesso schema.

## Mutazioni: due pattern distinti

### Pattern a tre file (pagina con form inline)

Una rotta che scrive e naviga via redirect:
1. **`page.tsx`** — Server Component, rende il form.
2. **`actions.ts`** — `"use server"`. Firma `(_prev, formData) => Promise<{ error?: string }>`: chiama l'API del core, se fallisce ritorna `{ error }`, se va a buon fine `revalidatePath()` + `redirect()`.
3. **`form.tsx`** — `"use client"`. Usa `useActionState(action, {})` (React 19) per `pending` e per mostrare `state.error`.

### Pattern Dialog (creazione da sidebar o modale)

Per azioni che aprono una modale senza lasciare la pagina corrente:
1. **`actions.ts`** (nella rotta più vicina o in `(platform)/`) — firma `(_prev, formData) => Promise<{ error?: string; success?: boolean }>`: chiama l'API, se ok `revalidatePath("/", "layout")` e ritorna `{ success: true }` (niente redirect).
2. **`create-*.tsx`** in `src/common/app-shell/` — `"use client"`. `useActionState(action, {})` + `useEffect` su `state.success` per chiamare `setOpen(false)` e `router.refresh()`.

I Dialog attuali: `CreateOrgDialog` (usa `createOrgAction` da `(platform)/actions.ts`) e `CreateProjectDialog` (usa `createProjectAction.bind(null, orgId)` da `orgs/[orgId]/actions.ts`).

**Eccezione importante — login.** Le action di **Auth.js** (`signIn`/`signOut`) vanno chiamate da una **server action inline nel Server Component**, non da un modulo `"use server"` separato: in NextAuth v5 beta quest'ultimo non riceve il request context e produce `MissingSecret`/redirect rotti. [login/page.tsx](src/app/login/page.tsx) ha quindi l'action inline nel form e propaga l'errore via `?error=1`.

## Auth & sessione

NextAuth con Credentials provider: `authorize` chiama `POST /auth/login` del core e mette `accessToken`/`refreshToken`/`platformRole` sulla sessione (callback `jwt`/`session`). La sessione è tipizzata in [src/common/types/next-auth.d.ts](src/common/types/next-auth.d.ts) — `session.accessToken` e `session.user.platformRole`. Env del web (`AUTH_SECRET`, `CORE_API_URL`, …) in `apps/web/.env.local`: vedi **Configurazione ambiente** nel root.

**Refresh token:** la sessione porta il `refreshToken` ma non viene ancora usato per rinnovare l'access scaduto — vedi "Prossimi passi" nel root CLAUDE.md.

## Stile / tema

Tailwind v4 **CSS-first**: token e tema in [src/app/globals.css](src/app/globals.css) (`@theme inline`, `:root`/`.dark`), niente `tailwind.config.js`. Tema scuro applicato via classe `dark` sull'`<html>` in [layout.tsx](src/app/layout.tsx). Preferisci i token semantici shadcn (`bg-background`, `text-muted-foreground`, `border-border`, …) a colori hardcoded.

**Dropdown:** mai `<select>` nativo (le `<option>` non seguono il tema). Usa il componente [Select](src/components/ui/select.tsx) (Radix, tematizzato). Dentro una `<form>` con Server Action, lega il valore a uno **state controllato** e passalo via `<input type="hidden" name="…">` (vedi `create-connector-dialog.tsx`, `users/[userId]/form.tsx`) — così entra nel `FormData` senza dipendere dall'integrazione form nativa di Radix.
