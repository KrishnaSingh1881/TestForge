# Engineering Documentation Index - Liquid OS (v1)

Welcome to the engineering deep-dive documentation for **Liquid OS**. This directory contains granular technical details optimized for developer onboarding and system maintenance.

---

### 📂 Table of Contents

#### 1. [System Architecture](./SYSTEM_ARCHITECTURE_v1.md)
The foundational layers of Liquid OS, including the React-based Virtual Shell, Window Management, App Registry, and the Server API structure.

#### 2. [Database Guide](./DATABASE_GUIDE_v1.md)
Detailed walkthrough of the Supabase / PostgreSQL schema, Row-Level Security (RLS) policies, and performance-critical views and triggers.

#### 3. [Integrity Engine](./INTEGRITY_ENGINE_v1.md)
Comprehensive documentation of the Liquid OS Anti-Cheat mechanism, covering behavioral telemetry, AI suspicion audits, and token-based similarity detection.

#### 4. [AI Engine](./AI_ENGINE_v1.md)
Deep dive into the AI pipelines used for generating debugging variants (NVIDIA NIM) and performing forensic analysis (Ollama).

#### 5. [Knowledge Graph Analysis](./KNOWLEDGE_GRAPH_LOG_v1.md)
A structural analysis of the codebase topology, identifying module clusters and high-risk "God Nodes" dependencies.

#### 6. [Technical Diagrams](./TECHNICAL_DIAGRAMS_v1.md)
The source repository for all Mermaid visualizations, including architecture maps, integrity flows, and auth sequences.

---

### 🚀 Quick Start for Developers
- **Exploring the Code:** Read [KNOWLEDGE_GRAPH_LOG_v1.md](./KNOWLEDGE_GRAPH_LOG_v1.md) to understand the project structure.
- **Modifying the UI:** See the "Virtual Shell" section in [SYSTEM_ARCHITECTURE_v1.md](./SYSTEM_ARCHITECTURE_v1.md).
- **Tweaking Anti-Cheat:** Review the "Scoring Deductions" in [INTEGRITY_ENGINE_v1.md](./INTEGRITY_ENGINE_v1.md).
- **Updating the Schema:** Check the table definitions in [DATABASE_GUIDE_v1.md](./DATABASE_GUIDE_v1.md).

---
*Liquid OS — Precision Evaluation. Forensic Integrity.*
