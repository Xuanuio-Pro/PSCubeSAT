# UI Implementation Map

Last audited: 2026-09-05

This document is the working map between the existing frontend, its business flows, and incoming Figma batches. The repository is the source of truth for behavior; Figma is the source of truth for presentation.

## Project frontend stack

- Runtime: React 19.2.7 with React DOM 19.2.7.
- Language: JavaScript/JSX for the active application. TypeScript is configured for the Vite toolchain, but the active entry point and application sources are JSX.
- Build: Vite 8.1.1, TypeScript project build, npm scripts (`dev`, `dev:fe`, `build`, `lint`, `preview`).
- Routing: React Router DOM 6.28.0 with `BrowserRouter`, declarative `Routes`, lazy-loaded pages, and a catch-all route.
- Authentication: bearer token stored under `access_token`; `AuthContext` owns bootstrap, login, registration, logout, password change, and learning-progress writes.
- State: React local state and contexts. `AuthContext` and `SerialContext` are the active global state layers. Zustand is installed but no active store was found in `src`.
- API/client: a shared `request()` wrapper in `src/contexts/AuthContext.jsx`; direct `fetch()` remains in compiler and documentation components. Vite proxies `/api` to FastAPI on port 8005 and `/ws` to the same backend.
- Styling: global handcrafted CSS in `src/index.css`, primarily CSS custom properties and semantic class names. Tailwind 4 is installed and registered with Vite, but the current JSX does not use Tailwind utilities as its main styling system.
- UI library: none. Reusable UI is implemented locally.
- Icons: project SVG assets plus emoji and locally authored SVG React components in `AuthIcons.jsx`; no external icon package.
- Charts/visualization: ECharts, React Three Fiber/Three.js, Leaflet, and React Grid Layout.
- Forms: native React controlled inputs; no form library.
- Content: React Markdown with GFM.
- Fonts: Google Fonts `Inter` for UI and `JetBrains Mono` for code/telemetry.

## Application shell and layouts

### Global shell

- Source: `src/App.jsx`.
- All non-auth routes use the fixed `Header` and a `.main-content` wrapper offset by `--header-height`.
- The live header follows the Home/LMS Figma language: logo lockup, centered search, compact navigation/Serial controls, and authentication state. Existing Web Serial and auth handlers remain active.
- `/login` and `/signup` omit the global header and render `AuthLayout`.
- Page modules are lazy loaded behind the shared `LoadingScreen` fallback.

### Course/lab shell

- Source: `src/components/layout/LabLayout.jsx`.
- Used by every `/lab0` through `/lab8` page.
- Contains `CourseSidebar` plus a scrollable main region with three local lesson states: overview video, documentation, and practice.
- `CourseSidebar` implements the Figma collapsed rail and full navigation as two states of one component; desktop can toggle them, while narrow layouts retain the usable rail.
- The practice view preserves each lab's editor and visualization composition via `editorPanel` and `visualizationPanel` props.
- Authenticated visits write video/document progress through `AuthContext` when the corresponding lesson becomes active.

### Auth shell

- Source: `src/components/common/AuthLayout.jsx`.
- Used by login and sign-up.
- Two-column Figma auth presentation with a centered brand mark, vertical divider, and elevated form card; the visual column is removed below 860px and the form becomes edge-safe below 560px.

## Routes and pages

| Page | Route | Main source | Layout | Shared/local dependencies | Important states and related flow | Figma |
| --- | --- | --- | --- | --- | --- | --- |
| Home | `/` | `src/pages/HomePage.jsx` | Global shell | `Header`, `LABS`, course cards | Entry to `/lab0`…`/lab8`; entry to authentication/profile from header | Implemented from `2371:19` |
| Login | `/login` | `src/pages/LoginPage.jsx` | `AuthLayout` | `AuthIcons`, `AuthContext` | Controlled form; password visibility; validation/API error; submitting; success → `/`; link → `/signup` | Implemented from `2145:883` |
| Sign up | `/signup` | `src/pages/SignUpPage.jsx` | `AuthLayout` | `AuthIcons`, `AuthContext` | Controlled form; validation/API error; submitting; success → `/`; link → `/login` | Implemented from `2145:987` |
| Profile | `/profile` | `src/pages/ProfilePage.jsx` | Global shell | `Header`, `DeviceManager`, `AuthContext`, `LABS` | Auth bootstrap; unauthenticated → `/login`; profile/progress/password/device tabs; loading, success, error, empty device/progress states | Pending |
| Lab 0: Overview | `/lab0` | `src/pages/Lab0.jsx` | `LabLayout` | `CourseSidebar`, `VideoPlayer`, `DocViewer`, `ComponentViewer` | Video → document → interactive CubeSat component viewer; can navigate to any lab | Implemented from `2344:80`, `2349:918`, `2349:1241`, `2349:1712` |
| Lab 1: OBC | `/lab1` | `src/pages/Lab1.jsx` | `LabLayout` | `IDEPanel`, `SerialMonitor` | Learn → code/compile/flash → inspect serial output | Implemented from `2350:3408`, `2350:3625`, `2350:4035`, `2350:4587` |
| Lab 2: EPS | `/lab2` | `src/pages/Lab2.jsx` | `LabLayout` | `IDEPanel`, `SerialMonitor`, `CloudCompiler`, `WebFlasher` | Learn → document → code/compile/flash → inspect serial output | Implemented from `2350:4318`, `2375:218`, `2375:418`, `2368:1732` |
| Lab 3: C&DH | `/lab3` | `src/pages/Lab3.jsx` | `LabLayout` rich practice variant | `IDEPanel`, `LabPracticeActions`, `SerialMonitor`, `VoltageChart` | Learn → program telemetry → inspect serial/voltage chart | Implemented from established Lab 1–2 design system |
| Lab 4: Sensors | `/lab4` | `src/pages/Lab4.jsx` | `LabLayout` rich practice variant | `IDEPanel`, `LabPracticeActions`, `SerialMonitor`, `AttitudeViewer3D`, `GPSMap`, `CameraViewer` | Learn → program sensors → inspect serial, attitude, GPS, and camera states | Implemented from established Lab 1–2 design system |
| Lab 5: Communications | `/lab5` | `src/pages/Lab5.jsx` | `LabLayout` rich practice variant | `IDEPanel`, `LabPracticeActions`, `TelemetryPanel`, `CommandPanel` | Learn → program radio → monitor telemetry and send commands | Implemented from established Lab 1–2 design system |
| Lab 6: Structure | `/lab6` | `src/pages/Lab6.jsx` | `LabLayout` rich practice variant | `IDEPanel`, `LabPracticeActions`, `SystemCheck`, `SerialMonitor` | Learn → integrate → run system checks and inspect serial state | Implemented from established Lab 1–2 design system |
| Lab 7: Integration | `/lab7` | `src/pages/Lab7.jsx` | `LabLayout` rich practice variant | `IDEPanel`, `LabPracticeActions`, `AttitudeViewer3D`, `GPSMap`, `VoltageChart` | Integrated mission view across visualization widgets | Implemented from established Lab 1–2 design system |
| Lab 8: Capstone | `/lab8` | `src/pages/Lab8.jsx` | `LabLayout` dashboard practice variant | `IDEPanel`, `LabPracticeActions`, `DashboardBuilder` | Build firmware and compose a custom responsive monitoring dashboard | Implemented from established Lab 1–2 design system |
| Not found | `*` | `src/pages/NotFoundPage.jsx` | Standalone fallback | logo, invisible-shape link | Invalid route → select logo/title to return home | Implemented from `2178:590` |

