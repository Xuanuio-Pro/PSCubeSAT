---
name: CubeSAT — PTIT LMS
description: Aerospace engineering laboratory and classroom LMS for CubeSat 1U hardware and simulation
colors:
  cubesat-navy: "#0a4174"
  brand-primary: "#0ea5e9"
  brand-primary-dark: "#0284c7"
  text-link: "#0369a1"
  cubesat-ink: "#001d39"
  text-body: "#1d3b58"
  text-muted: "#415e78"
  bg-app: "#f4f9fd"
  bg-surface: "#ffffff"
  bg-surface-subtle: "#f2f8fd"
  bg-surface-hover: "#eaf3fb"
  bg-code: "#071526"
  border-subtle: "#d5e4f0"
  border-strong: "#b8d0e4"
  status-success-text: "#146c32"
  status-success-bg: "#dcfce7"
  status-warning-text: "#92400e"
  status-warning-bg: "#fef3c7"
  status-danger-text: "#9f1239"
  status-danger-bg: "#ffe4e6"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.85rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "JetBrains Mono, 'Fira Code', monospace"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cubesat-navy}"
    textColor: "{colors.bg-surface}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.brand-primary-dark}"
  button-secondary:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.cubesat-navy}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  card-panel:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.lg}"
    padding: "26px 28px"
---

# Design System: CubeSAT — PTIT LMS

## Overview

**Creative North Star: "The Orbital Engineering Lab Bench"**

CubeSAT — PTIT LMS pairs bright, high-clarity daytime lab surfaces with deep aerospace navy anchors and dark-bay telemetry consoles. It serves university students programming physical CubeSat 1U kits over Web Serial alongside instructors managing class cohorts, prerequisites, and Lab Tests. Visual authority comes from technical precision, clear tabular telemetry, and unmistakable status wayfinding rather than decorative marketing chrome.

Every surface balances approachable academic structure with ground-station rigor: reading documents and class administration live on cool sky-tinted daylight cards (`#ffffff` over `#f4f9fd`), while curriculum navigation (`#0a4174`) and firmware/serial workspaces (`#071526`) provide high-contrast dark framing.

**Key Characteristics:**
- Daylight-first academic surfaces tinted toward aerospace blue (`#f4f9fd` to `#ffffff`), never washed-out pure gray.
- Deep Orbital Navy (`#0a4174`) and Deep Telemetry Bay (`#071526`) structural anchors for navigation, code, and serial logs.
- Tabular numeric discipline (`font-variant-numeric: tabular-nums`) across timers, telemetry readouts, scores, and lab progress.
- Full-perimeter `1px` semantic borders on cards and notices—never thick left/right accent stripes.

## Colors

The palette is anchored in deep orbital navy and sky cyan, with every neutral surface and secondary text token tinted toward cool aerospace blue (~205°–212° hue) to maintain visual harmony and WCAG AA contrast.

### Primary
- **Orbital Navy** (`#0a4174`): Structural brand anchor used for the course navigation drawer, active lab rail badges, primary action gradients, and focus outlines.
- **Sky Telemetry Cyan** (`#0ea5e9`): Primary interactive accent used in primary button gradients, active progress bars, and focus glow rings.
- **Deep Sky Action** (`#0284c7`): Hover and focus border accent for interactive controls.
- **Accessible Link Blue** (`#0369a1`): High-contrast (`5.93:1` on white) interactive text link and kicker label color.

### Secondary
- **Telemetry Emerald** (`#146c32` text on `#dcfce7` surface): Indicates live telemetry links, completed lessons, and active class memberships.
- **Amber Caution** (`#92400e` text on `#fef3c7` surface): Indicates in-progress labs, draft/pending states, stale telemetry frames, and prerequisite lock reasons.
- **Crimson Alert** (`#9f1239` text on `#ffe4e6` surface): Indicates locked accounts, compilation/flash errors, and destructive confirmations.

