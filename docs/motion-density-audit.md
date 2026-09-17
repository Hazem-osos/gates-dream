# Motion density + storyboard fidelity audit

**Date:** 14 Sep 2026  
**Scope:** homepage pins only. No new chapters.  
**Storyboards:** `ChatGPT Image Sep 14, 2026, 07_16_16 PM.png` (9-up) and `07_16_23 PM.png` (4-up).

Homepage pins today: Chaos → Opening → ProductScale (+ company-story coda) → Finale.  
Legacy pins (`CommandHingeJourney`, `HeroSystem`, `GatesAI`, …) are **not mounted** — left untouched.

Total desktop scroll before this pass: **~3000vh**. That is why the film feels broken.

---

## 1. Timeline math (before)

### 1.1 ChaosToSystemJourney

| | |
|---|---|
| Section height | **360vh desk / 280vh mob** (matches `CHAOS.*Vh`) |
| Timeline duration | ~1.0 (last tween ends ~0.72, then empty) |
| Scrub | 0.70 desk / 0.50 mob — slightly floaty for card drift |

| Range | What happens | vh desk | Verdict |
|---|---|---|---|
| 0–12% | Cards drift only | 43 | Weak start — questions wait too long |
| 12–28% | Questions + headline dim + drift | 58 | OK |
| 28–48% | Well / lines / chassis / cards converge | 72 | Good |
| 48–62% | “One system” line | 50 | OK |
| 62–72% | GATES word | 36 | OK |
| **72–100%** | **Nothing** | **101** | **DEAD** |

**Excess height:** 360vh for three beats. Readable in ~200vh.  
**Reverse:** safe (one timeline). Cards all collapse to `0,0` — visually weaker than storyboard Frame 02 (orbit).

### 1.2 OpeningJourney

| | |
|---|---|
| Section height | **920vh desk / 740vh mob** |
| Timeline duration | last real tween ~0.88 (`wordReact`) |
| Scrub | 0.72 desk / 0.55 mob — laggy on Save / stock tick |

| Range | What happens | vh desk | Verdict |
|---|---|---|---|
| **0–10%** | **Empty `tl.to({})` — no camera, no typography change** | **92** | **DEAD** |
| 10–16% | Cursor arrives | 55 | Thin |
| 16–21% | Save press + empty hold | 46 | Press is 0.035 of the pin |
| 21–26% | Composer dies; paper invoice pops; **instantly** shrinks to capsule | 46 | No physical transformation |
| 26–30% | Amount / CONFIRMED / “you act” | 37 | OK |
| **30–42%** | **Empty hold after sale** | **110** | **DEAD** |
| 42–52% | Capsule → inventory, 124→123 | 92 | OK but then holds |
| **52–58%** | Empty | 55 | Dead pause |
| 58–66% | Customer | 74 | OK |
| **66–72%** | Empty | 55 | Dead pause |
| 72–84% | Accounting / journal | 110 | OK |
| **88–100%** | **Nothing after POSTED** | **110** | **DEAD** |

Dead + empty holds ≈ **420vh** of 920vh (~46%).  
Invoice never occupies 45–60% of useful height. Capsule is a cut, not a morph. Paths are missing.

### 1.3 ProductScaleJourney (first pin)

| | |
|---|---|
| Pin distance | **740vh desk / 580vh mob** (`PRODUCT_SCALE.*Vh`) |
| Section height | **1400 / 1100** — remainder is the story coda |
| Scrub | 0.72 / 0.55 |

| Range | What happens | vh desk | Verdict |
|---|---|---|---|
| 0–4% | Empty | 30 | Dead |
| 4–10% | GATES word zoom | 44 | Good |
| 10–22% | Dashboard settle | 89 | OK, then 4% empty |
| 22–48% | Sales / inventory / accounting focus | 192 | Camera moves; charts do **not** draw |
| 48–58% | Margin pulse | 74 | Hold is empty |
| 58–66% | Question + **all five probes in ~0.09** | 59 | AI is a dump, not an investigation |
| **66–80%** | Answer sits; **no new motion** | **104** | **DEAD** |
| 80–100% | Pull to HQ + locations | 148 | OK |

Dashboard is large-ish (`92vw`) but reads as a floating card in empty air. AI is a chatbot panel + five chips — not Frame 04 / Frame 06.

### 1.4 Company-story coda (second pin on the same section)

| | |
|---|---|
| Pin distance | **660vh desk / 520vh mob** |
| Scrub | 0.72 / 0.55 |

| Range | What happens | vh desk | Verdict |
|---|---|---|---|
| 0–10% | Retail pulse + camera dive to POS | 66 | Extra chapter |
| 10–18% | Token / warehouse / journal | 53 | Replay of Opening |
| 18–28% | Warning + question | 66 | |
| 28–46% | Probe again | 119 | Second AI scene |
| **46–76%** | Draft / purchase / briefing **never play** — `opacity: 0` + empty tween to `briefingEnd` | **198** | **WORST DEAD RANGE ON THE SITE** |
| 76–100% | Live chips + OS line | 158 | This is the only beat we want |