## Shared components

### Navigation

- `Header`: home/course/API navigation, active lab label, Web Serial connection toggle, authentication entry, profile link, and logout.
- `CourseSidebar`: Figma blue rail/full variants, all nine labs and current lesson choices; changes route between labs and changes lesson state inside the current lab.
- `Sidebar`: an older/alternate lab navigation component. No active import was found; do not style it as if it were live without confirming a new usage.

### Common UI

- `AuthLayout`: shared auth frame.
- `AuthIcons`: Google and password-visibility glyphs.
- `LoadingScreen`: route-level Suspense fallback.
- `TabPanel`: shared tab state and toolbar slot, currently used by `IDEPanel`.
- `VideoPlayer`: iframe or empty-video placeholder.
- `DocViewer`: fetches and renders lab Markdown; owns loading/error/content states.

### Course tooling

- `IDEPanel`: Blockly/Monaco editing plus compilation and flashing controls.
- `BlocklyEditor`, `MonacoEditor`: visual/code editing surfaces.
- `CloudCompiler`: authenticated `/api/compile` request; compiling, failure, and binary-ready states.
- `WebFlasher`: Web Serial firmware flashing states.
- `LabPracticeActions`: shared compile, flash, Serial connection, and terminal-clear action composition for Lab 1–8.
- `SerialMonitor`: shared stream, command input, connection/empty/output behavior.
- `ComponentViewer`: CubeSat component selection/details.

### Ground station and visualization

- `TelemetryPanel`, `CommandPanel`.
- `VoltageChart`, `GPSMap`, `CameraViewer`, `AttitudeViewer3D`, `SystemCheck`.
- `DashboardBuilder`: reusable widget palette and responsive grid composed from existing visualization components.

### Profile

- `DeviceManager`: device list, registration, position edit, credentials/result, loading, API error, and empty states.

No standalone shared `Button`, `Input`, `Modal`, `Table`, `Badge`, or toast component currently exists. Button/card/tab/form styling is shared through global CSS class contracts. There is no general modal or data-table abstraction in active frontend code.

## Design tokens

The canonical code-side token source is `:root` in `src/index.css`.

### Color system

- Surfaces: `--bg-app`, `--bg-surface`, `--bg-surface-hover`.
- Borders: `--border-subtle`, `--border-strong`.
- Text: `--text-heading`, `--text-body`, `--text-muted`.
- Brand: `--brand-primary`, `--brand-primary-dark`, `--brand-primary-light`, `--brand-nasa-blue`, `--brand-nasa-red`.
- Figma CubeSat palette: `--cubesat-ink`, `--cubesat-navy`, `--cubesat-steel`, `--cubesat-teal`, `--cubesat-sky`, `--cubesat-mist` from node `2347:532`.
- Accents: `--accent-purple`, `--accent-green`, `--accent-orange`, `--accent-red`.

### Typography

- Sans: Inter, with system fallbacks.
- Mono: JetBrains Mono, with Fira Code/monospace fallbacks.
- Heading weight is globally 700; page-specific headings and controls sometimes override weight and size inline.

### Spacing, radius, and shadows