### Neutral
- **Deep Space Ink** (`#001d39`): Primary heading and high-emphasis data readout color (`17.4:1` on white).
- **Navy Slate Body** (`#1d3b58`): Default prose and table body copy color (`11.2:1` on white).
- **Tinted Steel Muted** (`#415e78`): Secondary metadata, captions, timestamps, and unit labels (`6.58:1` on white, `5.82:1` on `#eaf3fb`).
- **Daylight Mist Canvas** (`#f4f9fd`): Root application background canvas paired with soft sky radial gradients.
- **Telemetry Bay Dark** (`#071526`): Dark surface reserved for C++ code blocks, serial monitors, and firmware logs.

### Named Rules
**The Tinted Neutral Rule.** Never use pure untinted grays (`#64748b`, `#e2e8f0`) on aerospace-tinted cards; all neutrals carry a cool navy undertone so text and borders belong to the same light source.

**The Text-Link Contrast Rule.** Never use `#0ea5e9` for body-sized text on light backgrounds (`2.77:1`); always use `--text-link` (`#0369a1`, `5.93:1`) or `--cubesat-navy` (`#0a4174`, `10.3:1`).

## Typography

**Display Font:** Inter (with `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` fallback)
**Body Font:** Inter (with system sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with `'Fira Code', monospace` fallback)

**Character:** Clean, high-x-height Vietnamese-complete sans-serif paired with a crisp technical monospace for C++ firmware, GPIO pins, NMEA sentences, and telemetry units.

### Hierarchy
- **Display** (`800`, `clamp(1.85rem, 4.3vw, 3.85rem)`, `1.1`): Hero titles on the home portal.
- **Headline** (`800`, `clamp(1.75rem, 2.8vw, 2.35rem)`, `1.25`): Page-level titles across LMS class views and lab workspaces.
- **Title** (`700`, `1.2rem`, `1.35`): Section panels, modal headers, and lab card titles.
- **Body** (`400`–`500`, `0.95rem`–`1.02rem`, `1.65`–`1.78`): Lesson documentation and operational instructions, constrained to `65ch`–`78ch` for reading comfort.
- **Label** (`600`–`700`, `0.78rem`, `0.02em`): Status badges, telemetry channel tags, and table column headers.

### Named Rules
**The Tabular Telemetry Rule.** Every live counter, countdown clock, sensor reading, percentage, and lab index badge must declare `font-variant-numeric: tabular-nums` so digits never jitter during updates.

## Layout

The application uses two primary spatial shells:
1. **LMS Management Shell (`.lms-shell`)**: Centered container (`width: min(1240px, 100%)`, `padding: 32px clamp(18px, 3.5vw, 40px) 72px`) with horizontal navigation pills (`.lms-nav`), page header card (`.lms-heading`), and stacked `.lms-panel` sections.
2. **Interactive Lab Player Shell (`.player-layout` / `.class-player-layout`)**: Full-viewport split workspace (`height: calc(100dvh - 76px)`) combining a collapsible two-tier left rail (`74px` icon rail + `276px` curriculum drawer on `#0a4174`) with a fluid main workspace (`.lab-course-view`) that adapts between 16:9 video, reading docs, and split IDE + 3D/telemetry visualization panels.

Responsive breakpoints at `1100px`, `860px`, `760px`, and `560px` collapse multi-column grids to single-column stacks and convert the curriculum drawer into a sticky mobile lesson bar (`.lab-mobile-lessons`).

## Elevation & Depth

Depth is communicated through translucent daylight surfaces (`rgba(255, 255, 255, 0.94)` with `backdrop-filter: blur(10px)`), crisp `1px solid` sky-tinted borders (`#d5e4f0`), and soft navy-tinted ambient shadows (`rgba(10, 65, 116, 0.07)`).

### Shadow Vocabulary
- **Surface Card Rest** (`box-shadow: 0 10px 28px -6px rgba(10, 65, 116, 0.07)`): Default elevation for `.lms-panel` and `.lms-class-row` containers.
- **Interactive Hover Lift** (`box-shadow: 0 12px 24px -4px rgba(14, 165, 233, 0.35)`): Applied with `translateY(-1px)` on primary action buttons.
- **Code Bay Inset** (`box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.45)`): Recesses C++ code blocks and serial logs into the page.

