// TestForge — Fresh Seed Script v2
// Nukes all existing data and seeds a clean, realistic dataset
// Run: node --env-file=.env seed_fresh.js
//
// What this creates:
//   • 2 admin users  (sharma + kulkarni)
//   • 12 students    (SE-A, SE-B, TE-A)
//   • DBMS question bank: 8 MCQ + 2 debugging (each with 3 variants)
//   • OS question bank  : 6 MCQ + 1 debugging (each with 2 variants)
//   • 3 tests:
//       ① DBMS Mid-Sem — ENDED   (SE-A, SE-B both attempted, all 10 students)
//       ② OS Unit Test — ACTIVE  (TE-A, 2 students in-progress)
//       ③ DBMS Viva Prep — UPCOMING (SE-A only, not yet started)
//   • Realistic attempt data:
//       - MCQ responses with correct/incorrect tracking, NO behavioral_meta
//       - Debugging responses with behavioral_meta ONLY (real signals)
//   • Results with integrity scores computed from tab_switches / behavioral flags
//   • 1 similarity flag pair (Arjun ↔ Rohan cheating scenario)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL         || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log  = (...a) => console.log('✓', ...a);
const warn = (...a) => console.warn('⚠', ...a);
const die  = (...a) => { console.error('✗', ...a); };

function pick(arr)         { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr)      { return [...arr].sort(() => Math.random() - 0.5); }
function sample(arr, n)    { return shuffle(arr).slice(0, n); }
function rand(min, max)    { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n)        { return new Date(Date.now() - n * 86400_000).toISOString(); }
function daysFrom(n)       { return new Date(Date.now() + n * 86400_000).toISOString(); }
function minsAgo(n)        { return new Date(Date.now() - n * 60_000).toISOString(); }
function minsFrom(n)       { return new Date(Date.now() + n * 60_000).toISOString(); }

// ─── NUKE ──────────────────────────────────────────────────────────────────────
async function nuke() {
  console.log('\n🔥 Nuking all existing data...\n');
  const tables = [
    'similarity_flags',
    'option_shuffle',
    'variant_assignments',
    'responses',
    'results',
    'attempts',
    'test_questions',
    'test_cases',
    'debug_variants',
    'mcq_options',
    'question_bank',
    'tests',
    'question_import_logs',
  ];

  for (const t of tables) {
    const { error } = await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) warn(`Could not clear ${t}: ${error.message}`);
    else log(`Cleared ${t}`);
  }

  // Delete non-master auth users
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 200 });
  for (const u of (users ?? [])) {
    const { data: profile } = await sb.from('users').select('role').eq('id', u.id).maybeSingle();
    if (profile?.role === 'master_admin') continue; // keep Puddin
    await sb.auth.admin.deleteUser(u.id);
  }

  // Clear users table (except master_admin)
  const { error: uErr } = await sb.from('users').delete().neq('role', 'master_admin');
  if (uErr) warn('users clear', uErr.message);
  else log('Cleared users (kept master_admin)');
}

// ─── USERS ─────────────────────────────────────────────────────────────────────
const DEFAULT_PW = 'TestForge@123';

const ADMIN_DEFS = [
  { name: 'Prof. Anand Sharma',    email: 'sharma@testforge.dev',   year: 'SE', subject: 'DBMS' },
  { name: 'Prof. Renu Kulkarni',   email: 'kulkarni@testforge.dev', year: 'TE', subject: 'OS'   },
];

const STUDENT_DEFS = [
  // SE-A
  { name: 'Arjun Mehta',   email: 'arjun@testforge.dev',   year: 'SE', division: 'A' },
  { name: 'Priya Nair',    email: 'priya@testforge.dev',    year: 'SE', division: 'A' },
  { name: 'Rohan Desai',   email: 'rohan@testforge.dev',    year: 'SE', division: 'A' },
  { name: 'Sneha Joshi',   email: 'sneha@testforge.dev',    year: 'SE', division: 'A' },
  { name: 'Vikram Singh',  email: 'vikram@testforge.dev',   year: 'SE', division: 'A' },
  // SE-B
  { name: 'Ananya Rao',    email: 'ananya@testforge.dev',   year: 'SE', division: 'B' },
  { name: 'Karan Patel',   email: 'karan@testforge.dev',    year: 'SE', division: 'B' },
  { name: 'Meera Pillai',  email: 'meera@testforge.dev',    year: 'SE', division: 'B' },
  { name: 'Tanvir Khan',   email: 'tanvir@testforge.dev',   year: 'SE', division: 'B' },
  { name: 'Divya Sharma',  email: 'divya@testforge.dev',    year: 'SE', division: 'B' },
  // TE-A
  { name: 'Aditya Kumar',  email: 'aditya@testforge.dev',   year: 'TE', division: 'A' },
  { name: 'Riya Verma',    email: 'riya@testforge.dev',     year: 'TE', division: 'A' },
];