- No numeric spacing or radius token scale exists yet. Common repeated values are 8, 12, 16, 20, 24, 32, 40, 48, 64, and 80px.
- Common radii are 8, 10, 12, 16, 24, and 32px.
- Shadow tokens: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-glow`.
- Motion tokens: `--ease-spring`, `--ease-out`, `--transition-fast`, `--transition-normal`.
- Layout tokens: `--header-height: 72px`, `--sidebar-width: 248px`.

### Breakpoints and responsive behavior

- Global media queries now include `max-width: 860px` for auth/hero behavior and `max-width: 560px` for the Home hero/course grid.
- The Figma Home banner uses a bottom-aligned desktop crop that removes the rasterized auth controls already provided by the live global `Header`; narrow screens use a conservative focal crop and fixed banner height.
- Home node `2371:19` supersedes the earlier banner-only composition in the live route: three-column cards collapse to two columns below 860px and one column below 560px; metric tiles remain a compact three-column row.
- The full Lab sidebar collapses to its 58px Figma rail below 860px so video, documentation, and practice surfaces remain usable without horizontal overflow.
- The auth batch is desktop-only in Figma. Code preserves the two-column desktop composition, collapses to a single form panel below 860px, and reduces padding below 560px to prevent clipping and horizontal overflow.
- Course layout, header navigation, practice split panels, home cards, and profile surfaces currently lack a documented responsive contract. Incoming desktop-only Figma work must preserve current behavior conservatively and should add targeted responsive rules rather than assume a new system.

## Assets

- `src/assets/logo.svg`: shared brand mark in header, auth, loading, and not-found surfaces.
- `src/assets/Satellite.svg`: loading orbit illustration.
- `src/assets/hero-banner-home.png`: exact 4366×2456 PNG export of earlier Figma node `2039:2`; retained as prior-batch source material but no longer mounted after full Home node `2371:19` superseded the banner-only layout.
- `src/assets/icon 1.svg`: signed-in user icon.
- `src/assets/hero.png`: legacy Vite/TypeScript demo asset; not part of the active React entry.
- `src/assets/vite.svg`, `src/assets/typescript.svg`, `src/style.css`, `src/main.ts`, and `src/counter.ts`: scaffold remnants, not imported by the active `src/main.jsx` application.
- `public/icons.svg`, `public/favicon.svg`: public assets.

Figma-exported assets must be downloaded into the repository before committing because MCP asset URLs expire. Existing project assets should be reused only when the glyph/artwork clearly matches the Figma design.

## Forms, tables, modals, and feedback

- Forms: login, sign-up, password change, serial command, device registration/position editing, compiler, and flasher controls. They use component-local state and native validation/error rendering.
- Tables: no generic data table; profile/progress/device data is rendered by local profile components.
- Modals/dialogs: no shared modal abstraction found.
- Notifications/toasts: no toast system found; success and error feedback is local/inline, with browser `alert()` used by Web Serial unsupported-state handling.
- Loading: route-level `LoadingScreen` plus local loading flags in auth/profile/device/docs/compiler/flasher flows.
- Empty/error: local implementations in `DocViewer`, profile/device surfaces, media placeholders, and request-driven tools.

## Navigation and business flows

```text
Home → select lab → Lab overview → document → practice
Lab N → CourseSidebar → Lab M → overview/document/practice
Practice → edit code → compile → binary ready → flash via Web Serial → serial/visual result
Header → connect/disconnect Web Serial → all serial-backed components update through SerialContext
Header → login → success → Home
Login ↔ Sign up
Header → Profile → profile/progress/password/devices
Profile progress → Lab route
Header → logout → Home
Unauthenticated Profile → Login
Unknown route → Not Found → Home
```

Business behavior to preserve during presentation changes:

- Route paths and lazy loading.
- Auth token persistence, request headers, redirects, and API error messages.
- Progress writes when video/document lessons are activated.
- Web Serial user gesture, stream lifecycle, shared output, compile/flash sequence, and connection state.
- Each lab's current editor/visualization pairing and its local code state.
- Device creation/deletion/position operations and credential presentation.

## Figma → code mapping

| Figma file | Node | Intended code target | Status |
| --- | --- | --- | --- |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2039:2` Hero Banner | `/` → `src/pages/HomePage.jsx` | Implemented as the responsive Home hero image |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2375:989` Hero Banner | Lab 0 banner/asset variant | Read and classified; not mounted because the current Lab 0 business view is a video lesson |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2145:1108` Hero Banner Background | Source/reference for Home hero | Read; final parent export `2039:2` is the committed asset |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2272:83` cube logo | `src/assets/logo.svg` and all current usages | Existing exact SVG reused; no duplicate asset |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2221:3` Satellite | `src/assets/Satellite.svg` / `LoadingScreen` | Existing SVG reused; no duplicate asset |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2272:46` horizontal logo lockup | Asset reference | Read and classified; not duplicated because no current surface requires this large lockup separately from the banner |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2137:784` Loading | Shared route fallback → `src/components/common/LoadingScreen.jsx` | Implemented; exact existing logo and satellite assets reused |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2145:883` Log In | `/login` → `src/pages/LoginPage.jsx` + `AuthLayout` | Implemented; authentication logic preserved |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2145:987` Sign Up | `/signup` → `src/pages/SignUpPage.jsx` + `AuthLayout` | Implemented; registration logic preserved |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2178:590` 404 Not Found | `*` → `src/pages/NotFoundPage.jsx` | Implemented as a standalone fallback with a presentation-neutral Home link |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2371:19` Trang chủ | `/` → `src/pages/HomePage.jsx` + `Header` | Implemented as the complete code-native Home page |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2347:532` color | `:root` tokens in `src/index.css` | Implemented as the shared CubeSat blue palette |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:3190` Side bar | `CourseSidebar` collapsed/rail state | Implemented in the existing shared Lab navigation |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:3677` Side bar full | `CourseSidebar` expanded state | Implemented in the same component; no duplicate sidebar |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2344:80` LMS LAB 0.1 | `/lab0` → `LabLayout` lesson 0 | Implemented as video workspace, state title, and objective section |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2349:918` Working space | Shared Lab 0 workspace presentation | Implemented as the reusable `lab-workspace` CSS contract across all three Lab 0 states |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2349:1241` LAB 0.2 | `/lab0` → `LabLayout` lesson 1 | Implemented as the documentation workspace with live `DocViewer` content |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2349:1712` LAB 0.3 | `/lab0` → `LabLayout` lesson 2 | Implemented as the component explorer workspace with selectable live data |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:3408` LMS LAB 1.1 | `/lab1` → `LabLayout` lesson 0 | Implemented as the video workspace and objective state |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:3625` Working space | Shared Lab 1 workspace presentation | Implemented through the existing `LabLayout`, editor, and serial components |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:4035` LAB 1.2 | `/lab1` → `LabLayout` lesson 1 | Implemented as the documentation workspace |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:4587` LAB 1.3 | `/lab1` → `LabLayout` lesson 2 | Implemented as the C++/Blockly and Serial practice workspace |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:4318` LMS LAB 2.1 | `/lab2` → `LabLayout` lesson 0 | Implemented as the EPS video and objective workspace |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2375:218` Working space | Shared `/lab2` learning workspace composition | Implemented through the existing `LabLayout` shell |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2375:418` Cụ thể header bar | Shared `Header` on `/lab0`…`/lab8` | Implemented as a route-scoped Lab header variant aligned beside the sidebar |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2368:1732` LAB 2.3 | `/lab2` → `LabLayout` lesson 2 | Implemented as the C++/Blockly and Serial practice workspace |
| `YroN1K0rfWaWJU6U8FYhdK` (CUBESAT) | `2350:3633` | Unknown until structured context is available | Pending; not part of the current asset batch |

The target route/page/component must be determined from the node hierarchy, design context, screenshot, and existing route/import tree before implementation. Do not create a duplicate page based only on the frame name.

## Known UI inconsistencies and technical risks

- `SerialProvider` is mounted in both `src/main.jsx` and `src/App.jsx`. The inner provider shadows the outer instance and can split expected global state if code is later mounted outside `App`.
- Several lab data colors reference undefined CSS variables (`--accent-blue`, `--accent-blue-glow`, `--accent-purple-glow`, `--accent-green-glow`, `--accent-orange-glow`, `--accent-cyan`, `--accent-cyan-glow`).
- `--brand-secondary` and `--border-primary` are referenced by CSS but not defined in `:root`.
- `Sidebar.jsx` appears unused alongside the active `CourseSidebar` and should not be treated as a second live navigation system.
- Profile remains the largest route without a completed Figma presentation pass; its tab density is still high-risk on narrow screens.
- Much page/layout styling is inline, which makes design-token adoption and consistent variants harder.
- README stack/version and structure notes are stale in places (for example React 18/TypeScript-oriented frontend notes versus the active React 19 JSX application).
- ESLint targets only TypeScript/TSX, so current JSX sources are not meaningfully covered by the configured lint rules.
- Figma MCP's structured read tools currently reject this view-only file with an edit-access message. Direct Figma view access is confirmed for `maihoangxuan25052004@gmail.com`; this is treated as a tool-specific read limitation, not a request to raise permissions.

## Implemented Figma batches

### Batch 1 — foundational banners and icons

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`.
- Nodes read: `2039:2`, `2375:989`, `2145:1108`, `2272:83`, `2221:3`, `2272:46`.
- Route/component mapping: Home `/` → `HomePage`; existing `Header`, course grid, routes, auth state, and lab data remain unchanged.
- Files changed: `src/pages/HomePage.jsx`, `src/index.css`, `src/assets/hero-banner-home.png`, and this UI map.
- Reused assets: `src/assets/logo.svg` for `2272:83`; `src/assets/Satellite.svg` for `2221:3`.
- Components created: none.
- Presentation: the old generated gradient/text/stat hero was replaced with the exact Figma parent export. Desktop crops only the baked-in auth strip so the live `Header` remains the single interactive navigation source; narrow layouts use conservative focal cropping.
- Flow verification: Home → Lab 0 → Home and Home → Login → Home passed in the running application.
- Verification: lint and production build passed; desktop runtime and asset loading checked in Edge. No unit-test script exists. Runtime emitted only the existing React Router v7 future-flag warnings.
- Remaining: Figma `get_design_context`, metadata, screenshot, variables, and asset-download MCP endpoints all returned the same edit-access error despite confirmed browser `Can view`; inspection therefore used Figma's read-only Properties/Layers UI and exported node PNG. The exact source PNG is 8.49 MB; lossless fidelity was kept for this asset batch instead of introducing a recompression pipeline.