The coda was shortened in a previous pass but the **phase gaps were left in**. That is ~200vh of “why am I scrolling?”

### 1.5 TransformationFinale

| | |
|---|---|
| Height | **320 / 260** |
| Scrub | 0.68 / 0.50 |

| Range | What happens | vh desk | Verdict |
|---|---|---|---|
| 0–8% | Industries static | 26 | Soft dead |
| 8–38% | Extract fades in | 96 | Long for a fade |
| 38–80% | Two title cards | 134 | Readable shorter |
| 80–100% | CTA | 64 | OK |

Not expanded this pass (no new industries / ending work). Height compressed only.

---

## 2. Scrub problems

| Pin | Now | Issue | Proposed |
|---|---|---|---|
| Chaos | 0.70 | Drift feels late | **0.55** desk / **0.40** mob |
| Opening — Save, stock, journal | 0.72 | Detached from the wheel | **0.45** on the pin (small interactions need to feel direct) |
| ProductScale camera / AI | 0.72 | Word zoom OK; probes feel late | **0.60** desk / **0.45** mob |
| Story coda | 0.72 | Same | **0.50** |
| Finale | 0.68 | Fine | **0.55** |

Major camera moves stay at the higher end of that range. There is one scrub per pin (GSAP), so the pin value is a compromise: Opening and AI lean immediate; Chaos/Finale lean smooth.

---

## 3. Storyboard comparison

| Current scene | Closest frame | What is missing |
|---|---|---|
| Chaos fragments | Frame 01 (old way) | Cards too small, one depth plane, thin unused strokes, no 3D scatter |
| Chaos → GATES | Frame 02 (one system) | No orbital module ring, no glowing hub, cards pile to 0,0 and fade |
| Simple invoice | Frame 03 / 04 (one action) | Invoice not large enough; no right-hand module stack; no data paths; Save does not morph the document |
| Capsule journey | Frame 04 connections | Capsule is a cut; satellites are flat cards; connections invisible |
| Executive dashboard | Frame 03 / 05 | Reads as a screenshot in a void; charts static; not 75–88% of useful width in the *hero* moment |
| GATES AI | Frame 04 + 06 | Chatbot in empty space; no business-context map; probes fire as a pile; answer appears too early |
| Network | Frame 07 | Generic isometric slabs, not buildings; HQ not dominant; paths too thin (1.4px / 0.35 opacity) |
| Finale industries | Frame 08 | Out of scope this pass |

Composition problems (all scenes): weak foreground / midground / background; objects undersized; blue lighting shy; headlines often ordinary website type.

---

## 4. Proposed fixes (this pass only)

### Density

| Pin | Height desk / mob | Idea |
|---|---|---|
| Chaos | **200 / 160** | Drift immediately; gather into an **orbit**; GATES hub; no 100vh tail |
| Opening | **440 / 350** | 0–8% establish; Save → **physical compress** → capsule → inventory 124→123 → customer → journal → POSTED → pull toward dashboard. No empty `tl.to({})` holds — camera / path / pulse continue |
| ProductScale | **500 / 400** | Word → large dashboard + chart draw → module tour → **AI map** (one module per beat, streams return, then 8.4% / causes / rec) → network already starting |
| Company story | **180 / 140** | **Do not replay POS / draft.** Pulse + live chips + OS on the existing network. Deletes the 198vh hole |
| Finale | **180 / 150** | Same cards, shorter fades |

New desktop total: **~1500vh** (half). Content-driven, not arbitrary.

### Fidelity

- Opening invoice ≈ **50–58%** of useful height; fields converge; SALE / #SO-1842 / 84,250 stay; then launch.
- Visible GATES-blue SVG paths + pulse (not neon).
- Dashboard **~82–88vw** in the main moment; stroke-draw charts; numbers ease.
- AI: pull back, central orb, Sales / Purchasing / Inventory / Accounting / Branches as product surfaces, paths out then back, answer only after return.
- Network: keep layout; HQ dominant; warehouse / factory / retail / Alexandria get silhouettes; thicker paths.
- Headlines: 30–50% of the composition where they are the statement.
- Arabic: `LTR` / `<bdi>` on GATES, AI, ERP, SO-1842, EGP. No character-split.

### Reverse

- One timeline per pin, `ease: 'none'`, no mid-timeline `set()`.
- Stock / KPI counters are tweened numbers (reverse restores 124).
- Invoice morph and capsule share the same timeline so reverse expands the document instead of popping.

---

## 5. Out of scope (honored)

- No Industries chapter.
- No new ending / OPEN THE GATES work beyond compressing the existing finale pin.
- No new product features.
- Company-story POS remake / draft / briefing stay unplayed (they were already skipped).
