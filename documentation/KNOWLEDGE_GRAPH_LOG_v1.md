# Knowledge Graph Analysis - Liquid OS (v1)

## Overview
This report analyzes the structural topology of the Liquid OS repository, identifying "God Nodes" (highly connected modules) and logical community clusters. This data helps engineers understand the "blast radius" of code changes.

---

### God Nodes (Critical Dependencies)
These files represent the highest connectivity in the graph. Modifying them requires comprehensive regression testing as they impact nearly all system areas.

| Node | Functional Role | Impact |
|------|-----------------|--------|
| `useOSStore` | Central State Registry | All window management and desktop UI rely on this Zustand store. |
| `supabase.js` (Server) | Global Data Singleton | Every backend router depends on this for DB communication. |
| `AuthContext` | Identity Provider | Gates all protected frontend routes and UI shell components. |
| `registry.ts` | App Definition Map | Controls app availability, metadata, and role-based gating. |

---

### Topographical Clusters

#### 1. Liquid UI Shell
Contains the foundational components of the virtual OS.
- **Root**: `OSShell.tsx`
- **Core Nodes**: `WindowManager`, `Desktop`, `Dock`, `MenuBar`.
- **Connectivity**: High inward dependency from all individual apps.

#### 2. Student Evaluation Hub
A high-risk cluster containing the mission-critical testing logic.
- **Root**: `TestSessionApp.tsx`
- **Core Nodes**: `useBehavioralTracking`, `useIntegrityListeners`, `attempts.js`.
- **Note**: `attempts.js` is the most complex backend file (900+ lines), handling everything from session start to evaluation.

#### 3. Administrative Suite
A task-oriented cluster for platform management.
- **Key Modules**: `QuestionBankApp`, `TestManagerApp`, `AdminIntegrityApp`.
- **Dependencies**: Leverages shared admin components (`MCQForm`, `BulkImportPanel`).

---

### Hotspots & Risk Areas

#### 1. The Auth Monopoly
Since `AuthContext` and the `supabase` singleton are imported by nearly every layer, a failure in the Supabase configuration or a change in the Auth provider will result in a total platform blackout.

#### 2. The `attempts.js` Monolith
As identified by the graph, `attempts.js` carries a disproportionate amount of business logic. **Recommendation**: Refactor into domain-specific sub-routes (e.g., `heartbeat`, `scoring`, `evaluation`).

#### 3. State-Registry Drift
`useOSStore.ts` and `registry.ts` share overlapping metadata (App Titles, Sizes). The graph shows these are dual-connected; a change to one without the other can cause UI mismatches.

---

### Navigation Map
| Goal | Entry Point |
|------|-------------|
| **Add a New App** | `registry.ts` |
| **Modify OS Shell** | `WindowManager.tsx` |
| **Change Scoring Logic** | `evaluator.js` |
| **Debug Anti-Cheat** | `useIntegrityListeners.ts` |
| **Update DB Schema** | `server/supabase/schema.sql` |

For a simplified visual of these clusters, refer to: [TECHNICAL_DIAGRAMS_v1.md](./TECHNICAL_DIAGRAMS_v1.md)
