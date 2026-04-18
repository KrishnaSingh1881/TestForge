# TestForge UX Audit & Suggestions

This document outlines the current UX state of the TestForge OS Shell and the Test Session Application, identifying friction points and proposing premium improvements based on modern design systems.

---

## 1. Accessibility & Navigation
**Status: ⚠️ Needs Improvement**

*   **Keyboard Management**: There is no "Alt+Tab" or equivalent keyboard-driven window switcher. Users are forced to use the mouse to focus windows, which is slow and inaccessible for some.
*   **Focus Indication**: Clickable elements (Dock icons, Traffic lights) lack strong keyboard focus rings (`:focus-visible`).
*   **ARIA Labels**: The Dock and MenuBar components lack descriptive `aria-label` or `role` attributes, making them difficult for screen readers to interpret.
*   **Contrast (Light Mode)**: In Light Mode, the "warm beige" glass buttons and text often fall below the 4.5:1 contrast ratio, especially against the complex particle background.

**Suggestions:**
- [x] Implement a **Window Switcher Overlay** (Triggered via `Alt+Tab` or a Dock button).
- [x] Add `aria-label` to all Dock icons and Window controls.
- [x] Define a standard focus-ring style in `index.css`.
- [x] Tighten up light mode variables for better legibility (Crystal Glass overhaul).

---

## 2. Testing Environment Psychology (Cognitive Load)
**Status: 🔴 High Friction**

*   **Visual Distractions**: The GSAP parallax wallpaper and the animated particle canvas are beautiful but potentially distracting during a high-stakes exam.
*   **Anxiety-Inducing Feedback**: Integrity score deductions (e.g., "Tab switch detected −30") are displayed in a harsh red toast. While necessary for proctoring, the visual style can cause significant panic in honest students who make accidental moves.
*   **Guided Onboarding**: The "Start Screen" of the `TestSessionApp` is text-heavy and uses a lot of uppercase tracking, which can be hard to parse quickly.

**Suggestions:**
- [ ] **Focus Mode**: Automatically disable particles and parallax when a `TestSessionApp` is maximized or locked.
- [ ] **Softened Alerts**: Use a more "measured" warning system for first-time violations before going into full "Breach" UI.
- [ ] **Onboarding Progress**: Replace the rules list with a multi-step checklist or a cleaner card-based layout.

---

## 3. OS Shell Consistency & Aesthetics
**Status: 🟡 Good / Needs Polish**

*   **App Switching**: Opening an already open app from the Dock just focuses it, but there's no visual "spring" or feedback in the Dock to show *which* window is coming forward.
*   **Window Management**: Windows don't have a "Snap" feature or an easy way to tile them (e.g., side-by-side view for coding tests).
*   **Cursor States**: Some interactive elements (like the traffic lights or dock sub-bars) have ad-hoc cursor styles instead of a consistent utility.

**Suggestions:**
- [ ] **Dock Interaction**: Add a "bounce" or "pulse" animation to dock icons when their window is focused or restored.
- [ ] **Mission Control View**: A "F3" or "Ctrl+Up" style view that scales all open windows to a grid for easy selection.
- [ ] **Standardize Utilities**: Use Tailwind/CSS utility classes for all cursors and hover states.

---

## 4. Technical Performance (Edge Cases)
**Status: 🟡 Stable**

*   **Low Power Mode**: The continuous `requestAnimationFrame` for particles can drain the battery of student laptops.
*   **Responsive Scaling**: The mobile dock occupies significant vertical space on smaller screens, potentially obscuring content.

**Suggestions:**
- [ ] **Throttled Rendering**: Pause particle calculations when the window is hidden or when "Power Save" is detected.
- [ ] **Mobile Dock Toggle**: Allow minimizing the dock on mobile to maximize viewport area.

---

## Proposed Roadmap

1.  **Phase 1 (Accessibility & Core)**: Keyboard navigation, ARIA labels, and contrast fixes.
2.  **Phase 2 (Experience)**: Focus Mode (Distraction removal) and better Integrity UI.
3.  **Phase 3 (Premium Polish)**: Window Switcher and Dock interaction animations.

---

## 5. Deep User Flow Analysis & Enhancement Strategy

Following the visual overhaul to the "Crystal Glass" theme, a deep analysis of user journeys reveals opportunities to move beyond basic list-detail paradigms.

### 5.1 Student Journey (Academic Hub → Evaluation)

**Current State**: Students see a flat list of tests. Starting a test is a single click that forcefully locks the UI.
**Enhancement Plan**:
- **Hero Priority**: The `TestsHub` will feature a dynamic "Next Action" area. If a test is starting in < 15 mins, it becomes a high-contrast glass card with a countdown.
- **Pre-flight Sequence**: Instead of immediate "Initiate", students see a 3-step preparation:
    - Step 1: Connectivity & Permissions Check.
    - Step 2: Integrity Affirmation (Affirming the code of conduct).
    - Step 3: Immersive Transition (Window maximizes, Focus Mode engages).

### 5.2 Test Session Experience

**Current State**: Submitting a test leads to a loading spinner followed by a redirect or window close.
**Enhancement Plan**:
- **The "Concluded" Summary**: After the `evaluating` phase, transition to a `concluded` state. Show a premium card: "Session Successfully Synced".
- **Immediate Indicators**: Show number of items attempted and total duration. This provides psychological closure before the student returns to the Hub.

### 5.3 Review & Feedback (Results App)

**Current State**: Questions are listed vertically. Navigation is basic.
**Enhancement Plan**:
- **Review Workbench**: Split the screen into a two-pane layout (Filters/List on left, detail on right).
- **Comparative Context**: Show a small badge: "Your speed: Top 10%" or "Accuracy in this topic: High".

### 5.4 Admin Workflow (Test Manager)

**Current State**: A single large form with 15+ fields.
**Enhancement Plan**:
- **Configuration Wizard**: Break form into `Identity`, `Temporal`, `Integrity`, and `Asset Attachment` steps.
- **Visual Schedule**: A timeline view showing the status of each test relative to current time.

### 5.5 Forensics & Similarity (Integrity App)

**Current State**: Simple list of flags.
**Enhancement Plan**:
- **Narrative Audits**: Use AI narratives as the primary "risk signature" instead of just scores.
- **Similarity Workbench**: Dedicated side-by-side view for code comparison.