async function seedUsers() {
  console.log('\n👤 Seeding users...\n');
  const ids = {};

  for (const a of ADMIN_DEFS) {
    const { data, error } = await sb.auth.admin.createUser({
      email: a.email, password: DEFAULT_PW, email_confirm: true,
      user_metadata: { name: a.name },
    });
    if (error) { warn(`Admin ${a.email}: ${error.message}`); continue; }
    await sb.from('users').insert({ id: data.user.id, name: a.name, email: a.email, role: 'admin', year: a.year, subject: a.subject });
    ids[a.email] = data.user.id;
    log(`Admin: ${a.email}`);
  }

  for (const s of STUDENT_DEFS) {
    const { data, error } = await sb.auth.admin.createUser({
      email: s.email, password: DEFAULT_PW, email_confirm: true,
      user_metadata: { name: s.name },
    });
    if (error) { warn(`Student ${s.email}: ${error.message}`); continue; }
    await sb.from('users').insert({ id: data.user.id, name: s.name, email: s.email, role: 'student', year: s.year, division: s.division });
    ids[s.email] = data.user.id;
    log(`Student: ${s.email}`);
  }

  return ids;
}

// ─── QUESTIONS ─────────────────────────────────────────────────────────────────
async function seedQuestions(adminId) {
  console.log('\n📚 Seeding question bank...\n');
  const qIds = {};

  // ── DBMS MCQ ──────────────────────────────────────────────────────────────
  const dbmsMcq = [
    {
      key: 'dbms_2nf', type: 'mcq_single', difficulty: 'easy', marks: 2,
      statement: 'Which normal form eliminates partial dependencies on a composite primary key?',
      topic_tag: 'Normalization',
      options: [
        { text: '1NF — ensures atomic values', correct: false },
        { text: '2NF — removes partial dependencies', correct: true },
        { text: '3NF — removes transitive dependencies', correct: false },
        { text: 'BCNF — stricter than 3NF', correct: false },
      ],
    },
    {
      key: 'dbms_having', type: 'mcq_single', difficulty: 'easy', marks: 2,
      statement: 'Which SQL clause filters groups formed by GROUP BY?',
      topic_tag: 'SQL',
      options: [
        { text: 'WHERE', correct: false },
        { text: 'FILTER', correct: false },
        { text: 'HAVING', correct: true },
        { text: 'SELECT', correct: false },
      ],
    },
    {
      key: 'dbms_acid', type: 'mcq_single', difficulty: 'medium', marks: 2,
      statement: 'What does the "I" in ACID stand for?',
      topic_tag: 'Transactions',
      options: [
        { text: 'Integration', correct: false },
        { text: 'Integrity', correct: false },
        { text: 'Isolation', correct: true },
        { text: 'Immutability', correct: false },
      ],
    },
    {
      key: 'dbms_bplus', type: 'mcq_single', difficulty: 'medium', marks: 2,
      statement: 'Which is the BEST index structure for range-based queries?',
      topic_tag: 'Indexing',
      options: [
        { text: 'Hash Index', correct: false },
        { text: 'Bitmap Index', correct: false },
        { text: 'B+ Tree Index', correct: true },
        { text: 'Full-Text Index', correct: false },
      ],
    },
    {
      key: 'dbms_pk', type: 'mcq_multi', difficulty: 'medium', marks: 3,
      statement: 'Which of the following are TRUE about a PRIMARY KEY? (Select all that apply)',
      topic_tag: 'Keys',
      options: [
        { text: 'Must be unique across all rows', correct: true },
        { text: 'Cannot contain NULL values', correct: true },
        { text: 'Can be a composite of multiple columns', correct: true },
        { text: 'Can have duplicate values if all columns differ', correct: false },
      ],
    },
    {
      key: 'dbms_leftjoin', type: 'mcq_single', difficulty: 'easy', marks: 2,
      statement: 'Which JOIN returns ALL rows from the left table and only matching rows from the right?',
      topic_tag: 'SQL',
      options: [
        { text: 'INNER JOIN', correct: false },
        { text: 'RIGHT JOIN', correct: false },
        { text: 'LEFT JOIN', correct: true },
        { text: 'NATURAL JOIN', correct: false },
      ],
    },
    {
      key: 'dbms_weakent', type: 'mcq_single', difficulty: 'medium', marks: 2,
      statement: 'In an ER diagram, a weak entity set:',
      topic_tag: 'ER Model',
      options: [
        { text: 'Has no primary key of its own and depends on a strong entity', correct: true },
        { text: 'Has more than one primary key', correct: false },
        { text: 'Cannot participate in relationships', correct: false },
        { text: 'Must always have a foreign key', correct: false },
      ],
    },
    {
      key: 'dbms_3nf', type: 'mcq_single', difficulty: 'hard', marks: 3,
      statement: 'A relation is in 3NF if, for every non-trivial FD X→Y, which condition must hold?',
      topic_tag: 'Normalization',
      options: [
        { text: 'X is a superkey', correct: false },
        { text: 'Y is a prime attribute', correct: false },
        { text: 'X is a superkey OR Y is a prime attribute', correct: true },
        { text: 'X is a candidate key AND Y is not a prime attribute', correct: false },
      ],
    },
  ];

  for (const q of dbmsMcq) {
    const { data, error } = await sb.from('question_bank').insert({
      created_by: adminId, type: q.type, statement: q.statement,
      topic_tag: q.topic_tag, difficulty: q.difficulty, marks: q.marks,
    }).select('id').single();
    if (error) { warn(`MCQ ${q.key}`, error.message); continue; }
    qIds[q.key] = data.id;

    const opts = q.options.map((o, i) => ({
      question_id: data.id, option_text: o.text,
      is_correct: o.correct, display_order: i + 1,
    }));
    await sb.from('mcq_options').insert(opts);
    log(`DBMS MCQ: ${q.key}`);
  }

  // ── DBMS Debugging ────────────────────────────────────────────────────────
  const dbmsDebug = [
    {
      key: 'dbms_bsearch',
      statement: 'Fix the binary search function — it has a boundary condition bug that causes infinite loops or misses the last element.',
      topic_tag: 'Algorithms', difficulty: 'medium', marks: 10, language: 'python',
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
          difficulty: 'easy',
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
        },
        {
          difficulty: 'medium',
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
        },
        {
          difficulty: 'hard',
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
          diff_json: [{ line: 8, original: '            left = mid + 1', buggy: '            left = mid' }],
        },
      ],
      test_cases: [
        { input: '[1,3,5,7,9]\n7',  expected_output: '3',  is_hidden: false },
        { input: '[1,3,5,7,9]\n1',  expected_output: '0',  is_hidden: false },
        { input: '[1,3,5,7,9]\n10', expected_output: '-1', is_hidden: true  },
        { input: '[2,4,6,8,10]\n10',expected_output: '4',  is_hidden: true  },
      ],
    },
    {
      key: 'dbms_bubble',
      statement: 'Fix the bubble sort function — the inner loop bound is wrong and causes an IndexError or incomplete sorting.',
      topic_tag: 'Algorithms', difficulty: 'easy', marks: 8, language: 'python',
      bug_count: 1,
      correct_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
      variants: [
        {
          difficulty: 'easy',
          buggy_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
          diff_json: [{ line: 4, original: '        for j in range(n - 1 - i):', buggy: '        for j in range(n - i):' }],
        },
        {
          difficulty: 'medium',
          buggy_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
          diff_json: [{ line: 3, original: '    for i in range(n - 1):', buggy: '    for i in range(n):' }],
        },
        {
          difficulty: 'hard',
          buggy_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if arr[j] >= arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
          diff_json: [{ line: 5, original: '            if arr[j] > arr[j + 1]:', buggy: '            if arr[j] >= arr[j + 1]:' }],
        },
      ],
      test_cases: [
        { input: '[5,3,8,1,9]',     expected_output: '[1, 3, 5, 8, 9]', is_hidden: false },
        { input: '[1,2,3]',         expected_output: '[1, 2, 3]',       is_hidden: false },
        { input: '[9,8,7,6,5,4]',   expected_output: '[4, 5, 6, 7, 8, 9]', is_hidden: true },
        { input: '[42]',            expected_output: '[42]',             is_hidden: true },
      ],
    },
  ];

  for (const q of dbmsDebug) {
    const { data, error } = await sb.from('question_bank').insert({
      created_by: adminId, type: 'debugging', statement: q.statement,
      topic_tag: q.topic_tag, difficulty: q.difficulty, marks: q.marks,
      language: q.language, correct_code: q.correct_code, bug_count: q.bug_count,
    }).select('id').single();
    if (error) { warn(`Debug ${q.key}`, error.message); continue; }
    qIds[q.key] = data.id;

    for (const v of q.variants) {
      await sb.from('debug_variants').insert({
        question_id: data.id, generated_by: 'manual',
        buggy_code: v.buggy_code, diff_json: v.diff_json,
        difficulty: v.difficulty, is_approved: true,
        approved_at: new Date().toISOString(),
      });
    }

    for (const tc of q.test_cases) {
      await sb.from('test_cases').insert({ question_id: data.id, ...tc });
    }
    log(`DBMS Debug: ${q.key}`);
  }

  // ── OS MCQ ────────────────────────────────────────────────────────────────
  const osMcq = [
    {
      key: 'os_scheduling', type: 'mcq_single', difficulty: 'easy', marks: 2,
      statement: 'Which CPU scheduling algorithm can lead to convoy effect?',
      topic_tag: 'Scheduling',
      options: [
        { text: 'Shortest Job First (SJF)', correct: false },
        { text: 'First Come First Serve (FCFS)', correct: true },
        { text: 'Round Robin', correct: false },
        { text: 'Priority Scheduling', correct: false },
      ],
    },
    {
      key: 'os_deadlock', type: 'mcq_multi', difficulty: 'medium', marks: 3,
      statement: 'Which of the following are necessary conditions for deadlock? (Select all that apply)',
      topic_tag: 'Deadlock',
      options: [
        { text: 'Mutual Exclusion', correct: true },
        { text: 'Hold and Wait', correct: true },
        { text: 'No Preemption', correct: true },
        { text: 'Circular Wait', correct: true },
      ],
    },
    {
      key: 'os_paging', type: 'mcq_single', difficulty: 'medium', marks: 2,
      statement: 'In paging, what does the page table store?',
      topic_tag: 'Memory Management',
      options: [
        { text: 'Physical address to virtual address mapping', correct: false },
        { text: 'Virtual page number to physical frame number mapping', correct: true },
        { text: 'Segment size and base address', correct: false },
        { text: 'Page fault count per process', correct: false },
      ],
    },
    {
      key: 'os_semaphore', type: 'mcq_single', difficulty: 'medium', marks: 2,
      statement: 'A counting semaphore initialized to 3 allows at most how many processes simultaneously in the critical section?',
      topic_tag: 'Synchronization',
      options: [
        { text: '1', correct: false },
        { text: '2', correct: false },
        { text: '3', correct: true },
        { text: 'Unlimited', correct: false },
      ],
    },
    {
      key: 'os_lru', type: 'mcq_single', difficulty: 'hard', marks: 3,
      statement: 'Given the reference string 1,2,3,4,1,2,5,1,2,3,4,5 and 3 frames, how many page faults occur with LRU replacement?',
      topic_tag: 'Memory Management',
      options: [
        { text: '6', correct: false },
        { text: '8', correct: true },
        { text: '10', correct: false },
        { text: '12', correct: false },
      ],
    },
    {
      key: 'os_fork', type: 'mcq_single', difficulty: 'easy', marks: 2,
      statement: 'After a successful fork() system call, which of the following is TRUE?',
      topic_tag: 'Process Management',
      options: [
        { text: 'Child process gets a copy of parent\'s address space', correct: true },
        { text: 'Parent process terminates immediately', correct: false },
        { text: 'Both processes share the same PID', correct: false },
        { text: 'Child process starts executing from main()', correct: false },
      ],
    },
  ];

  const osAdminId = adminId; // will be overridden in seedQuestions call
  for (const q of osMcq) {
    const { data, error } = await sb.from('question_bank').insert({
      created_by: adminId, type: q.type, statement: q.statement,
      topic_tag: q.topic_tag, difficulty: q.difficulty, marks: q.marks,
    }).select('id').single();
    if (error) { warn(`OS MCQ ${q.key}`, error.message); continue; }
    qIds[q.key] = data.id;
    const opts = q.options.map((o, i) => ({
      question_id: data.id, option_text: o.text,
      is_correct: o.correct, display_order: i + 1,
    }));
    await sb.from('mcq_options').insert(opts);
    log(`OS MCQ: ${q.key}`);
  }

  // ── OS Debugging ──────────────────────────────────────────────────────────
  const osDebug = {
    key: 'os_producer',
    statement: 'Fix the producer-consumer buffer implementation. The bug causes the buffer pointer to go out of bounds.',
    topic_tag: 'Synchronization', difficulty: 'hard', marks: 12, language: 'python',
    bug_count: 1,
    correct_code: `BUFFER_SIZE = 5
buffer = []

def producer(item):
    if len(buffer) < BUFFER_SIZE:
        buffer.append(item)
        return True
    return False

def consumer():
    if len(buffer) > 0:
        return buffer.pop(0)
    return None`,
    variants: [
      {
        difficulty: 'medium',
        buggy_code: `BUFFER_SIZE = 5
buffer = []

def producer(item):
    if len(buffer) <= BUFFER_SIZE:
        buffer.append(item)
        return True
    return False

def consumer():
    if len(buffer) > 0:
        return buffer.pop(0)
    return None`,
        diff_json: [{ line: 5, original: '    if len(buffer) < BUFFER_SIZE:', buggy: '    if len(buffer) <= BUFFER_SIZE:' }],
      },
      {
        difficulty: 'hard',
        buggy_code: `BUFFER_SIZE = 5
buffer = []

def producer(item):
    if len(buffer) < BUFFER_SIZE:
        buffer.append(item)
        return True
    return False

def consumer():
    if len(buffer) > 0:
        return buffer.pop()
    return None`,
        diff_json: [{ line: 12, original: '        return buffer.pop(0)', buggy: '        return buffer.pop()' }],
      },
    ],
    test_cases: [
      { input: 'producer\nA',       expected_output: 'True',  is_hidden: false },
      { input: 'consumer_empty',    expected_output: 'None',  is_hidden: false },
      { input: 'overfill',          expected_output: 'False', is_hidden: true  },
    ],
  };

  const { data: odData, error: odErr } = await sb.from('question_bank').insert({
    created_by: adminId, type: 'debugging', statement: osDebug.statement,
    topic_tag: osDebug.topic_tag, difficulty: osDebug.difficulty, marks: osDebug.marks,
    language: osDebug.language, correct_code: osDebug.correct_code, bug_count: osDebug.bug_count,
  }).select('id').single();
  if (!odErr) {
    qIds[osDebug.key] = odData.id;
    for (const v of osDebug.variants) {
      await sb.from('debug_variants').insert({
        question_id: odData.id, generated_by: 'manual',
        buggy_code: v.buggy_code, diff_json: v.diff_json,
        difficulty: v.difficulty, is_approved: true,
        approved_at: new Date().toISOString(),
      });
    }
    for (const tc of osDebug.test_cases) {
      await sb.from('test_cases').insert({ question_id: odData.id, ...tc });
    }
    log('OS Debug: os_producer');
  } else {
    warn('OS Debug', odErr.message);
  }

  return qIds;
}

