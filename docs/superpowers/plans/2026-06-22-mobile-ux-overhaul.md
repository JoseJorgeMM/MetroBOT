# Mobile UX Overhaul Implementation Plan

> For agentic workers: TDD where testable, otherwise verification via headless screenshots at 375x812 and 768x1024.

## Goal

Fix the mobile (375 - 414 px viewport) experience in MetroBOT:
- Buttons are too small to tap reliably.
- The bottom sheet at MID (45dvh) leaves too little room for the chat content.
- The LocateControl button floats at a hard-coded `bottom-[22dvh]` which only matches one sheet state.
- The disclaimer banner is always full-width and never dismissible.
- Breakpoint is at 768 px so 800 px tablets still get the cramped mobile layout.

## File Structure

- Modify: `src/App.tsx` (sheet heights, header, disclaimer, breakpoints).
- Modify: `src/components/RouteCards/RouteCard.tsx` (badge tap target, body padding).
- Modify: `src/index.css` (hide leaflet zoom on small screens -- already done; add bottom-sheet drag affordance).
- New: tiny `useLocalStorage` hook for disclaimer dismissal (inline, no new file needed).

## Tasks

### Task 1: Tighter breakpoints and bigger tap targets

**Files:** `src/index.css`, `src/components/RouteCards/RouteCard.tsx`, `src/App.tsx`.

- [ ] **Step 1: Audit current sizes**
  - `heightClasses = { min: h-20 (80px), mid: h-[45dvh], max: h-[85dvh] }`.
  - `absolute bottom-[22dvh] right-3 z-[999] md:hidden pointer-events-none` LocateControl.
  - `px-4 pt-3 pb-2` header, two icon buttons (`w-5 h-5`) in a 40px container.
  - `HelpCircle`, `Sun`, `Moon` icons are `w-5 h-5` (20px).

- [ ] **Step 2: Bump tap targets to >=44px CSS everywhere**
  - Header buttons: `min-h-[44px] min-w-[44px]`, icons `w-5 h-5` -> `w-6 h-6`.
  - Chat send button: keep `size="icon"` (already 40px) but ensure parent has `min-h-[44px]`.
  - Validation badges in RouteCard: `min-h-[28px]` -> `min-h-[36px]` and `text-[11px]` -> `text-xs`.

- [ ] **Step 3: Move the mobile -> tablet breakpoint from md: (768) to lg: (1024)**
  - In `App.tsx`, replace `md:` with `lg:` on:
    - Sheet wrapper (so 800-1023 px tablets get the right-side panel).
    - Header icon buttons (Sun/Moon -> hidden on small screens, shown on lg+).
    - LocateControl absolute positioning (md:hidden -> lg:hidden).
  - Result: 375 - 1023 px = full mobile/tablet sheet layout; 1024+ = side-by-side.

- [ ] **Step 4: Adjust sheet snap heights for mobile**
  - `min: 'h-20'` (80px) -> `min: 'h-[72px]'` so the drag handle + MetroBot title fit.
  - `mid: 'h-[45dvh]'` -> `mid: 'h-[58dvh]'` so the chat has more room.
  - `max: 'h-[85dvh]'` -> `max: 'h-[92dvh]'`.
  - Update `SNAP_POINTS` accordingly.

- [ ] **Step 5: Reposition LocateControl and support card so they don't collide with the sheet**
  - LocateControl: move from `absolute bottom-[22dvh]` to a `top: 14, right: 14` of the map container, hidden when sheet is `mid` or `max`.
  - SupportCard: keep `bottom-6 left-6` only on `lg+`, hide on mobile.
  - Sheet header: collapse to a single column at < lg, hide subtitle `Asistente SITVA`.

### Task 2: Dismissible disclaimer + per-route warning

**Files:** `src/App.tsx`, `src/components/RouteCards/RouteCard.tsx`.

- [ ] **Step 1: Add a localStorage-backed dismissal flag**
  - Add `const [disclaimerOpen, setDisclaimerOpen] = useState(true)` and persist `metrobot.disclaimer.dismissed` to localStorage.
  - When user clicks a small "x" or "Entendido" button, set dismissed and persist.
  - Show banner only when `routes.length > 0 && disclaimerOpen`.

- [ ] **Step 2: Tighten the disclaimer layout for narrow screens**
  - Reduce padding on small screens, allow text to wrap onto multiple lines.
  - Add inline "Entendido" button (touch-friendly, 36px tall).

- [ ] **Step 3: Validation badges (validated/unvalidated) become larger and more readable**
  - Increase badge font from `text-[10px]` to `text-xs`.
  - Use `min-h-[28px] px-2.5` for hit area.
  - When the disclaimer is shown AND the route has `validation.degradedSteps > 0`, the badge tooltip should mention the count.

### Task 3: Bottom-sheet drag affordance

**Files:** `src/index.css`.

- [ ] **Step 1: Make the drag handle visibly tappable on touch**
  - Add a hit area of at least 48px tall (the handle itself is 32px; pad with `py-2`).
  - Add a subtle hover/active state.

### Task 4: Verification

- [ ] **Step 1: Lint + build clean** (npm run lint, npm run build).
- [ ] **Step 2: Headless screenshots at 375x812 and 414x896**
  - Use the browser MCP or `chrome --headless` + CDP to capture before/after.
  - Save to `mobile_screenshots/after-375.png` and `mobile_screenshots/after-414.png`.
- [ ] **Step 3: Confirm no interactive element is smaller than 32x32 CSS pixels at 375px width** by dumping layout via CDP.

## Notes

- YAGNI: do not introduce a tabbed interface for the sheet. Just resize.
- DRY: the sheet header is rendered inline in App.tsx; no need to extract.
- Do NOT change the routing logic, the validation pipeline, or anything that already works on desktop.
