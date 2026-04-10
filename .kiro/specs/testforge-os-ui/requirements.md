# Requirements Document

## Introduction

TestForge OS UI is a full frontend redesign of the TestForge academic testing platform. The redesign replaces the current sidebar/page-navigation model with a macOS-style desktop operating system running entirely in the browser. All existing backend APIs (Express + Supabase) remain unchanged. Users interact with the platform through windowed applications that open, close, minimize, and resize inside a persistent desktop shell. The OS shell is always visible; navigation happens by launching apps from a dock, not by changing routes.

The redesign covers: the OS boot/login screen, the desktop environment, the window manager, the dock, the menu bar, all student-facing apps (Tests, Test Session, Results, Analytics), all admin-facing apps (Question Bank, Test Manager, Integrity, Analytics), the debugging question code editor + terminal layout, responsive adaptations for tablet and mobile, and all motion/animation behavior.

---

## Glossary

- **OS_Shell**: The persistent browser-rendered desktop environment that hosts all apps as windows.
- **Window_Manager**: The subsystem responsible for creating, positioning, resizing, minimizing, maximizing, and closing app windows.
- **Dock**: The bottom bar containing app launcher icons with macOS-style hover magnification.
- **Menu_Bar**: The top bar showing the active app name, system clock, user avatar, and theme toggle.
- **App_Window**: A draggable, resizable, minimizable, maximizable container that hosts a single app's UI.
- **Lock_Screen**: The initial overlay shown before authentication; styled as a macOS login card.
- **Desktop**: The wallpaper layer behind all windows, visible when no windows are maximized.
- **Student_App**: An App_Window accessible only to users with the student role.
- **Admin_App**: An App_Window accessible only to users with the admin or super_admin role.
- **Tests_App**: The Student_App that lists available and upcoming tests.
- **Test_Session_App**: The Student_App that hosts an active test attempt (MCQ or debugging questions).
- **Results_App**: The Student_App that shows post-test score breakdown.
- **Analytics_App**: The app (student and admin variants) that shows charts and performance statistics.
- **Question_Bank_App**: The Admin_App for managing MCQ and debugging questions.
- **Test_Manager_App**: The Admin_App for creating, editing, and scheduling tests.
- **Integrity_App**: The Admin_App showing per-test behavioral and similarity integrity data.
- **Code_Editor**: The Monaco Editor instance inside Test_Session_App used for debugging questions.
- **Terminal_Panel**: The dark-themed output panel below the Code_Editor showing run results and stderr.
- **Buggy_Code_Panel**: The read-only, collapsible panel above the Code_Editor showing the assigned buggy variant.
- **Glassmorphism**: The visual style using frosted-glass backgrounds (`backdrop-filter: blur`), semi-transparent fills, and subtle borders.
- **Theme**: The active color scheme — either `dark` (default) or `light`, toggled by the user.
- **Framer_Motion**: The animation library used for window lifecycle and dock animations.
- **Lenis**: The smooth-scroll library used for scrollable content inside App_Windows.
- **Proctored_Start_Screen**: The pre-test checklist screen shown before a new attempt is created, requiring explicit student confirmation.
- **Integrity_Violation**: The condition where `tab_switch` count reaches 3, triggering immediate auto-submission with `auto_submit_reason = 'integrity_violation'` and a server-side score override to 0.

---

## Requirements

### Requirement 1: OS Shell — Desktop Environment

**User Story:** As a logged-in user, I want to see a persistent desktop environment so that I can launch and manage apps without traditional page navigation.

#### Acceptance Criteria

1. THE OS_Shell SHALL render a full-viewport desktop with a wallpaper background (gradient or subtle pattern) visible behind all App_Windows.
2. THE OS_Shell SHALL display the Menu_Bar at the top edge and the Dock at the bottom edge at all times while a user is authenticated.
3. WHEN the user is not authenticated, THE OS_Shell SHALL display the Lock_Screen overlay instead of the desktop.
4. THE OS_Shell SHALL apply the active Theme's CSS custom properties (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent`, `--glass-bg`, `--glass-border`) to all child surfaces.
5. WHEN the Theme changes, THE OS_Shell SHALL transition all color surfaces within 400ms using CSS transitions on `background-color`, `border-color`, and `color`.
6. THE OS_Shell SHALL support simultaneous display of multiple open App_Windows without layout conflicts.
7. THE OS_Shell SHALL prevent the browser's default scroll behavior on the desktop layer; scrolling is handled per-window by Lenis.