// ─── TESTS ─────────────────────────────────────────────────────────────────────
async function seedTests(userIds, qIds) {
  console.log('\n📝 Seeding tests...\n');

  const sharmaId   = userIds['sharma@testforge.dev'];
  const kulkarniId = userIds['kulkarni@testforge.dev'];

  const tests = [
    {
      key: 'dbms_midsem',
      title: 'DBMS Mid-Semester Examination',
      subject: 'DBMS', year: 'SE', division: null,  // both A & B see it
      duration_mins: 60,
      start_time: daysAgo(10),
      end_time:   daysAgo(9),
      status: 'ended',
      total_marks: 35,
      questions_per_attempt: 10,
      randomize_questions: true,
      created_by: sharmaId,
      // 8 MCQ (2 marks each = 16) + 1 debug (10 marks) + 1 debug (8 marks) = should be 34 but we set 35
      questions: [
        // MCQ - all 8 with various unlock times
        { id: qIds['dbms_2nf'],      order: 1, unlock_at: 0  },
        { id: qIds['dbms_having'],   order: 2, unlock_at: 0  },
        { id: qIds['dbms_acid'],     order: 3, unlock_at: 0  },
        { id: qIds['dbms_bplus'],    order: 4, unlock_at: 0  },
        { id: qIds['dbms_pk'],       order: 5, unlock_at: 0  },
        { id: qIds['dbms_leftjoin'], order: 6, unlock_at: 0  },
        { id: qIds['dbms_weakent'],  order: 7, unlock_at: 0  },
        { id: qIds['dbms_3nf'],      order: 8, unlock_at: 0  },
        // Debugging - unlock after 15 mins
        { id: qIds['dbms_bsearch'],  order: 9,  unlock_at: 15 },
        { id: qIds['dbms_bubble'],   order: 10, unlock_at: 25 },
      ],
    },
    {
      key: 'os_unittest',
      title: 'OS Unit Test — Scheduling & Memory',
      subject: 'OS', year: 'TE', division: 'A',
      duration_mins: 45,
      start_time: minsAgo(20),
      end_time:   minsFrom(25),
      status: 'active',
      total_marks: 25,
      questions_per_attempt: 7,
      randomize_questions: false,
      created_by: kulkarniId,
      questions: [
        { id: qIds['os_scheduling'], order: 1, unlock_at: 0  },
        { id: qIds['os_deadlock'],   order: 2, unlock_at: 0  },
        { id: qIds['os_paging'],     order: 3, unlock_at: 0  },
        { id: qIds['os_semaphore'],  order: 4, unlock_at: 0  },
        { id: qIds['os_lru'],        order: 5, unlock_at: 0  },
        { id: qIds['os_fork'],       order: 6, unlock_at: 0  },
        { id: qIds['os_producer'],   order: 7, unlock_at: 20 },
      ],
    },
    {
      key: 'dbms_viva',
      title: 'DBMS Viva Preparation Quiz',
      subject: 'DBMS', year: 'SE', division: 'A',
      duration_mins: 30,
      start_time: daysFrom(3),
      end_time:   daysFrom(4),
      status: 'active',   // active but future start_time = upcoming
      total_marks: 20,
      questions_per_attempt: 6,
      randomize_questions: true,
      created_by: sharmaId,
      questions: [
        { id: qIds['dbms_acid'],     order: 1, unlock_at: 0  },
        { id: qIds['dbms_bplus'],    order: 2, unlock_at: 0  },
        { id: qIds['dbms_pk'],       order: 3, unlock_at: 0  },
        { id: qIds['dbms_weakent'],  order: 4, unlock_at: 0  },
        { id: qIds['dbms_3nf'],      order: 5, unlock_at: 0  },
        { id: qIds['dbms_bsearch'],  order: 6, unlock_at: 10 },
      ],
    },
  ];

  const testIds = {};
  for (const t of tests) {
    const { data, error } = await sb.from('tests').insert({
      created_by: t.created_by,
      title: t.title, subject: t.subject,
      year: t.year, division: t.division,
      duration_mins: t.duration_mins,
      start_time: t.start_time, end_time: t.end_time,
      status: t.status,
      total_marks: t.total_marks,
      questions_per_attempt: t.questions_per_attempt,
      randomize_questions: t.randomize_questions,
    }).select('id').single();

    if (error) { warn(`Test ${t.key}`, error.message); continue; }
    testIds[t.key] = data.id;

    for (const q of t.questions) {
      if (!q.id) { warn(`Missing question id in test ${t.key}`); continue; }
      await sb.from('test_questions').insert({
        test_id: data.id, question_id: q.id,
        question_order: q.order, unlock_at_minutes: q.unlock_at ?? 0,
      });
    }
    log(`Test: ${t.title}`);
  }

  return testIds;
}

