// TestForge — Full Seed Script
// Run from server/ directory: node seed.js
// Requires: @supabase/supabase-js
// Uses Supabase service role key to bypass RLS and create auth users

import { createClient } from '@supabase/supabase-js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const log = (msg) => console.log(`\n✓ ${msg}`);
const err = (msg, e) => console.error(`\n✗ ${msg}:`, e?.message || e);

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function subtractMinutes(date, mins) {
  return new Date(date.getTime() - mins * 60 * 1000).toISOString();
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000).toISOString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function subtractDays(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const now = new Date();

// ── Users ──────────────────────────────────────────────────────────────────
const ADMIN_USERS = [
  { name: 'Prof. Sharma', email: 'sharma@testforge.dev', subject: 'DBMS', year: 'SE', division: null },
  { name: 'Prof. Kulkarni', email: 'kulkarni@testforge.dev', subject: 'OS', year: 'TE', division: null },
];

const STUDENT_USERS = [
  // SE-A students
  { name: 'Arjun Mehta',    email: 'arjun@testforge.dev',   year: 'SE', division: 'A' },
  { name: 'Priya Nair',     email: 'priya@testforge.dev',    year: 'SE', division: 'A' },
  { name: 'Rohan Desai',    email: 'rohan@testforge.dev',    year: 'SE', division: 'A' },
  { name: 'Sneha Joshi',    email: 'sneha@testforge.dev',    year: 'SE', division: 'A' },
  { name: 'Vikram Singh',   email: 'vikram@testforge.dev',   year: 'SE', division: 'A' },
  // SE-B students
  { name: 'Ananya Rao',     email: 'ananya@testforge.dev',   year: 'SE', division: 'B' },
  { name: 'Karan Patel',    email: 'karan@testforge.dev',    year: 'SE', division: 'B' },
  { name: 'Meera Pillai',   email: 'meera@testforge.dev',    year: 'SE', division: 'B' },
  { name: 'Tanvir Khan',    email: 'tanvir@testforge.dev',   year: 'SE', division: 'B' },
  { name: 'Divya Sharma',   email: 'divya@testforge.dev',    year: 'SE', division: 'B' },
  // TE-A student (for OS subject)
  { name: 'Aditya Kumar',   email: 'aditya@testforge.dev',   year: 'TE', division: 'A' },
  { name: 'Riya Verma',     email: 'riya@testforge.dev',     year: 'TE', division: 'A' },
];

const DEFAULT_PASSWORD = 'TestForge@123';

// ─── STEP 1: Create Auth Users + Public Users ────────────────────────────────
async function seedUsers() {
  log('Creating users...');
  const userIds = {};

  // Admins
  for (const admin of ADMIN_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: admin.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: admin.name }
    });

    if (error) { err(`Admin ${admin.email}`, error); continue; }

    const { error: insertErr } = await supabase.from('users').insert({
      id: data.user.id,
      name: admin.name,
      email: admin.email,
      role: 'admin',
      year: admin.year,
      division: admin.division,
      subject: admin.subject,
    });

    if (insertErr) err(`Insert admin profile ${admin.email}`, insertErr);
    else {
      userIds[admin.email] = data.user.id;
      console.log(`  → Admin: ${admin.email} (${data.user.id})`);
    }
  }

  // Students
  for (const student of STUDENT_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: student.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: student.name }
    });

    if (error) { err(`Student ${student.email}`, error); continue; }

    const { error: insertErr } = await supabase.from('users').insert({
      id: data.user.id,
      name: student.name,
      email: student.email,
      role: 'student',
      year: student.year,
      division: student.division,
      subject: null,
    });

    if (insertErr) err(`Insert student profile ${student.email}`, insertErr);
    else {
      userIds[student.email] = data.user.id;
      console.log(`  → Student: ${student.email} (${data.user.id})`);
    }
  }

  log(`Users created. All passwords: ${DEFAULT_PASSWORD}`);
  return userIds;
}

