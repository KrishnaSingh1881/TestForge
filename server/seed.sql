-- ============================================================
-- TestForge — Seed Data
-- Run this in Supabase SQL Editor AFTER schema.sql
-- NOTE: Auth users must be created separately via Supabase Auth
--       or use the register API. This seeds the public.users
--       table and all related data using fixed UUIDs.
-- ============================================================

-- ── USERS (public.users table) ────────────────────────────────
-- These UUIDs must match auth.users IDs if using Supabase Auth.
-- For testing, insert directly and bypass auth by using service role.

INSERT INTO users (id, name, email, role, year, division, subject) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Prof. Sharma',    'admin@testforge.dev',    'admin',   NULL, NULL, 'DBMS'),
  ('00000000-0000-0000-0000-000000000002', 'Arjun Mehta',     'arjun@testforge.dev',    'student', 'SE', 'A',  NULL),
  ('00000000-0000-0000-0000-000000000003', 'Priya Nair',      'priya@testforge.dev',    'student', 'SE', 'A',  NULL),
  ('00000000-0000-0000-0000-000000000004', 'Rohan Desai',     'rohan@testforge.dev',    'student', 'SE', 'B',  NULL),
  ('00000000-0000-0000-0000-000000000005', 'Sneha Kulkarni',  'sneha@testforge.dev',    'student', 'SE', 'B',  NULL),
  ('00000000-0000-0000-0000-000000000006', 'Vikram Joshi',    'vikram@testforge.dev',   'student', 'SE', 'A',  NULL)
ON CONFLICT (id) DO NOTHING;

-- ── TESTS ─────────────────────────────────────────────────────

INSERT INTO tests (id, created_by, title, subject, year, division, duration_mins, start_time, end_time, status, total_marks, questions_per_attempt, randomize_questions) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'DBMS Unit 1 — MCQ Test',
    'DBMS', 'SE', 'A',
    30,
    now() - interval '2 days',
    now() - interval '1 day',
    'ended',
    10,
    5,
    true
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'DBMS Unit 2 — Debugging Test',
    'DBMS', 'SE', 'A',
    45,
    now() + interval '1 hour',
    now() + interval '3 hours',
    'active',
    20,
    3,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- ── MCQ QUESTIONS ─────────────────────────────────────────────

INSERT INTO question_bank (id, created_by, type, statement, topic_tag, difficulty, marks) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'mcq_single', 'Which of the following is a DDL command?', 'SQL', 'easy', 2),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'mcq_single', 'What does ACID stand for in database transactions?', 'Transactions', 'medium', 2),
  ('bbbbbbbb-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'mcq_single', 'Which normal form eliminates transitive dependencies?', 'Normalization', 'medium', 2),
  ('bbbbbbbb-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'mcq_single', 'A foreign key references which key in another table?', 'Relational Model', 'easy', 2),
  ('bbbbbbbb-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'mcq_single', 'Which JOIN returns all rows from both tables?', 'SQL Joins', 'hard', 2)
ON CONFLICT (id) DO NOTHING;

-- MCQ Options
INSERT INTO mcq_options (id, question_id, option_text, is_correct, display_order) VALUES
  -- Q1: DDL command
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'SELECT', false, 1),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'INSERT', false, 2),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'CREATE', true,  3),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'UPDATE', false, 4),
  -- Q2: ACID
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'Atomicity, Consistency, Isolation, Durability', true,  1),
  ('cccccccc-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000002', 'Atomicity, Concurrency, Integrity, Durability', false, 2),
  ('cccccccc-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000002', 'Access, Consistency, Isolation, Dependency', false, 3),
  ('cccccccc-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000002', 'Atomicity, Consistency, Integration, Durability', false, 4),
  -- Q3: Normal form
  ('cccccccc-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000003', '1NF', false, 1),
  ('cccccccc-0000-0000-0000-000000000010', 'bbbbbbbb-0000-0000-0000-000000000003', '2NF', false, 2),
  ('cccccccc-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000003', '3NF', true,  3),
  ('cccccccc-0000-0000-0000-000000000012', 'bbbbbbbb-0000-0000-0000-000000000003', 'BCNF', false, 4),
  -- Q4: Foreign key
  ('cccccccc-0000-0000-0000-000000000013', 'bbbbbbbb-0000-0000-0000-000000000004', 'Foreign key', false, 1),
  ('cccccccc-0000-0000-0000-000000000014', 'bbbbbbbb-0000-0000-0000-000000000004', 'Primary key', true,  2),
  ('cccccccc-0000-0000-0000-000000000015', 'bbbbbbbb-0000-0000-0000-000000000004', 'Unique key', false, 3),
  ('cccccccc-0000-0000-0000-000000000016', 'bbbbbbbb-0000-0000-0000-000000000004', 'Candidate key', false, 4),
  -- Q5: JOIN
  ('cccccccc-0000-0000-0000-000000000017', 'bbbbbbbb-0000-0000-0000-000000000005', 'INNER JOIN', false, 1),
  ('cccccccc-0000-0000-0000-000000000018', 'bbbbbbbb-0000-0000-0000-000000000005', 'LEFT JOIN', false, 2),
  ('cccccccc-0000-0000-0000-000000000019', 'bbbbbbbb-0000-0000-0000-000000000005', 'RIGHT JOIN', false, 3),
  ('cccccccc-0000-0000-0000-000000000020', 'bbbbbbbb-0000-0000-0000-000000000005', 'FULL OUTER JOIN', true, 4)