// ─── MCQ RESPONSE BUILDER ──────────────────────────────────────────────────────
// Fetches option IDs for a question, returns correct or wrong ones based on profile
async function getMcqOptionIds(questionId, accuracy) {
  const { data: opts } = await sb.from('mcq_options')
    .select('id, is_correct')
    .eq('question_id', questionId);
  if (!opts?.length) return { correct: null, optionIds: [], isCorrect: false };

  const correctOpts = opts.filter(o => o.is_correct);
  const wrongOpts   = opts.filter(o => !o.is_correct);

  // accuracy 0.0–1.0 chance of answering correctly
  const answersCorrectly = Math.random() < accuracy;

  if (answersCorrectly) {
    return { optionIds: correctOpts.map(o => o.id), isCorrect: true };
  } else {
    // pick 1-2 wrong options
    const picked = sample(wrongOpts, Math.min(correctOpts.length, wrongOpts.length));
    return { optionIds: picked.map(o => o.id), isCorrect: false };
  }
}

// ─── BEHAVIORAL META CREATOR (only for debugging questions) ───────────────────
function makeBehavioralMeta(profile) {
  // profiles: 'legit', 'suspicious', 'cheater', 'lazy'
  const now = new Date();

  if (profile === 'cheater') {
    return {
      time_to_first_keystroke: rand(800, 2500),   // sub-3s: HIGH flag
      wpm_consistency: rand(130, 180),             // >120: flagged
      backspace_count: rand(0, 1),                 // nearly zero: HIGH flag (no corrections at high WPM)
      edit_count: rand(1, 3),
      paste_events: rand(1, 3),                    // paste: HIGH flag
      test_runs_before_submit: 0,                  // no testing: medium flag
      idle_periods: [],
    };
  }

  if (profile === 'suspicious') {
    return {
      time_to_first_keystroke: rand(3000, 7500),   // 3–8s: MEDIUM flag
      wpm_consistency: rand(85, 115),
      backspace_count: rand(3, 12),
      edit_count: rand(4, 10),
      paste_events: rand(0, 1),
      test_runs_before_submit: rand(1, 2),
      idle_periods: rand(0, 1) > 0 ? [{
        start: new Date(now.getTime() - rand(5, 15) * 60_000).toISOString(),
        duration_seconds: rand(200, 600),          // >180s: medium flag
      }] : [],
    };
  }

  if (profile === 'lazy') {
    // Took a long time, barely typed, submitted without testing
    return {
      time_to_first_keystroke: rand(120_000, 400_000),
      wpm_consistency: rand(15, 35),
      backspace_count: rand(20, 60),
      edit_count: rand(5, 15),
      paste_events: 0,
      test_runs_before_submit: rand(0, 1),
      idle_periods: [{
        start: new Date(now.getTime() - rand(15, 30) * 60_000).toISOString(),
        duration_seconds: rand(600, 1200),
      }],
    };
  }

  // legit — normal human behaviour
  return {
    time_to_first_keystroke: rand(8000, 60_000),
    wpm_consistency: rand(35, 75),
    backspace_count: rand(15, 80),
    edit_count: rand(8, 30),
    paste_events: 0,
    test_runs_before_submit: rand(2, 6),
    idle_periods: [],
  };
}