### Named Rules
**The Perimeter Border Rule.** Every card, callout, and status banner uses a uniform `1px solid` perimeter border paired with a subtle background tint—never a thick `3px` or `4px` `border-left` stripe.

## Shapes

Corners follow a smooth hierarchy scaled to component size:
- **Small controls & badges**: `8px`–`10px` radius for buttons, inputs, and code snippets; `999px` pill radius for status badges (`.lms-status`) and navigation back-links.
- **Content cards & panels**: `14px`–`18px` radius for `.lms-panel`, `.quiz-question`, and `.lms-table-wrap`.
- **Workspace stages**: `24px`–`30px` radius for `.lab-workspace`, `.doc-content`, and `.home-hero`.

## Components

### Buttons
- **Shape:** Rounded rectangle (`10px`–`12px` radius), minimum height `42px`–`44px`.
- **Primary (`.lms-primary`, `.btn-primary`):** Linear gradient `linear-gradient(135deg, #0a4174 0%, #0d6db7 55%, #0ea5e9 100%)` with white bold text (`600`).
- **Hover / Focus:** Lifts `translateY(-1px)` with deepened navy-sky gradient (`#08355e` → `#0284c7`) and `2px` focus-visible outline.
- **Secondary:** White surface (`#ffffff`) with `1px solid #b8d0e4` border and `#0a4174` text; shifts to `#eaf3fb` on hover.

### Chips
- **Style (`.lms-status`):** Pill (`999px`), `5px 12px` padding, `0.78rem` bold text with a `7px` circular leading status dot (`::before`).
- **State:** Semantic role variants for `.active` (emerald), `.draft` / `.pending` (amber), `.locked` (crimson), and `.archived` (tinted steel neutral).

### Cards / Containers
- **Corner Style:** `18px` radius on `.lms-panel`; `24px` on `.doc-content`.
- **Background:** `rgba(255, 255, 255, 0.94)` with `1px solid #d5e4f0`.
- **Shadow Strategy:** Soft navy-tinted drop shadow (`0 10px 28px -6px rgba(10, 65, 116, 0.07)`).
- **Internal Padding:** `26px 28px` on desktop, `18px` on mobile (`≤ 640px`).

### Inputs / Fields
- **Style:** `44px` minimum height, `9px 14px` padding, `10px` radius, `#ffffff` background, `1px solid #b8d0e4` border, `#001d39` text.
- **Focus:** `#0284c7` border with `0 0 0 3.5px rgba(14, 165, 233, 0.15)` focus ring.
- **Error / Disabled:** Linked via `aria-invalid` and `aria-describedby` to a `.lms-error` / `role="alert"` message.

### Navigation
- **Two-Tier Lab Sidebar (`.player-sidebar`):** Left `74px` light sky rail (`#e5eff8`) for Lab 0–8 switcher badges + `276px` dark navy drawer (`#0a4174`) for accordion sections and `.sub-lesson-item` buttons (`active` white pill, `is-completed` mint `#b9f4d2`, `is-in-progress` amber `#ffe2aa`, `is-locked` muted `#c1d0db`).

## Do's and Don'ts

### Do:
- **Do** keep all user-facing UI labels, buttons, empty states, and error messages in clear, natural Vietnamese while keeping code identifiers and telemetry keys in English.
- **Do** use semantic status tokens (`--status-info-*`, `--status-success-*`, `--status-warning-*`, `--status-danger-*`, `--status-neutral-*`) for badges, banners, and telemetry indicators.
- **Do** maintain a minimum `42px`–`44px` touch/click target on interactive controls used in classroom labs.

### Don't:
- **Don't** add thick `border-left` or `border-right` accent bars (`> 1px`) to cards, callouts, quiz explanations, or notices.
- **Don't** use bounce or spring overshoot curves (`cubic-bezier(0.34, 1.56, 0.64, 1)`); use `--ease-out` (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
- **Don't** use English uppercase decorative kickers (`USER ACCESS`, `ADMIN ACCESS`, `TELEMETRY FEED`) above Vietnamese headings.
