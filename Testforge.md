
---
## Platform Summary
A multi-test academic platform built for college environments. Tests combine MCQs and debugging-based coding questions. Anti-cheat is achieved through design — unique variants, behavioral fingerprinting, and similarity scoring — not surveillance. Admins are teachers managing their own batches; students are organized by year, division, and subject.

## 1. Authentication & Access Control

**Student Login** — Email/password based authentication. Students can only access tests assigned/available to them. No access to admin panel or other students' data.

**Admin Login** — Separate role with elevated privileges. Can create tests, manage questions, view all results and integrity reports.

**Role-based Access Control** — Every route and API call is gated by role. A student JWT cannot access admin endpoints even if called directly. Enforced at the database level via Row Level Security (RLS) on Supabase, not just frontend routing.

---

## 2. Student Dashboard

- View all available and upcoming tests with time remaining until start
- See test duration, question count, and subject/topic tag
- Attempt active tests
- View past attempt history — score, rank, time taken, integrity score
- Post-test breakdown — per question result (correct/incorrect, marks awarded, test cases passed)

---

## 3. Test System

**Multiple Tests** — Platform supports unlimited concurrent tests across different subjects or batches.

**Scheduled Activation** — Admin sets a `start_time` and `end_time`. Tests are invisible to students before the window and locked after it closes.

**Duration-based** — Each test has a fixed duration (e.g. 60 minutes). Timer starts when the student clicks "Start Test" and confirmed the proctored start checklist. Auto-submits when time runs out regardless of completion state.

**Auto-submit + Manual Submit** — On timer expiry, all current responses are captured and submitted atomically. Student can also manually submit early.

**Randomized Question Pool** — Admin uploads N questions to a test but sets a lower number M to be shown per student (e.g. upload 15, show 10). Each student gets a random sample of M questions. No two students are guaranteed the same paper, making answer sharing across groups unreliable.

**Timed Question Unlock (Progressive Reveal)** — Admin can configure each question to unlock at a specific minute mark (e.g. Q1 at 0:00, Q2 at 5:00, Q3 at 10:00). Students cannot jump ahead. This prevents the common pattern of photographing the full question paper at the start and sharing it in a group chat — by the time someone answers Q1 and shares it, Q2 is already available to everyone anyway, making coordination pointless.

**Proctored Start Screen** — Before the timer begins, students see a confirmation screen with rules: close other tabs, go fullscreen, acknowledge integrity policy. Test only starts after explicit confirmation. Sets behavioral expectations and makes integrity scoring defensible.

---

## 4. MCQ System

- Single correct answer per question
- Auto evaluation on submission
- **Option Order Shuffle** — The four options are shuffled independently per student. "Option A" for one student is "Option C" for another. Screenshots of answers shared in group chats become useless because the letter mappings differ across students.
- Marks per question configured by admin
- Questions drawn from randomized pool

---

## 5. Debugging-Based Coding System

**The Core Idea** — Traditional coding questions on test platforms are easy to cheat — paste the problem into ChatGPT, get a solution, submit. Debugging flips this. The student is given a piece of *already-written, buggy code* and must identify and fix the bug. They do not write code from scratch.

**Why it's harder to cheat** — The challenge is not "write a function to do X" (Google-able) but "here is this specific piece of code with this specific bug — fix it." The bug is embedded in a unique code variant assigned only to that student, so even if they share the code with someone else, that person is looking at a different variant with different variable names, different structure, same underlying bug logic — their fix won't copy-paste correctly.

**Read-only Code Block** — The buggy code is displayed in a read-only editor. The student cannot edit it directly. They must write their corrected version in a separate editable editor below. This forces genuine comprehension — you can't just tweak one line, you have to reconstruct the correct logic.

**Gemini-Powered Variant Generation** — Admin writes the original clean question (correct code + description of the bug to introduce). They hit "Generate Variants" — Gemini produces multiple buggy versions of the code, each with:
- Different variable names
- Different function names  
- Different code structure/style
- Same underlying bug to fix

Admin reviews all generated variants, selects which ones are good enough, and adds them to the question's pool. This is a one-time setup per question — no manual coding of buggy variants required.