// ─── STEP 2: Create Questions (MCQ + Debugging) ──────────────────────────────
async function seedQuestions(userIds) {
  log('Creating question bank...');
  const adminId = userIds['sharma@testforge.dev'];
  const questionIds = {};

  // ── MCQ Questions ──────────────────────────────────────────────────────────
  const mcqQuestions = [
    {
      type: 'mcq_single',
      statement: 'Which normal form eliminates partial dependencies?',
      topic_tag: 'Normalization',
      difficulty: 'easy',
      marks: 2,
      options: [
        { text: '1NF', is_correct: false },
        { text: '2NF', is_correct: true },
        { text: '3NF', is_correct: false },
        { text: 'BCNF', is_correct: false },
      ]
    },
    {
      type: 'mcq_single',
      statement: 'Which SQL clause is used to filter groups after aggregation?',
      topic_tag: 'SQL',
      difficulty: 'easy',
      marks: 2,
      options: [
        { text: 'WHERE', is_correct: false },
        { text: 'GROUP BY', is_correct: false },
        { text: 'HAVING', is_correct: true },
        { text: 'ORDER BY', is_correct: false },
      ]
    },
    {
      type: 'mcq_single',
      statement: 'What does ACID stand for in database transactions?',
      topic_tag: 'Transactions',
      difficulty: 'medium',
      marks: 2,
      options: [
        { text: 'Atomicity, Consistency, Isolation, Durability', is_correct: true },
        { text: 'Atomicity, Concurrency, Isolation, Durability', is_correct: false },
        { text: 'Availability, Consistency, Isolation, Durability', is_correct: false },
        { text: 'Atomicity, Consistency, Integration, Durability', is_correct: false },
      ]
    },
    {
      type: 'mcq_single',
      statement: 'Which index type is best suited for range queries?',
      topic_tag: 'Indexing',
      difficulty: 'medium',
      marks: 2,
      options: [
        { text: 'Hash Index', is_correct: false },
        { text: 'B+ Tree Index', is_correct: true },
        { text: 'Bitmap Index', is_correct: false },
        { text: 'Full-text Index', is_correct: false },
      ]
    },
    {
      type: 'mcq_multi',
      statement: 'Which of the following are properties of a primary key? (Select all that apply)',
      topic_tag: 'Keys',
      difficulty: 'medium',
      marks: 3,
      options: [
        { text: 'Unique', is_correct: true },
        { text: 'Not Null', is_correct: true },
        { text: 'Can be composite', is_correct: true },
        { text: 'Can contain duplicate values', is_correct: false },
      ]
    },
    {
      type: 'mcq_single',
      statement: 'Which join returns all records from the left table and matched records from the right table?',
      topic_tag: 'SQL',
      difficulty: 'easy',
      marks: 2,
      options: [
        { text: 'INNER JOIN', is_correct: false },
        { text: 'RIGHT JOIN', is_correct: false },
        { text: 'LEFT JOIN', is_correct: true },
        { text: 'CROSS JOIN', is_correct: false },
      ]
    },
    {
      type: 'mcq_single',
      statement: 'In the context of ER diagrams, a weak entity is one that:',
      topic_tag: 'ER Model',
      difficulty: 'medium',
      marks: 2,
      options: [
        { text: 'Has no attributes', is_correct: false },
        { text: 'Cannot exist without a related strong entity', is_correct: true },
        { text: 'Has more than one primary key', is_correct: false },
        { text: 'Has only derived attributes', is_correct: false },
      ]
    },
    {
      type: 'mcq_single',
      statement: 'What is the time complexity of searching in a B+ tree of order m and height h?',
      topic_tag: 'Indexing',
      difficulty: 'hard',
      marks: 3,
      options: [
        { text: 'O(n)', is_correct: false },
        { text: 'O(log n)', is_correct: false },
        { text: 'O(h × log m)', is_correct: false },
        { text: 'O(h)', is_correct: true },
      ]
    },
  ];

  for (const q of mcqQuestions) {
    const { data: qData, error: qErr } = await supabase
      .from('question_bank')
      .insert({
        created_by: adminId,
        type: q.type,
        statement: q.statement,
        topic_tag: q.topic_tag,
        difficulty: q.difficulty,
        marks: q.marks,
      })
      .select('id')
      .single();

    if (qErr) { err(`MCQ question: ${q.statement.slice(0, 40)}`, qErr); continue; }

    const options = q.options.map((opt, i) => ({
      question_id: qData.id,
      option_text: opt.text,
      is_correct: opt.is_correct,
      display_order: i + 1,
    }));

    const { error: optErr } = await supabase.from('mcq_options').insert(options);
    if (optErr) err('MCQ options', optErr);
    else {
      questionIds[`mcq_${q.topic_tag}_${q.difficulty}`] = qData.id;
      console.log(`  → MCQ: ${q.statement.slice(0, 50)}...`);
    }
  }

  // ── Debugging Questions ────────────────────────────────────────────────────
  const debugQuestions = [
    {
      statement: 'Fix the binary search function. It has a bug in the boundary condition that causes it to miss the last element or go into an infinite loop.',
      topic_tag: 'Algorithms',
      difficulty: 'medium',
      marks: 10,
      language: 'python',
      bug_count: 1,
      correct_code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,
      variants: [
        {
          buggy_code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,
          diff_json: [{ line: 3, original: 'while left <= right:', buggy: 'while left < right:' }],
          difficulty: 'easy',
        },
        {
          buggy_code: `def binary_search(arr, target):
    left, right = 0, len(arr)
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,
          diff_json: [{ line: 2, original: 'left, right = 0, len(arr) - 1', buggy: 'left, right = 0, len(arr)' }],
          difficulty: 'medium',
        },
        {
          buggy_code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid
        else:
            right = mid - 1
    return -1`,
          diff_json: [{ line: 7, original: 'left = mid + 1', buggy: 'left = mid' }],
          difficulty: 'hard',
        },
      ],
      test_cases: [
        { input: '[1, 3, 5, 7, 9]\n7', expected_output: '3', is_hidden: false },
        { input: '[1, 3, 5, 7, 9]\n1', expected_output: '0', is_hidden: false },
        { input: '[1, 3, 5, 7, 9]\n10', expected_output: '-1', is_hidden: true },
        { input: '[2, 4, 6, 8, 10, 12]\n12', expected_output: '5', is_hidden: true },
      ],
    },
    {
      statement: 'Fix the linked list reversal function. The bug causes either an infinite loop or an incorrect reversal.',
      topic_tag: 'Data Structures',
      difficulty: 'hard',
      marks: 10,
      language: 'python',
      bug_count: 1,
      correct_code: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

def reverse_list(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = next_node
    return prev`,
      variants: [
        {
          buggy_code: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

def reverse_list(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = curr.next
    return prev`,
          diff_json: [{ line: 13, original: 'curr = next_node', buggy: 'curr = curr.next' }],
          difficulty: 'medium',
        },
        {
          buggy_code: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

def reverse_list(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        curr.next = prev
        curr = next_node
        prev = curr
    return prev`,
          diff_json: [
            { line: 12, original: 'prev = curr', buggy: 'curr = next_node' },
            { line: 13, original: 'curr = next_node', buggy: 'prev = curr' },
          ],
          difficulty: 'hard',
        },
        {
          buggy_code: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

def reverse_list(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        prev = curr
        curr.next = prev
        curr = next_node
    return prev`,
          diff_json: [
            { line: 11, original: 'curr.next = prev', buggy: 'prev = curr' },
            { line: 12, original: 'prev = curr', buggy: 'curr.next = prev' },
          ],
          difficulty: 'hard',
        },
      ],
      test_cases: [
        { input: '[1, 2, 3, 4, 5]', expected_output: '[5, 4, 3, 2, 1]', is_hidden: false },
        { input: '[1]', expected_output: '[1]', is_hidden: false },
        { input: '[1, 2]', expected_output: '[2, 1]', is_hidden: true },
        { input: '[]', expected_output: '[]', is_hidden: true },
      ],
    },
    {
      statement: 'Fix the bubble sort implementation. The bug causes it to not fully sort the array in all cases.',
      topic_tag: 'Algorithms',
      difficulty: 'easy',
      marks: 8,
      language: 'python',
      bug_count: 1,
      correct_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
      variants: [
        {
          buggy_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
          diff_json: [{ line: 4, original: 'for j in range(0, n - i - 1):', buggy: 'for j in range(0, n - i):' }],
          difficulty: 'easy',
        },
        {
          buggy_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] >= arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
          diff_json: [{ line: 5, original: 'if arr[j] > arr[j + 1]:', buggy: 'if arr[j] >= arr[j + 1]:' }],
          difficulty: 'medium',
        },
        {
          buggy_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j] = arr[j + 1]
                arr[j + 1] = arr[j]
    return arr`,
          diff_json: [
            { line: 6, original: 'arr[j], arr[j + 1] = arr[j + 1], arr[j]', buggy: 'arr[j] = arr[j + 1]' },
            { line: 7, original: '', buggy: 'arr[j + 1] = arr[j]' },
          ],
          difficulty: 'easy',
        },
      ],
      test_cases: [
        { input: '[64, 34, 25, 12, 22, 11, 90]', expected_output: '[11, 12, 22, 25, 34, 64, 90]', is_hidden: false },
        { input: '[1, 2, 3]', expected_output: '[1, 2, 3]', is_hidden: false },
        { input: '[3, 2, 1]', expected_output: '[1, 2, 3]', is_hidden: true },
        { input: '[5]', expected_output: '[5]', is_hidden: true },
      ],
    },
  ];

  for (const q of debugQuestions) {
    const { data: qData, error: qErr } = await supabase
      .from('question_bank')
      .insert({
        created_by: adminId,
        type: 'debugging',
        statement: q.statement,
        topic_tag: q.topic_tag,
        difficulty: q.difficulty,
        marks: q.marks,
        language: q.language,
        bug_count: q.bug_count,
        correct_code: q.correct_code,
      })
      .select('id')
      .single();

    if (qErr) { err(`Debug question: ${q.topic_tag}`, qErr); continue; }

    questionIds[`debug_${q.topic_tag}`] = qData.id;
    console.log(`  → Debug question: ${q.statement.slice(0, 50)}...`);

    // Insert variants
    for (const v of q.variants) {
      const { error: vErr } = await supabase.from('debug_variants').insert({
        question_id: qData.id,
        generated_by: 'manual',
        buggy_code: v.buggy_code,
        diff_json: v.diff_json,
        bug_count: q.bug_count,
        difficulty: v.difficulty,
        language: q.language,
        is_approved: true,
        approved_at: now.toISOString(),
      });
      if (vErr) err('Debug variant', vErr);
    }

    // Insert test cases
    for (const tc of q.test_cases) {
      const { error: tcErr } = await supabase.from('test_cases').insert({
        question_id: qData.id,
        input: tc.input,
        expected_output: tc.expected_output,
        is_hidden: tc.is_hidden,
      });
      if (tcErr) err('Test case', tcErr);
    }
  }

  log('Questions seeded.');
  return questionIds;
}

// ─── STEP 3: Create Tests ─────────────────────────────────────────────────────
async function seedTests(userIds, questionIds) {
  log('Creating tests...');
  const adminId = userIds['sharma@testforge.dev'];
  const testIds = {};

  const tests = [
    {
      key: 'active_se_a',
      title: 'DBMS Mid-Semester Test — SE-A',
      subject: 'DBMS',
      year: 'SE',
      division: 'A',
      duration_mins: 60,
      status: 'active',
      start_time: subtractMinutes(now, 30),  // started 30 mins ago
      end_time: addMinutes(now, 90),          // ends in 90 mins
      total_marks: 35,
      pool_size: 11,
      questions_per_attempt: 8,
      randomize_questions: true,
    },
    {
      key: 'active_se_b',
      title: 'DBMS Mid-Semester Test — SE-B',
      subject: 'DBMS',
      year: 'SE',
      division: 'B',
      duration_mins: 60,
      status: 'active',
      start_time: subtractMinutes(now, 15),
      end_time: addMinutes(now, 105),
      total_marks: 35,
      pool_size: 11,
      questions_per_attempt: 8,
      randomize_questions: true,
    },
    {
      key: 'ended_1',
      title: 'DBMS Unit 1 Quiz',
      subject: 'DBMS',
      year: 'SE',
      division: 'A',
      duration_mins: 30,
      status: 'ended',
      start_time: subtractDays(now, 7),
      end_time: subtractDays(now, 6),
      total_marks: 20,
      pool_size: 8,
      questions_per_attempt: 6,
      randomize_questions: true,
    },
    {
      key: 'ended_2',
      title: 'SQL Fundamentals Test',
      subject: 'DBMS',
      year: 'SE',
      division: 'B',
      duration_mins: 45,
      status: 'ended',
      start_time: subtractDays(now, 14),
      end_time: subtractDays(now, 13),
      total_marks: 25,
      pool_size: 9,
      questions_per_attempt: 7,
      randomize_questions: false,
    },
    {
      key: 'upcoming',
      title: 'DBMS Final Examination',
      subject: 'DBMS',
      year: 'SE',
      division: 'A',
      duration_mins: 90,
      status: 'active',   // status active but start_time in future — Tests app shows "Upcoming"
      start_time: addDays(now, 3),
      end_time: addDays(now, 4),
      total_marks: 50,
      pool_size: 11,
      questions_per_attempt: 10,
      randomize_questions: true,
    },
  ];

  for (const t of tests) {
    const { data, error } = await supabase
      .from('tests')
      .insert({
        created_by: adminId,
        title: t.title,
        subject: t.subject,
        year: t.year,
        division: t.division,
        duration_mins: t.duration_mins,
        status: t.status,
        start_time: t.start_time,
        end_time: t.end_time,
        total_marks: t.total_marks,
        pool_size: t.pool_size,
        questions_per_attempt: t.questions_per_attempt,
        randomize_questions: t.randomize_questions,
      })
      .select('id')
      .single();

    if (error) { err(`Test: ${t.title}`, error); continue; }
    testIds[t.key] = data.id;
    console.log(`  → Test: ${t.title} (${data.id})`);
  }

  // Attach all questions to all tests
  const allQuestionIds = Object.values(questionIds);
  for (const [testKey, testId] of Object.entries(testIds)) {
    for (let i = 0; i < allQuestionIds.length; i++) {
      const { error } = await supabase.from('test_questions').insert({
        test_id: testId,
        question_id: allQuestionIds[i],
        unlock_at_minutes: 0,
        question_order: i + 1,
      });
      if (error) err(`Attach question to ${testKey}`, error);
    }
  }

  log('Tests seeded and questions attached.');
  return testIds;
}

// ─── STEP 4: Seed Completed Attempts + Results (for ended tests) ──────────────
async function seedAttempts(userIds, testIds) {
  log('Creating completed attempts and results...');

  const seStudents = [
    'arjun@testforge.dev',
    'priya@testforge.dev',
    'rohan@testforge.dev',
    'sneha@testforge.dev',
    'vikram@testforge.dev',
  ];

  const seBStudents = [
    'ananya@testforge.dev',
    'karan@testforge.dev',
    'meera@testforge.dev',
    'tanvir@testforge.dev',
    'divya@testforge.dev',
  ];

  // Ended test 1 — SE-A students
  for (const email of seStudents) {
    await createCompletedAttempt(
      userIds[email],
      testIds['ended_1'],
      subtractDays(new Date(), 7),
      20,  // total marks
      email
    );
  }

  // Ended test 2 — SE-B students
  for (const email of seBStudents) {
    await createCompletedAttempt(
      userIds[email],
      testIds['ended_2'],
      subtractDays(new Date(), 14),
      25,  // total marks
      email
    );
  }

  log('Completed attempts seeded.');
}

async function createCompletedAttempt(userId, testId, testDate, totalMarks, email) {
  if (!userId || !testId) return;

  // Generate varied behavioral profiles
  const isSuspicious = ['rohan@testforge.dev', 'tanvir@testforge.dev'].includes(email);
  const isHighPerformer = ['priya@testforge.dev', 'ananya@testforge.dev'].includes(email);

  const tabSwitches = isSuspicious ? randomBetween(3, 6) : randomBetween(0, 1);
  const focusLost = isSuspicious ? randomBetween(5, 10) : randomBetween(0, 3);
  const startedAt = new Date(testDate);
  const submittedAt = new Date(startedAt.getTime() + randomBetween(20, 55) * 60 * 1000);

  const { data: attempt, error: aErr } = await supabase
    .from('attempts')
    .insert({
      user_id: userId,
      test_id: testId,
      status: 'submitted',
      started_at: startedAt.toISOString(),
      submitted_at: submittedAt.toISOString(),
      tab_switches: tabSwitches,
      focus_lost_count: focusLost,
      session_token: crypto.randomUUID(),
      last_active_at: submittedAt.toISOString(),
      ip_address: `192.168.1.${randomBetween(10, 100)}`,
    })
    .select('id')
    .single();

  if (aErr) { err(`Attempt for ${email}`, aErr); return; }

  // Score — varied across students
  let scorePercent;
  if (isHighPerformer) scorePercent = randomBetween(80, 95);
  else if (isSuspicious) scorePercent = randomBetween(85, 100); // suspicious AND high score = flag
  else scorePercent = randomBetween(45, 75);

  const totalScore = Math.round((scorePercent / 100) * totalMarks * 10) / 10;

  // Behavioral meta for suspicious students
  const behavioralMeta = isSuspicious ? {
    time_to_first_keystroke: randomBetween(2, 5),  // suspiciously fast
    wpm_consistency: randomBetween(120, 180),        // suspiciously fast typing
    backspace_count: randomBetween(0, 3),            // almost no corrections
    edit_count: 1,
    test_runs_before_submit: 0,                      // submitted without running
    paste_events: randomBetween(2, 4),               // paste events detected
    idle_periods: [],
  } : {
    time_to_first_keystroke: randomBetween(15, 45),
    wpm_consistency: randomBetween(30, 70),
    backspace_count: randomBetween(10, 40),
    edit_count: randomBetween(3, 8),
    test_runs_before_submit: randomBetween(2, 6),
    paste_events: 0,
    idle_periods: [],
  };

  // Insert a dummy response
  const { error: rErr } = await supabase.from('responses').insert({
    attempt_id: attempt.id,
    question_id: null,  // simplified for seed — real flow populates per question
    is_correct: scorePercent > 60,
    marks_awarded: totalScore,
    behavioral_meta: behavioralMeta,
    time_spent_seconds: randomBetween(800, 3200),
  });

  // Compute integrity score
  let integrityScore = 100;
  integrityScore -= tabSwitches * 5;
  integrityScore -= focusLost * 2;
  if (isSuspicious) integrityScore -= 10; // paste penalty
  integrityScore = Math.max(0, integrityScore);

  // Insert result
  const { error: resErr } = await supabase.from('results').insert({
    attempt_id: attempt.id,
    total_score: totalScore,
    total_marks: totalMarks,
    percentage: scorePercent,
    integrity_score: integrityScore,
    pass_fail_overall: scorePercent >= 40,
    computed_at: submittedAt.toISOString(),
  });

  if (resErr) err(`Result for ${email}`, resErr);
  else console.log(`  → ${email}: ${totalScore}/${totalMarks} (${scorePercent}%) integrity: ${integrityScore}`);
}

// ─── STEP 5: Seed Similarity Flags ───────────────────────────────────────────
async function seedSimilarityFlags(userIds, testIds) {
  log('Creating similarity flags...');

  // Get the attempts for rohan and arjun on ended_1 (suspicious pair)
  const { data: attempts } = await supabase
    .from('attempts')
    .select('id, user_id')
    .eq('test_id', testIds['ended_1'])
    .in('user_id', [
      userIds['rohan@testforge.dev'],
      userIds['arjun@testforge.dev'],
    ]);

  if (!attempts || attempts.length < 2) {
    console.log('  → Not enough attempts for similarity flag, skipping');
    return;
  }

  const { error } = await supabase.from('similarity_flags').insert({
    test_id: testIds['ended_1'],
    attempt_id_1: attempts[0].id,
    attempt_id_2: attempts[1].id,
    question_id: null,
    similarity_score: 0.87,
    flagged_at: subtractDays(new Date(), 6),
    reviewed: false,
    admin_verdict: 'pending',
  });

  if (error) err('Similarity flag', error);
  else console.log('  → Similarity flag created between rohan and arjun');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 TestForge Seed Script Starting...');
  console.log('━'.repeat(50));

  try {
    const userIds = await seedUsers();
    const questionIds = await seedQuestions(userIds);
    const testIds = await seedTests(userIds, questionIds);
    await seedAttempts(userIds, testIds);
    await seedSimilarityFlags(userIds, testIds);

    console.log('\n' + '━'.repeat(50));
    console.log('✅ Seeding complete!\n');
    console.log('📋 Test Accounts Created:');
    console.log(`   Password for all: ${DEFAULT_PASSWORD}\n`);
    console.log('👨‍💼 Admins:');
    ADMIN_USERS.forEach(u => console.log(`   ${u.email}`));
    console.log('\n👨‍🎓 Students:');
    STUDENT_USERS.forEach(u => console.log(`   ${u.email} (${u.year}-${u.division})`));
    console.log('\n🧪 Test Data:');
    console.log('   → 2 active tests (SE-A and SE-B)');
    console.log('   → 1 upcoming test (SE-A, starts in 3 days)');
    console.log('   → 2 ended tests with full results');
    console.log('   → 8 MCQ questions + 3 debugging questions');
    console.log('   → Suspicious behavioral profiles: rohan, tanvir');
    console.log('   → High performers: priya, ananya');
    console.log('   → 1 similarity flag (rohan + arjun, 87% similarity)');
    console.log('\n⚠️  Fix before testing:');
    console.log('   → Add RLS policies to behavioral_details and behavioral_flags tables');
    console.log('   → Replace local compiler with Piston API in /execute route');

  } catch (e) {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  }
}

main();