---

### Requirement 2: Lock Screen

**User Story:** As a visitor or logged-out user, I want to see a macOS-style login screen so that I can authenticate before accessing the desktop.

#### Acceptance Criteria

1. WHEN the user is unauthenticated, THE Lock_Screen SHALL render a centered frosted-glass card over a blurred, darkened wallpaper background.
2. THE Lock_Screen SHALL display a circular avatar placeholder, a name/email input field, and a password input field inside the card.
3. WHEN the user submits valid credentials, THE Lock_Screen SHALL call the existing `/auth/login` API and, on success, dismiss with a smooth fade-out transition revealing the desktop.
4. IF the login API returns an error, THEN THE Lock_Screen SHALL display the error message inline below the password field without navigating away.
5. THE Lock_Screen SHALL NOT be a separate route; it SHALL be an overlay rendered within the OS_Shell at the root route (`/`).
6. WHEN the user logs out from the Menu_Bar, THE OS_Shell SHALL close all open App_Windows and re-display the Lock_Screen overlay.

---

### Requirement 3: Register Page

**User Story:** As a new user, I want a clean registration form so that I can create an account before accessing the OS.

#### Acceptance Criteria

1. THE Register page SHALL be accessible at the `/register` route and SHALL NOT use the OS_Shell or desktop chrome.
2. THE Register page SHALL display a minimal form containing: full name, email, password, and a role selector (student / admin).
3. WHEN the user selects the `student` role, THE Register page SHALL reveal additional fields: year selector, division selector, and subject field.
4. WHEN the user selects the `admin` role, THE Register page SHALL reveal a subject field only.
5. WHEN the user submits the form with valid data, THE Register page SHALL call the existing registration API and redirect to the root route (`/`) on success.
6. IF the registration API returns a validation error, THEN THE Register page SHALL display field-level error messages adjacent to the relevant inputs.

---

### Requirement 4: Window Manager

**User Story:** As a user, I want app windows that behave like real OS windows so that I can multitask and arrange my workspace freely.

#### Acceptance Criteria

1. THE Window_Manager SHALL render each App_Window as an independently positioned, layered surface using absolute positioning within the OS_Shell.
2. THE Window_Manager SHALL support dragging App_Windows by their title bar to any position within the viewport bounds.
3. THE Window_Manager SHALL support resizing App_Windows from any edge or corner, with a minimum size of 320×240px per window.
4. WHEN the user clicks an App_Window, THE Window_Manager SHALL bring that window to the front by assigning it the highest z-index among open windows.
5. WHEN the user clicks the minimize control on an App_Window, THE Window_Manager SHALL animate the window scaling down to the Dock using Framer_Motion and hide the window content.
6. WHEN the user clicks a minimized app's Dock icon, THE Window_Manager SHALL animate the App_Window scaling back up from the Dock to its previous position and size.
7. WHEN the user clicks the maximize control on an App_Window, THE Window_Manager SHALL expand the window to fill the area between the Menu_Bar and the Dock, storing the previous size and position for restore.
8. WHEN the user clicks the maximize control on a maximized App_Window, THE Window_Manager SHALL restore the window to its stored size and position.
9. WHEN the user clicks the close control on an App_Window, THE Window_Manager SHALL animate the window scaling to zero and remove it from the DOM using Framer_Motion.
10. WHEN a new App_Window opens, THE Window_Manager SHALL animate it scaling from zero to full size using Framer_Motion with a spring easing.
11. THE Window_Manager SHALL use `react-rnd` (already installed) as the drag-and-resize primitive for App_Windows.
12. THE Window_Manager SHALL render App_Window chrome (title bar, traffic-light controls, resize handles) using Glassmorphism styling.

---

### Requirement 5: Dock

**User Story:** As a user, I want a macOS-style dock so that I can launch and switch between apps quickly.