**Random Variant Assignment** — When a student starts a test, one variant is randomly assigned to them from the pool for each debugging question. Assignment is stored in the database — the student always sees the same variant if they reload, and the assignment is logged for integrity purposes.

**Visible + Hidden Test Cases** — Each debugging question has:
- *Visible test cases* — shown to the student, they can run their code against these during the attempt
- *Hidden (honeypot) test cases* — never shown, only evaluated on final submission server-side

Hidden test cases catch the "just hardcode the output" cheat. If a student sees the expected output and writes `print("42")` instead of fixing the actual logic, they pass visible cases but fail hidden ones. Evaluation shows both scores separately.

**Languages Supported** — Python, C++

---

## 6. Code Execution

- Routed through an external execution API (Judge0 or Piston)
- Student can run code against visible test cases during the attempt (limited runs, e.g. max 10)
- On submission, hidden test cases are evaluated server-side only
- Results stored as `test_cases_passed / test_cases_total` — not binary pass/fail
- Execution is sandboxed by the external API — no security burden on the platform itself

---

## 7. Behavioral Fingerprinting

**What it is** — A passive signal collection system that tracks *how* a student solves a question, not just what they submit. No surveillance, no webcam, no screen recording — purely interaction metadata.

**Signals tracked per coding question:**
- `time_to_first_keystroke` — how long after opening the question before they started typing. Someone who submits a perfect solution 8 seconds after opening almost certainly didn't write it themselves.
- `wpm_consistency` — words per minute over time. Normal human typing has variance — bursts, pauses, corrections. A single paste event looks like 0 WPM → 400 WPM → 0 WPM. Flags mechanical input.
- `backspace_frequency` — genuine problem-solving has corrections and backtracking. A submission with zero backspaces on complex code is suspicious.
- `edit_count` — number of distinct edit sessions on the answer
- `test_runs_before_submit` — how many times they ran visible test cases before submitting. Zero runs on a correct submission is a flag.
- `idle_periods` — stretches of 3+ minutes with no keystrokes while the question is open. Could indicate looking elsewhere for help.

**How it's used** — All signals feed into the `behavioral_meta` JSON field on the `responses` table. Post-test, these are factored into the student's `integrity_score`. Admin sees a behavioral summary per student, not raw numbers — just flags like "Suspicious paste pattern detected" or "No corrections on 40-line submission."

No student is auto-penalized based on behavioral data alone. It surfaces outliers for human review.

---

## 8. Code Similarity Scoring

**What it is** — After a test closes, submissions for the same debugging variant are compared against each other using token-based similarity analysis.

**How it works** — Code is tokenized (variable names stripped, structure normalized) and compared pairwise. Pairs with similarity above a threshold (e.g. 80%) are flagged. Results stored in a `similarity_flags` table with both attempt IDs, the similarity score, and timestamp.

**What it doesn't do** — It does not auto-penalize. It generates a report for admin review. Two students writing similar fixes to the same bug is possible legitimately — the admin makes the call.

**Why it matters** — Even with variant randomization, students sometimes copy logic and manually adjust variable names. Tokenized comparison strips names and compares structure, catching these cases that naive string diff would miss.

---

## 9. Integrity Score

A single computed score (0–100) per attempt that aggregates all integrity signals:

| Signal | Deduction |
|---|---|
| Tab switch | −5 per event |
| Focus lost | −2 per event |
| Suspicious paste pattern | −10 |
| Zero backspaces on complex submission | −5 |
| Idle period during coding question | −3 per period |
| Flagged by similarity scoring | −15 |

Score never goes below 0. Displayed to admin alongside test score. Not shown to students.

---

## 10. Admin Panel

**Test Management** — Create, schedule, edit, publish, and close tests. Set duration, question pool size, unlock timing, and proctoring rules.

**Question Management** — Add MCQ questions with options and correct answer. Add debugging questions — upload original correct code, trigger Gemini variant generation, review and select variants for the pool.

**Leaderboard** — Live ranked leaderboard per test. Rank computed using SQL `RANK() OVER (PARTITION BY test_id ORDER BY score DESC)`.

**Integrity Dashboard** — Per-test view of all student integrity scores, flagged behavioral patterns, and similarity report. Sortable by integrity score to surface high-risk submissions quickly.