ON CONFLICT (id) DO NOTHING;

-- ── DEBUGGING QUESTIONS ───────────────────────────────────────

INSERT INTO question_bank (id, created_by, type, statement, topic_tag, difficulty, marks, language, correct_code, bug_count) VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'debugging',
    'Fix the function that calculates the factorial of a number. It should return 1 for n=0.',
    'Recursion',
    'easy',
    5,
    'python',
    'def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)',
    1
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'debugging',
    'Fix the function that checks if a string is a palindrome.',
    'Strings',
    'medium',
    5,
    'python',
    'def is_palindrome(s):
    return s == s[::-1]',
    1
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'debugging',
    'Fix the binary search function to correctly find the target in a sorted array.',
    'Searching',
    'hard',
    10,
    'python',
    'def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1',
    2
  )
ON CONFLICT (id) DO NOTHING;

-- Debug variants (buggy versions)
INSERT INTO debug_variants (id, question_id, generated_by, buggy_code, bug_count, difficulty, language, is_approved) VALUES
  (
    'dddddddd-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000006',
    'manual',
    'def factorial(n):
    if n == 0:
        return 0
    return n * factorial(n - 1)',
    1, 'easy', 'python', true
  ),
  (
    'dddddddd-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000007',
    'manual',
    'def is_palindrome(s):
    return s == s[::1]',
    1, 'medium', 'python', true
  ),
  (
    'dddddddd-0000-0000-0000-000000000003',
    'bbbbbbbb-0000-0000-0000-000000000008',
    'manual',
    'def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1',
    2, 'hard', 'python', true
  )
ON CONFLICT (id) DO NOTHING;

-- Test cases for debugging questions
INSERT INTO test_cases (id, question_id, input, expected_output, is_hidden) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000006', '0', '1', false),
  ('eeeeeeee-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000006', '5', '120', false),
  ('eeeeeeee-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000006', '10', '3628800', true),
  ('eeeeeeee-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000007', 'racecar', 'True', false),
  ('eeeeeeee-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000007', 'hello', 'False', false),
  ('eeeeeeee-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000007', 'madam', 'True', true),
  ('eeeeeeee-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000008', '1 3 5 7 9|5', '2', false),
  ('eeeeeeee-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000008', '2 4 6 8|7', '-1', false),
  ('eeeeeeee-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000008', '1 2 3 4 5|1', '0', true)
ON CONFLICT (id) DO NOTHING;

-- ── TEST QUESTIONS (attach to tests) ──────────────────────────