#### Acceptance Criteria

1. THE Dock SHALL render at the bottom center of the desktop as a horizontal row of app icons inside a Glassmorphism pill container.
2. THE Dock SHALL display only the apps available to the authenticated user's role: student apps for students, admin apps for admins.
3. WHEN the user hovers over a Dock icon, THE Dock SHALL magnify that icon and its immediate neighbors using a smooth scale transform driven by Framer_Motion, matching macOS dock magnification behavior.
4. WHEN the user clicks a Dock icon for a closed app, THE Dock SHALL open a new App_Window for that app.
5. WHEN the user clicks a Dock icon for an already-open app, THE Dock SHALL bring that App_Window to the front.
6. WHEN an app is open, THE Dock SHALL display a small indicator dot below that app's icon.
7. WHEN an App_Window is minimized, THE Dock SHALL display the minimized app's icon with a distinct visual state (e.g., reduced opacity or a different indicator).
8. THE Dock SHALL display app icons with labels visible on hover via a tooltip above the icon.

---

### Requirement 6: Menu Bar

**User Story:** As a user, I want a persistent menu bar so that I can see context about the active app, check the time, and access system controls.

#### Acceptance Criteria

1. THE Menu_Bar SHALL render at the top edge of the OS_Shell as a full-width bar with Glassmorphism styling.
2. THE Menu_Bar SHALL display the name of the currently focused App_Window on the left side; if no window is focused, it SHALL display "TestForge".
3. THE Menu_Bar SHALL display a live system clock (HH:MM format, updated every minute) on the right side.
4. THE Menu_Bar SHALL display the authenticated user's avatar placeholder and name on the right side.
5. THE Menu_Bar SHALL include a theme toggle control that switches between dark and light themes.
6. WHEN the user clicks the theme toggle, THE OS_Shell SHALL update the `data-theme` attribute on the root element, triggering the 400ms CSS transition across all surfaces.
7. WHEN the user clicks the user avatar or name in the Menu_Bar, THE Menu_Bar SHALL display a small dropdown with a "Sign Out" option.
8. WHEN the user selects "Sign Out", THE OS_Shell SHALL call the existing sign-out logic, close all App_Windows, and display the Lock_Screen.

---

### Requirement 7: Tests App (Student)

**User Story:** As a student, I want a Tests app so that I can browse available and upcoming tests and start an attempt.

#### Acceptance Criteria

1. THE Tests_App SHALL display a list of tests available to the authenticated student, fetched from the existing tests API.
2. THE Tests_App SHALL show for each test: title, subject, duration, question count, and time remaining until start or time remaining until end.
3. WHEN a test's `start_time` is in the future, THE Tests_App SHALL display the test as "Upcoming" and disable the start action.
4. WHEN a test is active (within its `start_time`–`end_time` window) and the student has no existing attempt, THE Tests_App SHALL display a "Start" button.
4a. WHEN a test is active and the student has an existing attempt with status `in_progress`, THE Tests_App SHALL display a "Resume" button instead of "Start".
5. WHEN the user clicks "Start" on an active test, THE Tests_App SHALL open the Test_Session_App in a new App_Window, passing the test ID; the attempt will be created after the student confirms the proctored start screen (R8.13).
5a. WHEN the user clicks "Resume" on an active test, THE Tests_App SHALL open the Test_Session_App in a new App_Window passing the existing attempt ID, bypassing the proctored start screen and going directly to the question view.
6. WHEN a test's `end_time` has passed, THE Tests_App SHALL display the test as "Ended" and disable the start action.
7. THE Tests_App SHALL refresh the test list every 60 seconds while the window is open to reflect status changes.

---

### Requirement 8: Test Session App (Student)

**User Story:** As a student, I want a Test Session app so that I can answer MCQ and debugging questions within a timed, proctored environment.

#### Acceptance Criteria