**Test Analytics** — Auto-computed post-test: average score, median time taken, per-question correct rate, hardest question (lowest correct %), completion rate. Powered by a database view — no manual calculation.

**Difficulty Auto-tagging** — After each test, questions are tagged Easy / Medium / Hard based on actual `correct_submissions / total_attempts` from real data. Updates the question bank for future test balancing.

---

## 11. Database Design Highlights

| Concept | Implementation |
|---|---|
| Question bank decoupled from tests | `question_bank` + `test_questions` junction table |
| Variant assignment logged | `debug_variant_assignments` table |
| Behavioral data | `behavioral_meta` JSON on `responses` |
| Similarity flags | `similarity_flags` table |
| Integrity score | Computed trigger on `results` insert |
| Leaderboard rank | `RANK()` window function |
| Analytics | `CREATE VIEW test_analytics` |
| Atomic submission | Transaction wrapping responses + results insert |
| Access control | RLS policies per role |

---

## 12. Results & Scoring

**Per attempt:**
- Total marks scored / total marks available
- Per question: marks awarded, correct/incorrect, time spent
- Coding: visible test cases passed, hidden test cases passed, separately
- Rank on leaderboard
- Integrity score (admin-only)
- Behavioral summary (admin-only)

**Scoring rules:**
- MCQ: full marks for correct, 0 for incorrect (no negative marking)
- Debugging: proportional — `(test_cases_passed / total_test_cases) × question_marks`

---

## User Roles

**Student** — Attempts tests, views personal dashboard and analytics, sees post-test results.

**Admin (Teacher)** — Creates and manages own tests, questions, and variants. Views results, leaderboard, integrity reports, and analytics for their own tests only. Cannot see another teacher's tests or students.

**Super Admin** *(minimal scope)* — Platform-level user management, batch/division setup. One per institution.

---

## Database Schema

### `users`
```sql
id                  uuid PRIMARY KEY
name                text
email               text UNIQUE
password_hash       text
role                enum('student', 'admin', 'super_admin')
year                text          -- e.g. 'SE', 'TE', 'BE'
division            text          -- e.g. 'A', 'B', 'C'
subject             text          -- for admins: subject they teach
created_at          timestamp
```

### `tests`
```sql
id                  uuid PRIMARY KEY
created_by          uuid REFERENCES users(id)
title               text
subject             text
year                text
division            text
duration_mins       int
start_time          timestamp
end_time            timestamp
status              enum('draft', 'active', 'ended')
total_marks         int
pool_size           int           -- total questions uploaded
questions_per_attempt int         -- questions shown per student
randomize_questions boolean
created_at          timestamp
```

### `question_bank`
```sql
id                  uuid PRIMARY KEY
created_by          uuid REFERENCES users(id)
type                enum('mcq_single', 'mcq_multi', 'debugging')
statement           text
statement_image_url text          -- optional
topic_tag           text
difficulty          enum('easy', 'medium', 'hard')
marks               decimal
language            enum('python', 'cpp')  -- for debugging only
correct_code        text                   -- for debugging only
bug_count           int                    -- admin-set, debugging only
created_at          timestamp
```

### `test_questions`
```sql
id                  uuid PRIMARY KEY
test_id             uuid REFERENCES tests(id)
question_id         uuid REFERENCES question_bank(id)
unlock_at_minutes   int           -- 0 means available from start
question_order      int
```

### `mcq_options`
```sql
id                  uuid PRIMARY KEY
question_id         uuid REFERENCES question_bank(id)
option_text         text          -- nullable if image
option_image_url    text          -- nullable if text
is_correct          boolean
display_order       int
```

### `debug_variants`
```sql
id                  uuid PRIMARY KEY
question_id         uuid REFERENCES question_bank(id)
generated_by        enum('gemini', 'manual')
buggy_code          text
diff_json           jsonb         -- exact lines changed, shown to admin
bug_count           int
difficulty          enum('easy', 'medium', 'hard')
language            enum('python', 'cpp')
is_approved         boolean       -- admin selects which variants enter pool
approved_at         timestamp
```

### `test_cases`
```sql
id                  uuid PRIMARY KEY
question_id         uuid REFERENCES question_bank(id)
input               text
expected_output     text
is_hidden           boolean       -- honeypot cases, never shown to student
```