### Batch 2 — loading, authentication, and not-found states

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`.
- Nodes read: `2137:784`, `2145:883`, `2145:987`, `2178:590`.
- Route/component mapping: shared `LoadingScreen`; `/login` → `LoginPage`; `/signup` → `SignUpPage`; catch-all `*` → `NotFoundPage`; login and sign-up continue to compose the existing `AuthLayout`.
- Files changed: `src/App.jsx`, `src/components/common/LoadingScreen.jsx`, `src/pages/LoginPage.jsx`, `src/pages/SignUpPage.jsx`, `src/pages/NotFoundPage.jsx`, `src/index.css`, and this UI map.
- Shared components reused: `AuthLayout`, `AuthIcons`, `LoadingScreen`, `logo.svg`, and `Satellite.svg`. Shared presentation modified: `AuthLayout` CSS contract and the route-level Suspense placement. Components/assets created: none.
- Presentation: white 50/50 desktop auth shell, centered exact logo, vertical divider, elevated form card, square outlined fields, gradient primary action, Figma static copy, orbital loading state without visible copy, and standalone centered 404 state.
- Business behavior preserved: login/register requests, form validation, password visibility, remember-device state, API error/submitting states, success redirects, and Login ↔ Sign Up navigation. The 404 logo/title remains a Home link without adding visible UI absent from Figma.
- Responsive: desktop frame is the supplied source of truth; below 860px the decorative logo column collapses, and below 560px the form padding contracts to avoid clipping/overflow.
- Flow verification: Login empty-submit validation passed; Login → Sign Up passed; catch-all 404 → Home passed. Desktop screenshots were compared with all four Figma frames in the read-only UI.
- Technical verification: `npm run lint` passed; `npm run build` passed (including `tsc -b`); no unit-test script exists. Runtime console has no errors and only the two pre-existing React Router v7 future-flag warnings. Existing large-chunk build warnings remain outside this batch.
- Figma access: the four `get_design_context` calls returned the same misleading edit-access message (debug UUIDs `255296cc-67ad-4134-88ba-3cc541a8e511`, `46c96259-e2dd-473b-9268-4802d9db6ada`, `23835bae-a583-482f-a0cc-fa3c62e09c52`, `a0e3586b-570e-46f1-9648-824593a63308`). Confirmed `Can view` access for `maihoangxuan25052004@gmail.com` remained valid, so design inspection continued through Figma's read-only Layers/canvas UI. No Figma write operation was used.

### Batch 3 — complete Home, palette, and Lab sidebar variants

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`; nodes read: `2371:19`, `2347:532`, `2350:3190`, `2350:3677`.
- Mapping: `/` → `HomePage` + shared `Header`; all `/lab0`…`/lab8` routes → existing `LabLayout` + `CourseSidebar`. The sidebar URLs are collapsed/expanded states of one shared component, not separate pages.
- Files changed: `src/pages/HomePage.jsx`, `src/components/layout/Header.jsx`, `src/components/layout/CourseSidebar.jsx`, `src/index.css`, and this UI map. Components/assets created: none.
- Shared components reused/modified: exact `logo.svg`, `icon 1.svg`, `Header`, `CourseSidebar`, `LabLayout`, and the existing `LABS` data. Added shared CubeSat palette tokens; removed random render-time lesson durations in favor of stable display values.
- Presentation: complete gradient Home hero and metrics, 3×3 curriculum grid, bottom CTA, compact Figma header, light-blue Lab rail, dark-blue expanded sidebar, active lesson state, and toggle between sidebar variants.
- Business/flow: Home → Lab 0, Home cards → corresponding Lab, Lab 0 ↔ Lab 1, overview → documentation, sidebar collapse → expand, Home return, Web Serial, auth/profile/logout and progress handlers remain intact.
- Responsive: Home grid is 3/2/1 columns; mobile headline/metrics are constrained; Lab navigation becomes the 58px rail below 860px. Desktop and 768px visual QA performed.
- Verification: lint and production build passed; browser runtime and console checked. No unit-test script exists. Only existing React Router future-flag and large-chunk warnings remain. The FE-only Lab documentation check logged an expected proxy refusal because FastAPI was not running in that isolated verification session; the UI fell back to its existing “Tài liệu đang được cập nhật...” state.
- Figma access: `whoami` confirmed `maihoangxuan25052004@gmail.com`. Design-context, metadata, and screenshot endpoints returned the same tool-specific Edit gate despite working `Can view`; canvas/Layers read access was used instead. No write-to-Figma operation was performed.