1. THE Test_Session_App SHALL load the attempt data and question list from the existing attempts API on open. WHEN the attempt already exists with status `in_progress`, THE Test_Session_App SHALL resume it using the existing attempt ID rather than creating a new attempt.
2. THE Test_Session_App SHALL display a countdown timer in the window title bar area, colored green above 10 minutes, yellow between 5–10 minutes, and red below 5 minutes.
3. WHEN the countdown reaches zero, THE Test_Session_App SHALL auto-submit the attempt using the existing submit API and transition to the Results_App.
4. THE Test_Session_App SHALL display a question navigator panel showing all questions with answered/unanswered/marked-for-review states.
5. WHEN the current question type is `mcq_single` or `mcq_multi`, THE Test_Session_App SHALL render the MCQ card UI with shuffled options.
6. WHEN the current question type is `debugging`, THE Test_Session_App SHALL render the debugging layout described in Requirement 11.
7. WHEN a question's `unlock_at_minutes` has not yet elapsed, THE Test_Session_App SHALL display a locked state for that question.
8. THE Test_Session_App SHALL auto-save responses with a 1500ms debounce using the existing responses API.
9. WHEN the user clicks "Submit Test", THE Test_Session_App SHALL display a confirmation modal showing answered vs total question counts before submitting.
10. WHEN submission completes, THE Test_Session_App SHALL close itself and open the Results_App in a new App_Window.
11. THE Test_Session_App SHALL continue running the heartbeat and integrity listeners (tab-switch, focus-lost detection) using the existing hooks while the window is open and the attempt is active.
12. IF the attempt status is already `submitted` or `auto_submitted` when the app opens, THEN THE Test_Session_App SHALL immediately open the Results_App instead.
13. WHEN the Test_Session_App opens for a new attempt (not a resume), THE Test_Session_App SHALL display a pre-test proctored start screen before revealing questions or starting the timer. The start screen SHALL show: the test title, duration, question count, and a rules checklist (close other tabs, no window switching, stable internet, auto-submit on timer expiry, tab switches are recorded). The start screen SHALL include a confirmation checkbox labeled "I understand and agree to the integrity policy". The "Begin Test" button SHALL be disabled until the checkbox is checked. The attempt SHALL NOT be created via the API until the student clicks "Begin Test".
14. WHEN the attempt's `tab_switch` count reaches 3, THE Test_Session_App SHALL immediately auto-submit the attempt by calling the existing submit API with `auto_submit_reason = 'integrity_violation'`. THE Test_Session_App SHALL then close and open the Results_App. THE Results_App SHALL display a prominent "Submitted due to integrity violation" banner when `auto_submit_reason` is `integrity_violation`. Score override to 0 is handled server-side.
15. WHEN the Test_Session_App has an active in-progress attempt, THE Window_Manager SHALL disable drag, resize, minimize, and close controls for that App_Window. The title bar SHALL display a lock icon in place of the traffic-light controls. WHEN the attempt is submitted (successfully or via integrity violation), THE Window_Manager SHALL restore normal window controls before the Results_App opens.

---

### Requirement 9: Results App (Student)

**User Story:** As a student, I want a Results app so that I can review my performance after completing a test.

#### Acceptance Criteria

1. THE Results_App SHALL fetch and display the attempt result from the existing results API.
2. THE Results_App SHALL display: total score, total marks, percentage, rank, and pass/fail status.
3. THE Results_App SHALL display a per-question breakdown showing question type, marks awarded, and correct/incorrect status.
4. WHEN a question is of type `debugging`, THE Results_App SHALL display visible test cases passed and hidden test cases passed as separate counts.
5. THE Results_App SHALL be openable by both students (for their own attempts) and admins, consistent with the existing role-based access control.

---

### Requirement 10: Analytics App (Student)

**User Story:** As a student, I want an Analytics app so that I can track my performance trends over time.

#### Acceptance Criteria

1. THE Analytics_App (student variant) SHALL display a score trend line chart across all of the student's attempted tests, using the existing analytics API and Recharts.
2. THE Analytics_App SHALL display subject-wise performance as a bar or radar chart.
3. THE Analytics_App SHALL display accuracy rate for MCQ questions and debugging questions separately.
4. THE Analytics_App SHALL display the student's personal rank trend over time.
5. THE Analytics_App SHALL use Lenis for smooth scrolling within the window when content overflows.

---

### Requirement 11: Debugging Question Layout (inside Test Session App)