### `attempts`
```sql
id                  uuid PRIMARY KEY
user_id             uuid REFERENCES users(id)
test_id             uuid REFERENCES tests(id)
status              enum('in_progress', 'submitted', 'auto_submitted')
started_at          timestamp
submitted_at        timestamp
ip_address          text
session_token       text
last_active_at      timestamp
tab_switches        int DEFAULT 0
focus_lost_count    int DEFAULT 0
```

### `variant_assignments`
```sql
id                  uuid PRIMARY KEY
attempt_id          uuid REFERENCES attempts(id)
question_id         uuid REFERENCES question_bank(id)
variant_id          uuid REFERENCES debug_variants(id)
assigned_at         timestamp
```

### `option_shuffle`
```sql
id                  uuid PRIMARY KEY
attempt_id          uuid REFERENCES attempts(id)
question_id         uuid REFERENCES question_bank(id)
shuffled_order      jsonb         -- array of option_ids in display order
```

### `responses`
```sql
id                  uuid PRIMARY KEY
attempt_id          uuid REFERENCES attempts(id)
question_id         uuid REFERENCES question_bank(id)
-- MCQ fields
selected_option_ids uuid[]        -- array for multi-correct
is_correct          boolean
marks_awarded       decimal
-- Coding fields
submitted_code      text
language            enum('python', 'cpp')
visible_cases_passed  int
visible_cases_total   int
hidden_cases_passed   int
hidden_cases_total    int
-- Behavioral fields
behavioral_meta     jsonb
/*
  behavioral_meta structure:
  {
    time_to_first_keystroke: int (seconds),
    wpm_consistency: float,
    backspace_count: int,
    edit_count: int,
    test_runs_before_submit: int,
    idle_periods: [{start: timestamp, duration_seconds: int}],
    paste_events: int
  }
*/
time_spent_seconds  int
```

### `results`
```sql
id                  uuid PRIMARY KEY
attempt_id          uuid REFERENCES attempts(id)  UNIQUE
total_score         decimal
total_marks         decimal
percentage          decimal
rank                int           -- computed via RANK() window function
integrity_score     int           -- 0-100, computed by trigger
pass_fail_overall   boolean
computed_at         timestamp
```

### `similarity_flags`
```sql
id                  uuid PRIMARY KEY
test_id             uuid REFERENCES tests(id)
attempt_id_1        uuid REFERENCES attempts(id)
attempt_id_2        uuid REFERENCES attempts(id)
question_id         uuid REFERENCES question_bank(id)
similarity_score    decimal       -- 0.0 to 1.0
flagged_at          timestamp
reviewed            boolean DEFAULT false
admin_verdict       enum('dismissed', 'confirmed', 'pending') DEFAULT 'pending'
```

### `question_import_logs`
```sql
id                  uuid PRIMARY KEY
imported_by         uuid REFERENCES users(id)
file_type           enum('json', 'csv')
total_rows          int
success_count       int
error_rows          jsonb         -- which rows failed and why
imported_at         timestamp
```

---

## Views & Computed SQL

### Leaderboard
```sql
CREATE VIEW leaderboard AS
SELECT
  u.name,
  u.year,
  u.division,
  r.total_score,
  r.percentage,
  RANK() OVER (
    PARTITION BY a.test_id
    ORDER BY r.total_score DESC
  ) AS rank,
  r.integrity_score,
  a.test_id
FROM results r
JOIN attempts a ON a.id = r.attempt_id
JOIN users u ON u.id = a.user_id;
```

### Test Analytics
```sql
CREATE VIEW test_analytics AS
SELECT
  a.test_id,
  COUNT(DISTINCT a.id)                          AS total_attempts,
  ROUND(AVG(r.total_score), 2)                  AS avg_score,
  ROUND(AVG(r.percentage), 2)                   AS avg_percentage,
  PERCENTILE_CONT(0.5) WITHIN GROUP
    (ORDER BY r.total_score)                    AS median_score,
  ROUND(AVG(
    EXTRACT(EPOCH FROM
      (a.submitted_at - a.started_at))/60), 2) AS avg_time_mins,
  COUNT(CASE WHEN a.status = 'submitted'
    OR a.status = 'auto_submitted'
    THEN 1 END) * 100.0
    / COUNT(*)                                  AS completion_rate
FROM attempts a
JOIN results r ON r.attempt_id = a.id
GROUP BY a.test_id;
```

