# Design system: editorial motion redesign

The redesign gives FirstSteps an editorial, data-on-paper visual language. It was informed by the structure of an editorial design-system reference (Refero "Ventriloc" style): light display type, generous whitespace, alternating surface bands, a floating pill navigation, cut-corner cards and very restrained accent colour. No branding, text, assets or layouts of that company were copied. Every pattern was translated to the FirstSteps palette and to its real product: arrival tasks, prerequisites, sources and mentor help.

## 1. Audit of the previous interface (Alpha v0.0.1)

| Problem | Effect | Change |
|---|---|---|
| The landing page was one dark hero, a three-column list and a four-item feature grid | It did not explain how the product works or show the product itself | New landing page with eight sections, a product preview built from real UI pieces, and an interactive dependency demo |
| Bold serif headings (Fraunces 600) on every screen | Heavy, generic "SaaS" feel; long Turkish words wrapped badly | Inter Tight 300/400 for display text with tight tracking; Inter for UI text |
| One radius (12 px) on every element | No hierarchy between actions, cards and navigation | Three radii: 3 px actions, cut-corner cards (`.shape-cut`), round navigation pills |
| Surfaces were ivory, card and forest only | Sections ran together | Paper canvas, ivory bands, a darker featured wash and deep-forest bands |
| Ochre used for both text and decoration | Ochre text fell below 4.5:1 on darker surfaces | `--gold` (text-safe ochre, ≥ 4.9:1 on every light surface) separated from `--ochre` (brand ochre for rules, strokes and large figures) |
| Task list was a set of separate tables | The journey did not read as a journey | Stage timeline with a rail, stage stations and per-stage progress |
| Progress track invisible on ivory bands | Empty progress looked like missing content | Visible track (`band-strong`) and forest indicator |

## 2. Tokens

Defined in [`src/app/globals.css`](../src/app/globals.css) for light and dark themes.

| Role | Light | Dark |
|---|---|---|
| Canvas `--background` | `#F5F4EE` | `#15261B` Deep Forest |
| Band `--band` | `#EEEDE4` Warm Ivory | `#1A2E21` |
| Featured wash `--band-strong` | `#E6E2D5` | `#203826` |
| Card `--card` | `#FBFAF6` | `#1C3123` |
| Text `--foreground` | `#15261B` | `#EEEDE4` |
| Secondary text `--foreground-soft` | `#3D4A40` | `#D3CDBB` |
| Muted text `--muted-foreground` | `#5C5848` | `#B9AC95` |
| Accent text `--gold` | `#7A5A1F` | `#C9A15A` |
| Brand ochre `--ochre` | `#886424` | `#C9A15A` |
| Primary action | Deep Forest on ivory | Ivory on Deep Forest |
| Hairline `--hairline` | forest at 10 % | ivory at 9 % |

Contrast was computed for every text token on every surface it is used on (minimum 4.9:1 for body text). Deep-forest bands (demo, final CTA, auth panel, "next step" card) use the `dark` class locally. The dark token set then applies inside them in both themes, so their contrast is the same as in the dark theme.

**Type.**
- `text-display`: fluid 44–100 px, line height 0.96, tracking −0.035 em.
- `text-headline`: 34–64 px.
- `text-title`: 28–40 px, used for page titles.
- `text-lead`: 17–21 px.
- `eyebrow`: Geist Mono, 12 px, uppercase, 0.14 em tracking.
- Display type uses weight 300–400, never bold.

**Layout.**
- Pages are 80 rem (1280 px) wide.
- Landing sections have 96–160 px vertical rhythm.
- Admin and student screens keep the 76 rem app column.

## 3. Motion

| Where | Library | What | Reduced motion |
|---|---|---|---|
| Hero headline and intro | CSS (server-split words) | Words rise from masks, then intro and CTAs fade up; starts at first paint, independent of JavaScript | Static |
| Section headings | React Bits SplitText (adapted) + GSAP SplitText | Masked line/word rise when scrolled into view; `aria: "auto"` keeps the sentence for screen readers | Not split |
| Section content | GSAP ScrollTrigger (`RevealScope`) | Batched fade-and-rise, rules drawn left to right | Visible immediately |
| How it works | GSAP ScrollTrigger (`StepsRail`) | Scrubbed ochre rail; the step in the reading zone highlights its number | Rail filled |
| Product preview | GSAP timeline | Window, panels and rows assemble; the next task completes and progress moves 6 → 7 of 14 | Final state shown |
| Dependency demo | React state + GSAP | Mark pops, connector draws, the unlocked task lifts | State changes only |
| Support flow | GSAP timeline | Question → assigned → answer → answered | Final state shown |
| Feature cards | React Bits SpotlightCard (adapted) | Pointer/focus light in ochre | Light follows without easing |
| Navigation | GSAP + CSS | Entrance; sliding active-section indicator | Static |
| Smooth scrolling | Lenis on the landing page only | Driven by the GSAP ticker (one rAF loop), synced with ScrollTrigger, anchor offset for the floating nav, paused while a dialog is open | Not started |

Rules:
- GSAP is imported only through [`src/components/motion/gsap.ts`](../src/components/motion/gsap.ts) in client components. Every animation uses `useGSAP` with a scope and a `gsap.matchMedia()` reduced-motion branch, so timelines and triggers are reverted on unmount.
- Only `transform` and `opacity` are animated. Reveals never use `visibility`, so content that has not been scrolled into view is still in the accessibility tree.
- Content is visible without JavaScript. Elements are hidden before animation only under `html.js` (set before paint) with motion allowed, and a CSS failsafe shows them after 2.5 s if a script never runs.
- Lenis is not used in the application. Task lists, forms, admin tables, dialogs and mentor queues keep native scrolling.
- Motion plays once and stops; nothing loops (WCAG 2.2.2).

## 4. Third-party components

- React Bits `SplitText` and `SpotlightCard` were copied from the React Bits registry and adapted. The changes are listed at the top of each file. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
- `BlurText` was not used because it needs the `motion` library, which would duplicate GSAP.
- WebGL or shader-based effects were not used.

## 5. Performance

Measured with [`scripts/perf.mjs`](../scripts/perf.mjs) against the local production build (Microsoft Edge, no network throttling):

| Page | Viewport | LCP | CLS |
|---|---|---|---|
| Landing | Desktop 1440 px | 300 ms | 0.001 |
| Landing | Mobile 390 px, 4× CPU slowdown | 316 ms | 0.000 |
| Sign in | Desktop / mobile | 148 / 176 ms | 0.000 |

- GSAP, ScrollTrigger, SplitText and Lenis are bundled into one chunk of 172 KB raw / 62 KB gzip. It is loaded only on the landing page; sign-in, student, mentor and admin pages do not request it.
- Before the hero was moved to CSS animation, the landing LCP was 924 ms (desktop) and 1508 ms (mobile 4×), because the headline waited for hydration.
- These are local lab numbers, not field data.

## 6. Verification

- `npx playwright test landing`: dependency demo rules, nothing persisted, anchor navigation and active state, mobile menu, no overflow at 360 px, reduced-motion visibility.
- `accessibility.spec.ts`: axe-core on the landing page after motion settles and with reduced motion, plus every role page, in English and Turkish, light and dark.
- `node scripts/screenshots.mjs`: full-page captures at 360, 390, 768, 1024, 1280, 1440 and 1920 px in both languages and themes, with a horizontal-overflow report. All 28 combinations reported no overflow.
- `CAPTURE=1 npx playwright test visual`: captures of student, mentor, admin and auth screens. A curated set is in [screenshots/redesign](screenshots/redesign).