**User Story:** As a student, I want a clear code editor and terminal layout for debugging questions so that I can read the buggy code, write my fix, and run it against test cases without confusion.

#### Acceptance Criteria

1. THE Test_Session_App SHALL render the Buggy_Code_Panel above the Code_Editor when the current question is of type `debugging`.
2. THE Buggy_Code_Panel SHALL display the assigned buggy variant in a read-only Monaco Editor instance with a red-tinted header labeled "Buggy Code".
3. THE Buggy_Code_Panel SHALL be collapsible; WHEN the user clicks the collapse toggle, THE Buggy_Code_Panel SHALL animate closed, giving more vertical space to the Code_Editor.
4. THE Code_Editor SHALL be an editable Monaco Editor instance pre-populated with the buggy code as a starting point, with an indigo-tinted header labeled "Your Fix".
5. THE Terminal_Panel SHALL be rendered below the Code_Editor with a dark background, monospace font, and green/white text.
6. THE Terminal_Panel SHALL display a header bar containing a "Run" button and a "Runs remaining: N" counter.
7. WHEN the user clicks "Run", THE Terminal_Panel SHALL call the existing `/execute` API and display per-test-case pass/fail results including input, expected output, actual output, and stderr.
8. WHEN a test case passes, THE Terminal_Panel SHALL display that result with green accent styling.
9. WHEN a test case fails, THE Terminal_Panel SHALL display that result with red accent styling, showing the diff between expected and actual output.
10. WHEN `runs_remaining` reaches zero, THE Terminal_Panel SHALL disable the "Run" button and display "No runs left".
11. THE Code_Editor SHALL attach the existing behavioral tracking hooks (`onKeyDown`, `onPaste`) to capture `time_to_first_keystroke`, `paste_events`, `backspace_count`, and `wpm_consistency`.
12. THE entire debugging layout (Buggy_Code_Panel + Code_Editor + Terminal_Panel) SHALL be contained within the resizable App_Window and SHALL reflow correctly when the window is resized.

---

### Requirement 12: Question Bank App (Admin)

**User Story:** As an admin, I want a Question Bank app so that I can manage MCQ and debugging questions from within the OS.

#### Acceptance Criteria

1. THE Question_Bank_App SHALL display a filterable, searchable list of all questions created by the authenticated admin, fetched from the existing questions API.
2. THE Question_Bank_App SHALL support filtering by question type (`mcq_single`, `debugging`), difficulty, and topic tag.
3. WHEN the user clicks "Add MCQ", THE Question_Bank_App SHALL open an inline form or a child modal for creating a new MCQ question using the existing MCQ creation API.
4. WHEN the user clicks "Add Debugging Question", THE Question_Bank_App SHALL open an inline form for entering the question statement, correct code, bug count, difficulty, and language.
5. WHEN the admin submits a new debugging question, THE Question_Bank_App SHALL call the existing Gemini variant generation API and display the generated variants for review.
6. THE Question_Bank_App SHALL display each generated variant with a side-by-side diff view (original vs buggy, changed lines highlighted) using the `diff_json` field.
7. WHEN the admin approves a variant, THE Question_Bank_App SHALL call the existing variant approval API and mark the variant as approved in the UI.
8. THE Question_Bank_App SHALL display the count of approved variants per debugging question and warn when fewer than 3 variants are approved.
9. THE Question_Bank_App SHALL support bulk import via the existing import API, displaying per-row success/error feedback after import.

---

### Requirement 13: Test Manager App (Admin)

**User Story:** As an admin, I want a Test Manager app so that I can create, schedule, and manage tests from within the OS.

#### Acceptance Criteria