### Batch 4 — Lab 0 learning states and shared workspace

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`; nodes read: `2344:80`, `2349:918`, `2349:1241`, `2349:1712`.
- Mapping: `/lab0` remains one route and one `LabLayout`; nodes `2344:80`, `2349:1241`, and `2349:1712` are the three local lesson states, while `2349:918` supplies the repeated workspace presentation. No duplicate route or page was created.
- Files changed: `src/components/layout/LabLayout.jsx`, `src/components/interactive/ComponentViewer.jsx`, `src/pages/Lab0.jsx`, `src/index.css`, and this UI map.
- Shared components reused: `Header`, `CourseSidebar`, `VideoPlayer`, `DocViewer`, and existing CubeSat tokens. Shared component modified: `LabLayout` gained an isolated Lab 0 presentation variant; Lab 1–8 rendering paths remain unchanged. Local component modified: `ComponentViewer`. Components/assets created: none.
- Presentation: light-blue radial/linear learning canvas, rounded inset workspace, state badge, `LAB 0.1/0.2/0.3` titles, objective placeholder, documentation surface, and the Lab 0.3 two-column subsystem explorer. Existing live video/document/component data is preserved.
- State and flow: overview → documentation → component explorer; subsystem selection updates the live detail/specification panel; Lab 0 → Lab 1 → Lab 0 resets to the overview as before. Authentication progress writes remain attached to overview/document activation.
- Responsive: desktop uses the expanded course sidebar; below 860px it uses the 58px rail. Workspace heights adapt to viewport height, and the component explorer stacks below 560px without horizontal overflow. Desktop runtime and 768px tablet visual QA were performed.
- Verification: lint and production build passed; runtime console has no errors and only the existing React Router v7 future-flag warnings. No unit-test script exists. The configured Lab 0 YouTube URL currently returns “This video is unavailable”; the application data source was intentionally not replaced by mock content.
- Remaining visual difference: the exact Figma play/document/subsystem glyph exports were unavailable through the structured read endpoint, so existing semantic glyphs are used while layout, hierarchy, color, spacing, and states follow the canvas reference.
- Figma access: account `maihoangxuan25052004@gmail.com` was confirmed. `get_design_context`, metadata, and screenshot all returned the same tool-specific `INVALID_ARGUMENT` Edit gate despite working browser `Can view`; direct read-only canvas/Layers inspection was used. Design-context debug UUIDs: `c463486b-29e0-4b60-92f5-693864429043`, `3cd76750-cfa1-4762-93b6-ea59815cabc6`, `081f3da3-4b41-4fa1-886c-b1a148644c50`, `d04be147-6014-4dad-8ea1-9faf6c3db3e9`. No Figma write operation was performed.

### Batch 5 — Lab 1 learning and practice states

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`; nodes read: `2350:3408`, `2350:3625`, `2350:4035`, `2350:4587`.
- Mapping: `/lab1` remains one route and one `LabLayout`; nodes `2350:3408`, `2350:4035`, and `2350:4587` are its overview, documentation, and practice states. Node `2350:3625` is the shared workspace composition, not a separate route.
- Files changed: `src/pages/Lab1.jsx`, `src/components/layout/LabLayout.jsx`, `src/components/editor/IDEPanel.jsx`, `src/components/editor/BlocklyEditor.jsx`, `src/components/common/TabPanel.jsx`, `src/components/serial/CloudCompiler.jsx`, `src/components/serial/WebFlasher.jsx`, `src/components/serial/SerialMonitor.jsx`, `src/index.css`, and this UI map.
- Shared components reused: `Header`, `CourseSidebar`, `VideoPlayer`, `DocViewer`, `IDEPanel`, `BlocklyEditor`, `MonacoEditor`, `SerialMonitor`, `CloudCompiler`, `WebFlasher`, and the existing CubeSat tokens. Shared components were extended with opt-in workspace variants/props so Lab 2–8 retain their default rendering. Components/assets created: none.
- Presentation: Lab 1.1 reuses the video/objective learning shell; Lab 1.2 uses the documentation shell; Lab 1.3 adds the split editor/Serial workspace, C++ as its Figma-default tab, and a centered action bar for compile, flash, connect, and clear. Existing live compiler, flasher, Web Serial, code, and terminal state remain connected.
- State and flow: overview → documentation → practice; Blockly ↔ C++; terminal clear; Lab 1 → Lab 0 → Lab 1 resets to overview. The hardware connection button was not invoked during automated QA because the browser requires a real user-selected serial device.
- Responsive: expanded desktop sidebar becomes the 58px rail below 860px; Lab 1.3 editor/Serial panels stack below 860px and actions wrap below 560px. Desktop runtime and 768px tablet visual QA passed without horizontal overflow.
- Verification: `npm run lint` and `npm run build` passed; the build includes TypeScript checking. Browser runtime, affected routes, state transitions, Monaco/Blockly tabs, shared Lab 2 default rendering, and console were checked. No unit-test script exists. Only the existing React Router v7 future-flag and large-chunk warnings remain. The isolated FE-only documentation check logged an expected proxy refusal because FastAPI was not running; the existing documentation fallback rendered correctly.
- Remaining visual difference: exact Figma workspace glyph exports were unavailable through structured reads, so existing semantic glyphs are retained. The Serial command input remains visible to preserve the application's live command-sending workflow even though the static Figma frame emphasizes only monitor output and actions.
- Figma access: `whoami` confirmed `maihoangxuan25052004@gmail.com` with working browser `Can view`. `get_design_context`, metadata, and screenshot returned the same tool-specific `INVALID_ARGUMENT` Edit gate; direct read-only canvas/Layers inspection was used. Design-context debug UUIDs: `1ca100e5-acc0-42d9-94b2-4fbbebac3d45`, `da5eec76-51f9-4022-9830-bc3251af190e`, `ea5a92c1-a2e3-4fd2-883f-4cea91eaab13`, `569d8880-7403-41f8-8737-2047f83aa016`. No Figma write operation was performed.