// ─── ATTEMPTS + RESPONSES + RESULTS ───────────────────────────────────────────
async function seedAttempts(userIds, qIds, testIds) {
  console.log('\n🎯 Seeding attempts, responses and results...\n');

  const sharmaId  = userIds['sharma@testforge.dev'];
  const testId     = testIds['dbms_midsem'];

  // Questions in the test (ordered)
  const mcqKeys = [
    'dbms_2nf', 'dbms_having', 'dbms_acid', 'dbms_bplus',
    'dbms_pk', 'dbms_leftjoin', 'dbms_weakent', 'dbms_3nf',
  ];
  const debugKeys = ['dbms_bsearch', 'dbms_bubble'];

  // Student profiles for this test (SE-A + SE-B students)
  const studentProfiles = [
    // SE-A — mix of legit, suspicious, cheater
    { email: 'arjun@testforge.dev',   mcqAcc: 0.90, debugProfile: 'cheater',    tabSwitches: 2, focusLost: 3,  debugScore: 16 },
    { email: 'priya@testforge.dev',   mcqAcc: 0.85, debugProfile: 'legit',      tabSwitches: 0, focusLost: 1,  debugScore: 15 },
    { email: 'rohan@testforge.dev',   mcqAcc: 0.90, debugProfile: 'cheater',    tabSwitches: 1, focusLost: 2,  debugScore: 16 }, // same debug as arjun → similarity flag
    { email: 'sneha@testforge.dev',   mcqAcc: 0.70, debugProfile: 'legit',      tabSwitches: 0, focusLost: 0,  debugScore: 10 },
    { email: 'vikram@testforge.dev',  mcqAcc: 0.50, debugProfile: 'lazy',       tabSwitches: 5, focusLost: 8,  debugScore: 5  },
    // SE-B
    { email: 'ananya@testforge.dev',  mcqAcc: 0.80, debugProfile: 'legit',      tabSwitches: 0, focusLost: 0,  debugScore: 14 },
    { email: 'karan@testforge.dev',   mcqAcc: 0.75, debugProfile: 'suspicious', tabSwitches: 3, focusLost: 4,  debugScore: 9  },
    { email: 'meera@testforge.dev',   mcqAcc: 0.90, debugProfile: 'legit',      tabSwitches: 0, focusLost: 1,  debugScore: 15 },
    { email: 'tanvir@testforge.dev',  mcqAcc: 0.60, debugProfile: 'suspicious', tabSwitches: 2, focusLost: 3,  debugScore: 7  },
    { email: 'divya@testforge.dev',   mcqAcc: 0.45, debugProfile: 'lazy',       tabSwitches: 0, focusLost: 0,  debugScore: 3  },
  ];

  // Store attempt IDs for arjun & rohan to create similarity flags later
  let arjunAttemptId = null;
  let rohanAttemptId = null;
  // Store variant assignment for bsearch → both get same variant for similarity flag
  let sharedVariantId = null;

  // Fetch approved variants for both debug questions
  const variantsByQ = {};
  for (const dkey of debugKeys) {
    const { data: variants } = await sb.from('debug_variants')
      .select('id, difficulty')
      .eq('question_id', qIds[dkey])
      .eq('is_approved', true);
    variantsByQ[dkey] = variants ?? [];
  }

  for (const profile of studentProfiles) {
    const userId = userIds[profile.email];
    if (!userId) { warn(`No user ID for ${profile.email}`); continue; }

    const startedAt   = new Date(Date.now() - 9.5 * 86400_000 + rand(0, 30) * 60_000);
    const submittedAt = new Date(startedAt.getTime() + rand(40, 58) * 60_000);

    // Create attempt
    const { data: attempt, error: aErr } = await sb.from('attempts').insert({
      user_id:          userId,
      test_id:          testId,
      status:           'submitted',
      started_at:       startedAt.toISOString(),
      submitted_at:     submittedAt.toISOString(),
      last_active_at:   submittedAt.toISOString(),
      tab_switches:     profile.tabSwitches,
      focus_lost_count: profile.focusLost,
      session_token:    `seed-${profile.email}`,
    }).select('id').single();

    if (aErr) { warn(`Attempt ${profile.email}`, aErr.message); continue; }
    const attemptId = attempt.id;

    if (profile.email === 'arjun@testforge.dev') arjunAttemptId = attemptId;
    if (profile.email === 'rohan@testforge.dev') rohanAttemptId = attemptId;

    // ── MCQ Responses ──────────────────────────────────────────────────────
    let totalScore = 0;
    let totalMarks = 0;

    for (const key of mcqKeys) {
      const qId = qIds[key];
      const { optionIds, isCorrect } = await getMcqOptionIds(qId, profile.mcqAcc);

      // Get marks for this question
      const { data: qData } = await sb.from('question_bank').select('marks').eq('id', qId).single();
      const marks = qData?.marks ?? 2;
      totalMarks += marks;

      const marksAwarded = isCorrect ? marks : 0;
      totalScore += marksAwarded;

      const timeSpent = rand(30, 180); // 30s–3min per MCQ

      // Insert option_shuffle (simulate what server does on attempt start)
      const { data: allOpts } = await sb.from('mcq_options').select('id').eq('question_id', qId);
      if (allOpts?.length) {
        const shuffledOrder = shuffle(allOpts.map(o => o.id));
        const { error: soErr } = await sb.from('option_shuffle').insert({
          attempt_id: attemptId, question_id: qId, shuffled_order: shuffledOrder
        });
        if (soErr) warn('option_shuffle', soErr.message);
      }

      await sb.from('responses').insert({
        attempt_id:          attemptId,
        question_id:         qId,
        selected_option_ids: optionIds,
        is_correct:          isCorrect,
        marks_awarded:       marksAwarded,
        time_spent_seconds:  timeSpent,
        behavioral_meta:     null,  // NO behavioral meta on MCQ
      });
    }

    // ── Debugging Responses ────────────────────────────────────────────────
    const bsMeta       = makeBehavioralMeta(profile.debugProfile);
    const bubbleMeta   = makeBehavioralMeta(profile.debugProfile === 'cheater' ? 'suspicious' : profile.debugProfile);

    // Pick variants
    for (let di = 0; di < debugKeys.length; di++) {
      const dkey     = debugKeys[di];
      const qId      = qIds[dkey];
      const variants = variantsByQ[dkey];
      const meta     = di === 0 ? bsMeta : bubbleMeta;

      let variantId = null;

      // For arjun/rohan bsearch: force same variant (easiest one) for similarity flag
      if (dkey === 'dbms_bsearch' && (profile.email === 'arjun@testforge.dev' || profile.email === 'rohan@testforge.dev')) {
        const easyVariant = variants.find(v => v.difficulty === 'easy') ?? variants[0];
        variantId = easyVariant?.id ?? null;
        if (!sharedVariantId) sharedVariantId = variantId;
      } else {
        variantId = pick(variants)?.id ?? null;
      }

      if (variantId) {
        const { error: vaErr } = await sb.from('variant_assignments').insert({
          attempt_id: attemptId, question_id: qId, variant_id: variantId,
        });
        if (vaErr) warn('variant_assignment', vaErr.message);
      }

      const { data: qData } = await sb.from('question_bank').select('marks, correct_code').eq('id', qId).single();
      const marks = qData?.marks ?? 10;
      totalMarks += marks;

      // Distribute debug score across 2 debug questions
      const debugMarksForThis = di === 0
        ? Math.round(profile.debugScore * 0.6)
        : Math.round(profile.debugScore * 0.4);

      totalScore += debugMarksForThis;

      const isCorrectDebug = debugMarksForThis >= marks * 0.5;
      const casesPassed    = Math.round((debugMarksForThis / marks) * 2);

      // Create a plausible submitted code (slightly mutated correct code)
      const submittedCode = qData?.correct_code ?? '# solution here';

      await sb.from('responses').insert({
        attempt_id:          attemptId,
        question_id:         qId,
        submitted_code:      submittedCode,
        language:            'python',
        is_correct:          isCorrectDebug,
        marks_awarded:       debugMarksForThis,
        visible_cases_passed: Math.min(casesPassed, 2),
        visible_cases_total:  2,
        hidden_cases_passed:  Math.min(casesPassed > 1 ? 1 : 0, 2),
        hidden_cases_total:   2,
        time_spent_seconds:  rand(300, 1800), // 5–30 min on debugging
        behavioral_meta:     meta,            // ONLY debugging gets behavioral meta
      });
    }

    // ── Integrity score (tab_switches × 5 + focus × 2 subtracted from 100)
    const integrityScore = Math.max(0,
      100
      - (profile.tabSwitches * 5)
      - (profile.focusLost * 2)
      - (profile.debugProfile === 'cheater' ? 15 : 0)  // flagged for paste
    );

    // ── Result ─────────────────────────────────────────────────────────────
    const percentage  = Math.round((totalScore / totalMarks) * 1000) / 10;
    const { error: rErr } = await sb.from('results').insert({
      attempt_id:     attemptId,
      total_score:    totalScore,
      total_marks:    totalMarks,
      percentage:     percentage,
      integrity_score: integrityScore,
      pass_fail_overall: percentage >= 40,
    });
    if (rErr) warn(`Result ${profile.email}`, rErr.message);

    log(`Attempt seeded: ${profile.email} — ${totalScore}/${totalMarks} (${percentage}%) integrity ${integrityScore}`);
  }

  // ── Compute ranks ──────────────────────────────────────────────────────────
  log('Computing ranks...');
  const { data: results } = await sb.from('results')
    .select('id, attempt_id, total_score, attempts!inner(test_id)')
    .eq('attempts.test_id', testId)
    .order('total_score', { ascending: false });

  for (let i = 0; i < (results ?? []).length; i++) {
    await sb.from('results').update({ rank: i + 1 }).eq('id', results[i].id);
  }

  // ── Similarity flag: Arjun ↔ Rohan ─────────────────────────────────────────
  if (arjunAttemptId && rohanAttemptId && sharedVariantId && qIds['dbms_bsearch']) {
    await sb.from('similarity_flags').insert({
      test_id:          testId,
      attempt_id_1:     arjunAttemptId,
      attempt_id_2:     rohanAttemptId,
      question_id:      qIds['dbms_bsearch'],
      similarity_score: 0.94,
      flagged_at:       new Date().toISOString(),
      reviewed:         false,
      admin_verdict:    'pending',
    });
    log('Similarity flag: arjun ↔ rohan (0.94)');
  }

  // ── In-progress attempts for OS test (TE-A students) ──────────────────────────
  const osTestId = testIds['os_unittest'];
  if (osTestId) {
    for (const email of ['aditya@testforge.dev', 'riya@testforge.dev']) {
      const userId = userIds[email];
      if (!userId) continue;
      const { error: osAErr } = await sb.from('attempts').insert({
        user_id:            userId,
        test_id:            osTestId,
        status:             'in_progress',
        started_at:         minsAgo(rand(5, 18)),
        last_active_at:     new Date().toISOString(),
        tab_switches:       rand(0, 2),
        focus_lost_count:   rand(0, 3),
        session_token:      `seed-os-${email}`,
      });
      if (osAErr) warn(`OS attempt ${email}`, osAErr.message);
      else log(`OS in-progress attempt: ${email}`);
    }
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 TestForge Fresh Seed Script v2\n' + '='.repeat(50));

  await nuke();
  const userIds = await seedUsers();
  const qIds    = await seedQuestions(userIds['sharma@testforge.dev']);
  const testIds = await seedTests(userIds, qIds);
  await seedAttempts(userIds, qIds, testIds);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Seed complete!\n');
  console.log('📋 Login credentials (all users):');
  console.log('   Password:', 'TestForge@123');
  console.log('   Admin:   sharma@testforge.dev / kulkarni@testforge.dev');
  console.log('   Students: arjun, priya, rohan, sneha, vikram, ananya,');
  console.log('             karan, meera, tanvir, divya @testforge.dev');
  console.log('   Master:  krishna@gmail.com / 12345678');
  console.log('='.repeat(50));
}

main().catch(e => { console.error('\n💥 Fatal:', e); process.exit(1); });