1. THE Test_Manager_App SHALL display a list of all tests created by the authenticated admin with their status (`draft`, `active`, `ended`).
2. WHEN the user clicks "New Test", THE Test_Manager_App SHALL display a creation form with fields for: title, subject, year, division, duration, start time, end time, questions per attempt, and randomize toggle.
3. WHEN the user saves a new test, THE Test_Manager_App SHALL call the existing test creation API and add the test to the list.
4. THE Test_Manager_App SHALL allow the admin to attach questions from the Question Bank to a test, setting `unlock_at_minutes` and `question_order` per question.
5. WHEN the user clicks "Edit" on a draft test, THE Test_Manager_App SHALL open an edit form pre-populated with the test's current values.
6. THE Test_Manager_App SHALL display a live leaderboard panel for active and ended tests, fetched from the existing leaderboard API.
7. WHEN the user clicks "Integrity" on a test, THE Test_Manager_App SHALL open the Integrity_App window for that test.
8. WHEN the user clicks "Similarity Report" on a test, THE Test_Manager_App SHALL open the similarity report view for that test.

---

### Requirement 14: Integrity App (Admin)

**User Story:** As an admin, I want an Integrity app so that I can review behavioral and similarity flags for a specific test.

#### Acceptance Criteria

1. THE Integrity_App SHALL fetch and display all attempt integrity data for the selected test from the existing integrity API.
2. THE Integrity_App SHALL display summary statistics: total attempts, average integrity score, high-risk count (score < 60), and similarity flag count.
3. THE Integrity_App SHALL display a sortable table of students with columns: name, division, integrity score, tab switches, focus lost count, behavioral flag count, and similarity flag count.
4. WHEN the user clicks "Expand" on a student row, THE Integrity_App SHALL display the per-question behavioral detail panel showing: time to first keystroke, paste events, backspace count, edit count, WPM consistency, test runs before submit, and idle periods.
5. THE Integrity_App SHALL support filtering by division, integrity score range (high/medium/low), and name search.
6. THE Integrity_App SHALL support sorting by integrity score ascending or descending.
7. WHEN the user clicks "Similarity Report", THE Integrity_App SHALL navigate to or open the similarity report view for the same test.

---

### Requirement 15: Analytics App (Admin)

**User Story:** As an admin, I want an Analytics app so that I can review test and student performance data across my tests.

#### Acceptance Criteria

1. THE Analytics_App (admin variant) SHALL display per-test statistics: average score, median score, completion rate, and hardest question, fetched from the existing analytics API.
2. THE Analytics_App SHALL support filtering by year, division, subject, test, and date range.
3. THE Analytics_App SHALL display a division comparison chart (e.g., SE-A vs SE-B on the same test) using Recharts.
4. THE Analytics_App SHALL display question bank health: actual difficulty distribution and most-failed questions.
5. THE Analytics_App SHALL display per-student drill-down: all attempts, score trend, and integrity score history for a selected student.
6. THE Analytics_App SHALL use Lenis for smooth scrolling within the window when content overflows.

---

### Requirement 16: Responsive Behavior

**User Story:** As a user on a tablet or mobile device, I want the OS to adapt so that I can still use TestForge effectively on smaller screens.

#### Acceptance Criteria

1. WHILE the viewport width is 1024px or greater, THE OS_Shell SHALL enable full draggable, resizable App_Windows as described in Requirement 4.
2. WHILE the viewport width is between 768px and 1023px (tablet), THE Window_Manager SHALL render App_Windows as fixed-position, full-width panels; dragging and resizing SHALL be disabled.
3. WHILE the viewport width is below 768px (mobile), THE OS_Shell SHALL display one App_Window at a time in a bottom-sheet style that slides up from the bottom of the screen.
4. WHILE the viewport width is below 768px, THE Dock SHALL transform into a bottom navigation bar with icon labels always visible, replacing the floating pill style.
5. WHILE the viewport width is below 768px, THE Menu_Bar SHALL collapse to show only the clock and the user avatar; the active app name SHALL be omitted.
6. THE OS_Shell SHALL use CSS media queries and Tailwind responsive prefixes to implement breakpoint-specific layouts without JavaScript viewport detection where possible.

---

### Requirement 17: Animations and Motion

**User Story:** As a user, I want smooth, purposeful animations so that the OS feels polished and responsive without being distracting.

#### Acceptance Criteria