### Batch 6 — Lab 2 learning, practice, and Lab header

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`; nodes read: `2350:4318`, `2375:218`, `2375:418`, `2368:1732`.
- Mapping: `/lab2` remains one route and one `LabLayout`. Node `2350:4318` is Lab 2.1; `2375:218` is the repeated learning workspace; `2375:418` is the shared header state used alongside the Lab sidebar; `2368:1732` supplies the Lab 2.3 split practice composition. No duplicate page or route was created.
- Files changed: `src/App.jsx`, `src/components/layout/Header.jsx`, `src/components/layout/LabLayout.jsx`, `src/pages/Lab2.jsx`, `src/index.css`, and this UI map.
- Shared components reused: `CourseSidebar`, `VideoPlayer`, `DocViewer`, `IDEPanel`, `BlocklyEditor`, `MonacoEditor`, `SerialMonitor`, `CloudCompiler`, `WebFlasher`, and `SerialContext`. Shared components modified: `Header` gained a route-scoped Lab variant; `LabLayout` extended its existing learning/practice variants to Lab 2. Components/assets created: none.
- Presentation: Lab 2.1 uses the pale-blue video/objective canvas with the exact EPS title; Lab 2.2 uses the documentation surface; Lab 2.3 uses the C++/Blockly and Serial split workspace with compile, flash, connect, and clear actions. On Lab routes, the header now starts beside the full-height sidebar, keeps search and live auth/Serial state, and follows the compact notification/message/user composition from the Figma detail.
- Business behavior: compiler requests continue to use `labId=2`; flashing, Web Serial connect/disconnect, terminal clear, editor state, auth progress writes, navigation, and documentation fallback remain unchanged.
- Flow verification: Lab 2.1 → Lab 2.2 → Lab 2.3; sidebar collapse → expand; Lab 2 → Lab 1; Lab 2 → Lab 3; Home header regression. Lab 3 retained its default non-Figma practice composition. Hardware Serial connection was not invoked because it requires a real user-selected device.
- Responsive: the Lab header and content offset follow the 248px expanded sidebar and the 58px collapsed/tablet rail. At 768px the search hides conservatively, controls remain usable, and content has no horizontal overflow. Desktop and 768px visual QA passed.
- Verification: `npm run lint` and `npm run build` passed; the build includes TypeScript checking. Runtime, route transitions, sidebar states, Monaco rendering, shared-component regression, and console were checked. No unit-test script exists. Only existing React Router v7 future-flag and large-chunk warnings remain. The FE-only documentation request used the existing fallback while FastAPI was not running.
- Remaining visual difference: node `2368:1732` visibly retains a copied `LAB 1.3` title despite being named LAB 2.3; code renders the route-correct dynamic `LAB 2.3` to preserve content/data integrity. Exact notification/message glyph assets were unavailable through the structured endpoint, so compact semantic CSS glyphs are used while dimensions, placement, color, and grouping follow the Figma header.
- Figma access: direct browser access remained read-only and the canvas showed `View only`; previously confirmed account is `maihoangxuan25052004@gmail.com` with `Can view`. In this batch `get_design_context`, metadata, screenshot, and `whoami` all failed at the connector transport layer with `HTTP 404`, while the same node URLs opened successfully in the read-only Figma canvas. Suspected cause is a tool/connector endpoint failure, not missing file access and not a need for Edit permission. No write-to-Figma operation was performed.

### Batch 7 — Lab 3–8 learning and practice expansion

- Figma source: no new node URLs were supplied for Lab 3–8. The implementation conservatively extends the verified Lab learning/workspace language from nodes `2350:4318`, `2375:218`, `2375:418`, and `2368:1732`; no claim of exact frame parity is made for these six labs.
- Mapping: `/lab3`…`/lab8` remain their existing routes and page modules. Each route keeps the three shared lesson states in `LabLayout`; Lab 3–7 use the new `rich` practice composition, and Lab 8 uses the wider `dashboard` composition for React Grid Layout.
- Files changed: `src/main.jsx`, `src/components/layout/LabLayout.jsx`, `src/components/editor/LabPracticeActions.jsx`, `src/pages/Lab1.jsx`…`src/pages/Lab8.jsx`, `src/index.css`, and this UI map.
- Shared components reused: `CourseSidebar`, `Header`, `VideoPlayer`, `DocViewer`, `IDEPanel`, `BlocklyEditor`, `MonacoEditor`, `CloudCompiler`, `WebFlasher`, `SerialMonitor`, and every existing domain visualization. Shared components modified: `LabLayout` gained `split`, `rich`, and `dashboard` practice variants. Shared component created: `LabPracticeActions` removes repeated compiler/flasher/Serial controls. No design token was added.
- Presentation: Lab 3–7 pair a sticky, bounded editor with vertically flowing visualization cards; actions stay attached to the editor instead of falling below a tall result column. Lab 8 stacks a full-width editor over Dashboard Builder. Command presets and System Check results now use coherent card/button styling instead of browser defaults.
- Business behavior: per-lab code state, Blockly/C++ tabs, compiler `labId`, firmware flashing, Web Serial lifecycle, command sending, telemetry, charts, GPS, camera, 3D attitude, system checks, and dashboard widgets remain live. React Strict Mode was removed from the root because its development-only double mount disposed Monaco/Leaflet/Three instances and caused a blank Lab 4/7 practice page; production behavior is unchanged.
- Flow verification: Lab 3 → 4 → 5 → 6 → 7 → 8, overview → practice on each sampled route, Monaco rendering, Lab 4/7 GPS and 3D lifecycle, Lab 5 telemetry/commands, Lab 6 system checks, and Lab 8 dashboard rendering. Hardware connect/flash/compile actions were not invoked because they require a real device or backend operation.
- Responsive: rich workspaces stack editor/actions/results below 860px; Dashboard Builder remains full-width beneath its editor; compact controls wrap below 560px. Desktop and tablet/headless narrow-layout visual checks were performed.
- Verification: `npm run lint` and `npm run build` passed before final documentation; build includes TypeScript checking. No unit-test script exists. Runtime no longer crashes when entering Lab 4 or Lab 7 practice. Remaining warnings are React Router v7 future flags, Three.js `Clock` deprecation, and the existing large visualization chunks.
- Remaining: exact Lab 3–8 Figma frames were not provided, so composition is an intentional design-system extrapolation. Widget internals retain their current copy and live data contracts pending dedicated Figma nodes.
- Figma access: no new Figma read or write operation was needed for this continuation. Existing `Can view` access remains sufficient; no Edit permission was requested.

### Batch 8 — Lab header refinement and optimization

- Figma file: `YroN1K0rfWaWJU6U8FYhdK`; node inspected: `2375:418`. The supplied current/Figma screenshots were used for the final side-by-side visual comparison.
- Mapping: shared `Header` on `/lab0`…`/lab8`; no new page, route, or duplicate header was created.
- Files changed: `src/components/layout/Header.jsx`, `src/index.css`, and this UI map.
- Shared components reused/modified: the existing `Header`, `AuthContext`, `SerialContext`, route detection, and CSS design tokens. Components/assets/dependencies created: none.
- Presentation: the Lab search field is 350×36px with the Figma `Search` placeholder; the right cluster follows bell → message/Serial → divider → profile → dynamic name → chevron. CSS-native glyphs replace the former placeholder dot/ellipsis controls, and the signed-in account uses a compact native details menu for Profile and Logout.
- Business behavior: the message-shaped control retains the existing Web Serial connect/disconnect handler and exposes connection state through its status dot, accessible label, and title. Authentication data remains dynamic; anonymous users see `Đăng nhập`, while signed-in users see `full_name` or email. Home navigation, profile, logout, routing, and Serial state were not replaced or mocked.
- Responsive and flow verification: desktop expanded sidebar (248px) → collapsed rail (58px) → expanded sidebar; header offset and content alignment follow both states after the 300ms transition. At narrow breakpoints search/name/chevron hide conservatively while controls remain reachable. Home header regression passed.
- Technical verification: `npm run lint` and `npm run build` passed; the build includes `tsc -b`. Runtime checks of `/lab2` and `/` passed with no console errors. No unit-test script exists. Existing bundle-size warnings remain outside this batch.
- Remaining visual difference: exact Figma icon/vector exports were unavailable through the structured read connector, so the bell, message, and generic profile glyphs are code-native CSS shapes matched to the supplied screenshot.
- Figma access: `whoami` confirmed `maihoangxuan25052004@gmail.com`; browser `Can view` remains valid. Read-only `get_design_context`, metadata, screenshot, and asset-download operations returned the same misleading Edit gate (debug UUIDs `f9875919-93b6-48cd-aa5a-8b5bd0282774`, `b6bfdbf2-5a96-46b4-b611-8f22395d9f0d`, `0b378051-119b-48a5-8d62-415a66b00535`, `943aad2d-5433-45a8-b5eb-5ba7236e1670`). This is treated as a connector-specific read failure, not evidence that Edit permission is required. No write-to-Figma operation was performed.

### Audit 1 — cross-page responsive, accessibility, and token hardening

- Scope: Home, Login, Sign Up, 404, and Lab 0–8 at desktop 1280px, tablet 768px, and mobile 390px. This is a code-quality/UI audit, not a new Figma batch.
- Files changed: `src/App.jsx`, `src/components/layout/Header.jsx`, `src/components/layout/LabLayout.jsx`, `src/index.css`, and this UI map.
- Navigation fix: below 860px, where the full course menu is intentionally hidden, `LabLayout` now exposes a sticky three-state lesson switcher. It reuses the existing `activeLesson` state and progress effects, restoring access to Overview → Documentation → Practice/Components on tablet and mobile.
- Design-system fix: added compatibility aliases for visualization/tooling tokens (`--border-primary`, `--bg-primary`, `--bg-tertiary`, accent glows, spacing, radii, and small type). This restores previously invalid CSS declarations in Camera, GPS, telemetry, command, compiler/flasher, and Dashboard Builder surfaces without introducing a second theme.
- Accessibility/interaction: added a keyboard skip link and semantic `<main>`, a visible shared focus ring, reduced-motion and reduced-transparency fallbacks, a named mobile login control, 36–40px compact touch targets, and a 40px password-visibility control. The redundant Home icon is hidden on narrow screens because the visible logo already provides the same navigation intent.
- Runtime verification: all public routes loaded without console errors or horizontal overflow. Lab 4 and Lab 8 practice states were exercised through the new mobile/tablet switcher; Dashboard grid and palette borders resolve to valid computed colors. Auth and Home mobile visual checks passed.
- Technical verification: `npm run lint`, `npm run build` (including `tsc -b`), unresolved active CSS-token audit, and `git diff --check` passed. No unit-test script exists. Existing React Router future-flag and large visualization bundle warnings remain.

## Pending Figma batches

### Batch 1 — node `2350:3633`

- File: `YroN1K0rfWaWJU6U8FYhdK`.
- URL: `https://www.figma.com/design/YroN1K0rfWaWJU6U8FYhdK/CUBESAT?node-id=2350-3633`.
- Status: pending as a separate batch. The connected account has confirmed view access, but the structured MCP read endpoints currently apply an edit-access gate.
- Next attempt: retry structured read operations and use the direct read-only Figma UI for permission diagnosis; never request edit access solely for design-to-code reading.

## Batch update checklist

For every completed Figma batch, append:

- Implemented node(s), route(s), and states.
- Files and shared components changed.
- New or mapped design tokens and committed assets.
- Impact checks across all usages of changed shared components.
- Lint, typecheck, tests, build, runtime, responsive, and visual comparison results.
- Any remaining visual difference and its reason.
