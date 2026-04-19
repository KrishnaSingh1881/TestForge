# System Architecture - Liquid OS (v1)

## Overview
Liquid OS is a macOS-inspired virtual desktop environment running entirely in the browser. It serves as the primary interface for the TestForge evaluation platform, providing a multi-tasking, windowed workspace for both students and administrators.

### Core Architecture Layers

1. **Virtual Shell (Frontend)**
   - **Shell Root**: `OSShell.tsx` orchestrates the desktop, global keyboard listeners, and authentication gating.
   - **Window Manager**: `WindowManager.tsx` handles the stacking order (z-index), focus state, and lifecycle of all active application windows.
   - **App Registry System**: `registry.ts` defines the available applications, their default sizes, and role-based access controls.
   - **State Engine**: Powered by **Zustand** (`useOSStore.ts`), managing window positioning, dock state, and responsive layout modes.

2. **API Service Layer (Backend)**
   - **Runtime**: Node.js / Express.
   - **Routing**: Modular route definitions for specific domains:
     - `/api/attempts`: High-complexity state machine for exam sessions.
     - `/api/questions`: CRUD operations and AI variant management.
     - `/api/execute`: Proxy layer for sandboxed code execution.
   - **Middleware**: `requireAuth` ensures all requests are validated against Supabase Auth before reaching the controllers.

3. **Execution Layer**
   - **Piston API**: A self-hosted, scalable code execution engine.
   - **Sandboxing**: Utilizes library-level isolation (e.g., `isolate-vm` or container-based execution) to run student code across 20+ supported languages.

---

## The Virtual Desktop (Liquid UI)

### Component Hierarchy
- `Desktop`: The primary workspace rendering `WindowManager` and desktop icons.
- `AppWindow`: A generic wrapper providing macOS-style "traffic light" controls (Close, Minimize, Maximize) and draggable/resizable wrappers.
- `Dock`: A persistent app launcher that dynamically monitors open windows and role permissions.
- `MenuBar`: A dynamic top bar that updates based on the currently focused application.

### Window Lifecycle
1. **Trigger**: User clicks an icon or an app calls `openWindow(id, params)`.
2. **Registry Lookup**: `useOSStore` verifies the app exists in `registry.ts`.
3. **Instance Check**: Most apps are singletons. If already open, the window is brought to the front (focused).
4. **Mounting**: The app component is dynamically imported and rendered inside an `AppWindow`.
5. **Termination**: Closing the window removes its state from the store and unmounts the component.

---

## Module Clusters & Topology
Based on automated graph analysis, the system is organized into three primary clusters:

| Cluster | Key Responsibilities | Primary Dependencies |
|---------|----------------------|----------------------|
| **OS Core** | Shell, Store, Auth, Registry | Zustand, AuthContext, Tailwind |
| **Integrity** | Tracking, Evaluator, Auditor | similarity.js, auditor.js, Ollama |
| **Admin Hub** | Question Management, Test Settings | components/admin/, questions.js |

For visual representations of these flows, see: [TECHNICAL_DIAGRAMS_v1.md](./TECHNICAL_DIAGRAMS_v1.md)

---

## Scaling & Performance
- **Client-Side Initialization**: Heavy app components are lazy-loaded to keep the bundle size manageable.
- **State Synchronization**: `useOSStore` uses selective selectors to prevent unnecessary re-renders of the desktop when a window moves.
- **Heartbeat Mechanism**: The `test-session` app maintains a persistent 30s heartbeat to the server to ensure session continuity despite network flickers.