1. THE Window_Manager SHALL use Framer_Motion `AnimatePresence` to orchestrate window open (scale from 0 to 1, opacity 0 to 1) and close (scale from 1 to 0, opacity 1 to 0) animations with spring easing.
2. WHEN an App_Window is minimized, THE Window_Manager SHALL animate the window translating toward the Dock icon position and scaling to zero using Framer_Motion.
3. WHEN a minimized App_Window is restored, THE Window_Manager SHALL animate the window scaling from the Dock icon position back to its stored position using Framer_Motion.
4. THE Dock SHALL implement icon magnification on hover using Framer_Motion `useMotionValue` and `useTransform` to scale the hovered icon and its neighbors proportionally.
5. WHEN the theme toggles, THE OS_Shell SHALL transition all color surfaces within 400ms using the existing CSS custom property transitions defined in `index.css`.
6. THE Lock_Screen SHALL animate its dismissal with a fade-out and upward translate when login succeeds, revealing the desktop beneath.
7. WHEN the Lock_Screen appears (on logout), THE OS_Shell SHALL animate it fading in over 300ms.
8. THE OS_Shell SHALL use Lenis for smooth scrolling within any App_Window whose content overflows its bounds.
9. ALL Framer_Motion animations SHALL respect the user's `prefers-reduced-motion` media query; WHEN reduced motion is preferred, THE Window_Manager SHALL use opacity-only transitions with no scale or translate transforms.

---

### Requirement 18: Glassmorphism Visual System

**User Story:** As a user, I want a consistent frosted-glass visual language throughout the OS so that the interface feels cohesive and modern.

#### Acceptance Criteria

1. THE OS_Shell SHALL apply the `.glass` utility class (defined in `index.css`: `backdrop-filter: blur(16px) saturate(180%)`, semi-transparent background, 1px border) to all App_Window chrome, the Dock, the Menu_Bar, and the Lock_Screen card.
2. THE OS_Shell SHALL use the `--glass-bg` and `--glass-border` CSS custom properties for all glass surfaces so that both dark and light themes are supported without separate class definitions.
3. WHEN the Theme is `dark`, THE OS_Shell SHALL use `--glass-bg: rgba(255 255 255 / 0.06)` and `--glass-border: rgba(255 255 255 / 0.12)`.
4. WHEN the Theme is `light`, THE OS_Shell SHALL use `--glass-bg: rgba(255 255 255 / 0.45)` and `--glass-border: rgba(255 255 255 / 0.7)`.
5. THE App_Window title bar SHALL use a slightly more opaque glass fill than the window body to visually distinguish the draggable chrome from the content area.

---

### Requirement 19: Authentication and Route Guard

**User Story:** As the system, I want all OS app access to be gated by authentication and role so that unauthorized users cannot access protected content.

#### Acceptance Criteria

1. THE OS_Shell SHALL check the authenticated user's session on mount using the existing `AuthContext`; WHEN no valid session exists, THE OS_Shell SHALL display the Lock_Screen.
2. THE Dock SHALL only render icons for apps permitted by the authenticated user's role, using the same role definitions as the existing `ProtectedRoute` component.
3. WHEN an unauthenticated request is made to any existing API endpoint, THE OS_Shell SHALL intercept the 401 response via the existing Axios interceptor and display the Lock_Screen.
4. THE `/register` route SHALL remain publicly accessible and SHALL NOT require authentication.
5. THE OS_Shell SHALL preserve the existing JWT-based authentication flow; no changes to the server-side auth middleware are required.

---

### Requirement 20: State Management

**User Story:** As the system, I want a centralized OS state store so that window positions, open apps, and focus state are consistent across all components.

#### Acceptance Criteria

1. THE OS_Shell SHALL use Zustand (already installed) to manage a global OS state store containing: the list of open App_Windows (id, app type, position, size, minimized state, z-index), the currently focused window id, and the active theme.
2. WHEN an App_Window is opened, moved, resized, minimized, maximized, restored, or closed, THE OS_Shell SHALL update the Zustand store atomically.
3. THE Menu_Bar and Dock SHALL derive their display state from the Zustand store, re-rendering only when relevant slices change.
4. THE OS_Shell SHALL initialize the Zustand store with no open windows and the theme read from `localStorage` (defaulting to `dark`) on first mount.
5. WHEN the user changes the theme, THE OS_Shell SHALL persist the new theme value to `localStorage` so that it is restored on next visit.
