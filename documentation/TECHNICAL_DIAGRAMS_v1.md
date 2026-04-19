# Technical Diagrams - Liquid OS (v1)

This document contains the source code for the technical visualizations of Liquid OS. To view these diagrams, use a GitHub-compatible markdown viewer or a Mermaid live editor.

## 1. High-Level System Architecture
This diagram illustrates the multi-layered communication between the Liquid OS frontend, the Node.js API, and the sandboxed execution environment.

```mermaid
graph TD
    subgraph Client ["Client (Liquid OS Frontend)"]
        UI[macOS-style UI Shell]
        Apps[App Registry & Windows]
        Store[useOSStore - Zustand]
        AuthC[AuthContext]
    end

    subgraph Server ["Backend (Node.js/Express)"]
        API[Express Router]
        Middleware[Auth Middleware]
        Auditor[AI Integrity Auditor]
        Eval[Test Evaluator]
        Sim[Similarity Engine]
    end

    subgraph Execution ["Execution Layer"]
        Piston[Piston API]
        Runtimes[Sandboxed Runtimes]
    end

    subgraph Data ["Data Layer"]
        Supa[Supabase / Postgres]
        Storage[S3/Storage]
    end

    UI --> Store
    Apps --> API
    Store --> Apps
    AuthC --> Supa
    API --> Middleware
    Middleware --> Supa
    API --> Eval
    Eval --> Piston
    Piston --> Runtimes
    Eval --> Supa
    Auditor --> Supa
    Sim --> Supa
```

## 2. Integrity Scoring Pipeline
The flow of integrity data from telemetry collection to forensic AI analysis.

```mermaid
sequenceDiagram
    participant S as Student Frontend
    participant A as API (attempts.js)
    participant E as Evaluator
    participant AU as AI Auditor (Ollama)
    participant DB as Supabase DB

    S->>A: Heartbeat / Behavioral Event (Tab Switch, WPM)
    A->>DB: Update Attempt (counters)
    S->>A: Final Code Submission
    A->>E: evaluateDebugging()
    E->>DB: Insert Result (Score, Marks)
    DB-->>DB: Trigger: compute_integrity_score()
    A->>AU: auditAttempt() (Post-Submission)
    AU->>DB: Update Result (AI Narrative, Suspicion Score)
```

## 3. Authentication & Authorization Flow
How Liquid OS secures sessions across the frontend and backend.

```mermaid
sequenceDiagram
    participant U as User
    participant LS as LockScreen (Frontend)
    participant AC as AuthContext
    participant SA as Supabase Auth
    participant BE as Backend API

    U->>LS: Enter Credentials
    LS->>SA: signInWithPassword()
    SA-->>LS: JWT Access Token
    LS->>AC: Update Session State
    AC->>BE: GET /api/auth/me (Bearer Token)
    BE->>SA: Verify JWT
    SA-->>BE: User Profile (Role, metadata)
    BE-->>AC: Role-based Profile
    AC->>LS: Unlock Desktop
```