INSERT INTO test_questions (id, test_id, question_id, unlock_at_minutes, question_order) VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 0, 1),
  ('ffffffff-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 0, 2),
  ('ffffffff-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 0, 3),
  ('ffffffff-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', 0, 4),
  ('ffffffff-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', 0, 5),
  ('ffffffff-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000006', 0,  1),
  ('ffffffff-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000007', 10, 2),
  ('ffffffff-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000008', 20, 3)
ON CONFLICT (id) DO NOTHING;

-- ── ATTEMPTS (for ended test) ─────────────────────────────────

INSERT INTO attempts (id, user_id, test_id, status, started_at, submitted_at, tab_switches, focus_lost_count) VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'submitted',      now() - interval '25 hours', now() - interval '24 hours 30 minutes', 0, 1),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'submitted',      now() - interval '25 hours', now() - interval '24 hours 28 minutes', 1, 2),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'submitted',      now() - interval '25 hours', now() - interval '24 hours 25 minutes', 0, 0),
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'auto_submitted', now() - interval '25 hours', now() - interval '24 hours 20 minutes', 3, 5),
  ('11111111-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'submitted',      now() - interval '25 hours', now() - interval '24 hours 22 minutes', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── RESPONSES ─────────────────────────────────────────────────

-- Arjun: 4/5 correct
INSERT INTO responses (attempt_id, question_id, selected_option_ids, is_correct, marks_awarded) VALUES
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', ARRAY['cccccccc-0000-0000-0000-000000000003']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', ARRAY['cccccccc-0000-0000-0000-000000000005']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', ARRAY['cccccccc-0000-0000-0000-000000000011']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', ARRAY['cccccccc-0000-0000-0000-000000000013']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', ARRAY['cccccccc-0000-0000-0000-000000000020']::uuid[], true,  2)
ON CONFLICT DO NOTHING;

-- Priya: 3/5 correct
INSERT INTO responses (attempt_id, question_id, selected_option_ids, is_correct, marks_awarded) VALUES
  ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', ARRAY['cccccccc-0000-0000-0000-000000000003']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', ARRAY['cccccccc-0000-0000-0000-000000000006']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', ARRAY['cccccccc-0000-0000-0000-000000000011']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', ARRAY['cccccccc-0000-0000-0000-000000000014']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005', ARRAY['cccccccc-0000-0000-0000-000000000017']::uuid[], false, 0)
ON CONFLICT DO NOTHING;

-- Rohan: 5/5 correct
INSERT INTO responses (attempt_id, question_id, selected_option_ids, is_correct, marks_awarded) VALUES
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', ARRAY['cccccccc-0000-0000-0000-000000000003']::uuid[], true, 2),
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', ARRAY['cccccccc-0000-0000-0000-000000000005']::uuid[], true, 2),
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', ARRAY['cccccccc-0000-0000-0000-000000000011']::uuid[], true, 2),
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000004', ARRAY['cccccccc-0000-0000-0000-000000000014']::uuid[], true, 2),
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000005', ARRAY['cccccccc-0000-0000-0000-000000000020']::uuid[], true, 2)
ON CONFLICT DO NOTHING;

-- Sneha: 1/5 (integrity violation, auto-submitted)
INSERT INTO responses (attempt_id, question_id, selected_option_ids, is_correct, marks_awarded) VALUES
  ('11111111-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', ARRAY['cccccccc-0000-0000-0000-000000000001']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', ARRAY['cccccccc-0000-0000-0000-000000000005']::uuid[], true,  0),
  ('11111111-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', ARRAY['cccccccc-0000-0000-0000-000000000009']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', ARRAY['cccccccc-0000-0000-0000-000000000013']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000005', ARRAY['cccccccc-0000-0000-0000-000000000017']::uuid[], false, 0)
ON CONFLICT DO NOTHING;

-- Vikram: 2/5 correct
INSERT INTO responses (attempt_id, question_id, selected_option_ids, is_correct, marks_awarded) VALUES
  ('11111111-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', ARRAY['cccccccc-0000-0000-0000-000000000003']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', ARRAY['cccccccc-0000-0000-0000-000000000007']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000003', ARRAY['cccccccc-0000-0000-0000-000000000009']::uuid[], false, 0),
  ('11111111-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004', ARRAY['cccccccc-0000-0000-0000-000000000014']::uuid[], true,  2),
  ('11111111-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000005', ARRAY['cccccccc-0000-0000-0000-000000000018']::uuid[], false, 0)
ON CONFLICT DO NOTHING;

-- ── RESULTS ───────────────────────────────────────────────────

INSERT INTO results (attempt_id, total_score, total_marks, percentage, rank, pass_fail_overall) VALUES
  ('11111111-0000-0000-0000-000000000001', 8,  10, 80.0, 2, true),
  ('11111111-0000-0000-0000-000000000002', 6,  10, 60.0, 3, true),
  ('11111111-0000-0000-0000-000000000003', 10, 10, 100.0, 1, true),
  ('11111111-0000-0000-0000-000000000004', 0,  10, 0.0,  5, false),
  ('11111111-0000-0000-0000-000000000005', 4,  10, 40.0, 4, false)
ON CONFLICT DO NOTHING;