### Question Difficulty Auto-tag
```sql
CREATE VIEW question_difficulty_actual AS
SELECT
  resp.question_id,
  COUNT(*)                                      AS total_attempts,
  SUM(CASE WHEN resp.is_correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(SUM(CASE WHEN resp.is_correct
    THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2)  AS correct_rate,
  CASE
    WHEN correct_rate >= 70 THEN 'easy'
    WHEN correct_rate >= 40 THEN 'medium'
    ELSE 'hard'
  END                                           AS actual_difficulty
FROM responses resp
GROUP BY resp.question_id;
```

---

## Triggers

### Integrity Score on Result Insert
```sql
CREATE OR REPLACE FUNCTION compute_integrity_score()
RETURNS TRIGGER AS $$
DECLARE
  v_tab_switches    int;
  v_focus_lost      int;
  v_score           int := 100;
  v_similarity_flag boolean;
BEGIN
  SELECT tab_switches, focus_lost_count
  INTO v_tab_switches, v_focus_lost
  FROM attempts WHERE id = NEW.attempt_id;

  SELECT EXISTS (
    SELECT 1 FROM similarity_flags
    WHERE (attempt_id_1 = NEW.attempt_id
      OR attempt_id_2 = NEW.attempt_id)
    AND admin_verdict != 'dismissed'
  ) INTO v_similarity_flag;

  v_score := v_score - (v_tab_switches * 5);
  v_score := v_score - (v_focus_lost * 2);
  IF v_similarity_flag THEN
    v_score := v_score - 15;
  END IF;

  NEW.integrity_score := GREATEST(v_score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_integrity_score
BEFORE INSERT ON results
FOR EACH ROW EXECUTE FUNCTION compute_integrity_score();
```

---

## Gemini Variant Generation Flow

1. Admin writes question statement + uploads correct code + sets `bug_count` + sets `difficulty`
2. Platform sends prompt to Gemini:
   *"Given this correct code, generate 5 buggy variants. Each variant must have exactly {bug_count} bugs. Difficulty: {difficulty}. Use different variable names, function names, and code structure across variants. Return JSON array with fields: buggy_code, diff (list of changed line numbers and what changed)."*
3. Gemini returns JSON array of variants
4. Platform stores each variant in `debug_variants` with `is_approved = false`
5. Admin sees a side-by-side diff view (original vs buggy, changed lines highlighted) for each variant
6. Admin approves variants into the pool — minimum 3 recommended per question
7. On test attempt, one approved variant randomly assigned per student via `variant_assignments`

---

## Bulk Question Import (CSV/JSON)

**Supported:** Text-only MCQ (single + multi-correct), text-only debugging questions (correct code included)

**Not supported via import:** Image-based questions — must be added manually

**CSV format for MCQ:**
```
type, statement, option_1, option_2, option_3, option_4,
correct_options, marks, topic_tag, difficulty
```

**JSON format:**
```json
[{
  "type": "mcq_single",
  "statement": "What is the time complexity of binary search?",
  "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
  "correct_options": [1],
  "marks": 2,
  "topic_tag": "Algorithms",
  "difficulty": "easy"
}]
```

Import results logged to `question_import_logs` with per-row error detail.

---

## Analytics

### Student Dashboard Analytics
- Score trend across all attempted tests (line chart)
- Subject-wise performance breakdown
- Average time per question type
- Accuracy rate: MCQ vs Debugging separately
- Personal rank trend over time

### Admin Analytics
- Filterable by: year, division, subject, test, date range
- Per-test: avg score, median, completion rate, hardest question
- Per-student: all attempts, score trend, integrity score history
- Division comparison: SE-A vs SE-B on same test
- Question bank health: actual difficulty distribution, most-failed questions

---

## Integrity Score Breakdown

| Signal | Deduction |
|---|---|
| Tab switch | −5 per event |
| Focus lost | −2 per event |
| Paste event on code editor | −10 |
| Zero backspaces on 20+ line submission | −5 |
| Idle period 3+ mins during coding | −3 per period |
| Flagged by similarity scoring | −15 |
| Score floor | 0 (never negative) |

---
