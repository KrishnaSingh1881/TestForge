# Database Guide - Liquid OS (v1)

## Overview
Liquid OS utilizes **Supabase (PostgreSQL)** for persistence, leveraging advanced database features like window functions for ranking, JSONB for behavioral telemetry, and procedural triggers for real-time integrity scoring.

---

### Core Data Models

#### 1. Identity & Access
- `users`: Extends Supabase auth with application metadata (`role`, `year`, `division`, `subject`).
- Roles Supported: `student`, `admin`, `super_admin`, `master_admin`.

#### 2. Test Content
- `tests`: Definitions of test windows, duration, and metadata.
- `question_bank`: Multi-tenant library of questions (MCQ, Multi-Correct, Debugging).
- `test_questions`: Junction table managing question sequencing and timed unlocks.
- `debug_variants`: Generative AI versions of coding problems used for variant distribution.

#### 3. Attempt Life-Cycle
- `attempts`: Records student engagement. Tracks `status` (started, submitted, auto_submitted) and behavioral counters (`tab_switches`, `focus_lost_count`).
- `responses`: Granular storage of student answers.
  - `selected_option_ids`: Array of UUIDs for MCQ.
  - `submitted_code`: Full source for debugging tasks.
  - `behavioral_meta`: **JSONB** blob storing WPM, paste events, and idle periods.

#### 4. Post-Submission Analytics
- `results`: Final calculated outcomes. Stores `integrity_score` and `rank`.
- `similarity_flags`: Records Jaccard similarity alerts between students.

---

## Evaluation & Scoring Logic

### Leaderboard Generation (Window Functions)
The system calculates ranks on-the-fly via the `leaderboard` view, ensuring real-time performance tracking without heavy batch processing.
```sql
CREATE VIEW leaderboard AS
SELECT 
  u.name,
  r.total_score,
  RANK() OVER (PARTITION BY a.test_id ORDER BY r.total_score DESC) AS rank
FROM results r
JOIN attempts a ON a.id = r.attempt_id
JOIN users u ON u.id = a.user_id;
```

### Automatic Integrity Scoring (Procedural Trigger)
The `compute_integrity_score()` function is triggered automatically on `results` insertion. It consumes behavioral telemetry from the `attempts` table and similarity alerts to derive a final integrity percentage (0-100).

- **Tab Switch Deduction**: -5 pts
- **Focus Loss Deduction**: -2 pts
- **Security Flag Deduction**: -15 pts
- **Score Floor**: 0

---

## Row Level Security (RLS) Policies
Data privacy is enforced at the database layer.

- **Students**: Can `SELECT` their own `attempts` and `responses`. Can `SELECT` only active `tests`.
- **Admins**: Can `SELECT`, `INSERT`, `UPDATE` all tables within their subject domain.
- **Service Role**: Backend API uses the Supabase service role for high-privilege operations (evaluations, bulk imports).

---

## Operational Tables
| Table | Purpose |
|-------|---------|
| `variant_assignments` | Maps which specific bugged variant a student received. |
| `option_shuffle` | Stores the randomized order of MCQ options for a specific attempt. |
| `question_import_logs` | Audit trail for bulk CSV/JSON question imports. |

For the Entity-Relationship visualization, refer to: [TECHNICAL_DIAGRAMS_v1.md](./TECHNICAL_DIAGRAMS_v1.md)
