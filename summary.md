> **Documento di visione — leggere su richiesta, non istruzioni operative.**
> Questo file descrive *dove vogliamo arrivare* con Orbit, non lo stato del codice.
> Per lo stato reale e le convenzioni vedi [CLAUDE.md](CLAUDE.md). Si legge/aggiorna
> quando si discute della direzione del progetto.

---

# 🛰️ Orbit — idea completa (riassunto per discussione)

Sto progettando un sistema chiamato Orbit, che non è un IDE, né un SaaS tipo Jira, né un tool AI, ma un:

> workspace operativo unificato per la gestione di progetti software e della loro infrastruttura.

L’idea centrale è che il centro non è lo strumento (GitHub, Jira, Docker, ecc.), ma il progetto stesso.

Orbit non sostituisce gli strumenti, ma li collega e li orchestra in un unico modello coerente.

---

## 🧠 Concetto fondamentale

Ogni progetto software in Orbit è un’entità che può contenere:

- repository Git (GitHub / GitLab / locale)
- task system (Jira o alternative)
- documentazione (Confluence o alternative)
- infrastruttura (Docker, Kubernetes, ecc.)
- API tools (Postman o simili)
- MCP tools / agenti
- configurazioni e variabili di ambiente
- AI context e knowledge

Tutto è visto come parte di un unico “workspace del progetto”.

---

## 🧱 Modello concettuale base

La struttura principale è:

```
Workspace
 └─ Organization
      └─ Project
           ├─ Environments (dev/staging/prod)
           ├─ Connectors (Git, Docker, Jira, ecc.)
           ├─ Resources (repo, docs, API, infra)
           └─ Actions (deploy, sync, automation)
```

---

## 🧩 Architettura dell’ecosistema Orbit

Orbit è composto da più prodotti:

### 🖥️ 1. Orbit Desktop (core experience)

È il prodotto principale. È un’app locale (tipo VSCode / GitHub Desktop) che l’utente installa.

Responsabilità:

- workspace locale
- gestione progetti
- integrazione con Git, Docker, MCP, API tools
- UI per esplorare progetto
- AI assistita (facoltativa)
- esecuzione di tool locali

Può funzionare anche offline. I progetti possono essere importati direttamente da filesystem.

### 🏢 2. Orbit Server (self-hosted aziendale)

È installato dall’azienda. Serve per collaborazione multiutente.

Responsabilità:

- utenti e autenticazione
- ruoli e permessi
- organizzazioni e progetti condivisi
- sincronizzazione tra client
- audit e eventi
- configurazioni condivise

Non è obbligatorio per usare Orbit Desktop.

### ☁️ 3. Orbit Cloud (opzionale)

Versione hosted del server. È semplicemente: *Orbit Server gestito come servizio SaaS.*

### 💻 4. Orbit CLI

Interfaccia terminale per automazioni. Esempi: gestione progetti, installazione connector, deploy, query AI, automazioni. Serve per CI/CD e workflow scriptabili.

### 🧩 5. Orbit SDK

API per estendere Orbit. Permette di creare: connector (GitHub, Jira, Docker, ecc.), MCP integration, automazioni, provider AI, widget UI. Obiettivo: ecosistema plugin-like.

---

## 🔌 Connectors (concetto chiave)

I connector sono il modo con cui Orbit si collega agli strumenti esterni. Esempi:

- GitHub / GitLab
- Docker / Kubernetes
- Jira / Confluence
- Postman / API tools
- MCP servers
- email / chat tools

Ogni connector è legato al progetto, non al sistema globale.

---

## 🧠 MCP e AI

MCP (Model Context Protocol o simile) viene usato come sistema di integrazione per: strumenti esterni, automazioni, AI agenti, accesso a risorse (filesystem, git, API).

L’AI non è centrale, ma è un layer sopra il workspace.

---

## 🖥️ Desktop vs Server (idea chiave)

Orbit non è solo server-based. È un sistema:

**Local-first**

- i progetti possono vivere sul filesystem
- funzionano offline
- integrano tool locali

**Server opzionale**

- sincronizzazione
- collaborazione
- governance aziendale

---

## 🔑 Filosofia principale

Orbit non è: un altro Jira, un altro VSCode, un altro GitHub.

Orbit è:

> un sistema operativo per il progetto software

dove ogni progetto è un ecosistema composto da strumenti, infrastruttura e automazioni.

---

## ❓ Punto aperto (importante)

Il dubbio principale è:

- quanto Orbit deve essere local-first vs server-first
- quanto la logica deve stare nel desktop vs server
- quanto AI/MCP deve essere centrale vs accessorio
