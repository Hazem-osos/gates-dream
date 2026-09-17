# GATES motion blueprint — iteration A–I

**Status:** live on `/` at http://localhost:3000 — scroll the homepage. This file is the motion spec, not the site.  
**Art direction:** storyboard PNGs (Sep 14). Not pixel-spec.  
**Product truth:** invoice-posting-orchestrator + Gates AI read tools. SAMPLE DATA throughout.

Industries and the Act XV ending are **out of scope**. Existing `TransformationFinale` stays in the repo, off the homepage.

---

## Film order (this iteration)

| # | Pin | Chapter | vh desk / mob |
|---|-----|---------|----------------|
| 1 | `ChaosToSystemJourney` | 01–02 chaos → one system | 360 / 280 |
| 2 | `OpeningJourney` | B simple UX → C confirm → D capsule → E reactions | 920 / 740 |
| 3 | `ProductScaleJourney` + story overlay | F dashboard → G margin → H question → I AI → A network | 1400 / 1100 |

One master GSAP timeline per pin. Lenis + `ScrollTrigger` unchanged. Transforms only. Reverse-scroll safe (`immediateRender: false` on fromTo where needed).

---

## A — Network (keep)

- **Start:** Cairo HQ + Alexandria + Warehouse + Factory + Retail already posed from the scale pin.
- **End:** live chips (بيع / مخزون / إنتاج / تحصيل / تنبيه).
- **Camera:** existing pull-back. No industry morph.
- **Reuse:** `LocationPlatform`, packets, `LocationLiveChip`.
- **Feature:** `X-Branch-Id`, warehouses, POS, manufacturing complete, treasury collection.
- **Perf:** existing SVG motionPath, 4 packets.

Company-story **POS remake + draft + briefing** are shortened: after AI we go to the map, we do not replay the sale.

---

## B — Simple UX

- **Start:** one large GATES sales-invoice chrome (~75–82% viewport). Customer, item A12, qty, amount, one primary button. Minimal nav.
- **End:** cursor on «حفظ الفاتورة».
- **Camera:** still. Poster hold.
- **Copy AR:** واجهة بسيطة. / وقوة حقيقية.
- **Feature:** `/inventory/operations/sales-invoice` + quick-add. Not 50 controls.
- **Scroll:** ~0–18% of Opening pin.

---

## C — One action

- **Start:** same invoice.
- **Move:** button press (scale 0.94→1). **Hold 300–500ms** (empty tween ~0.04–0.06 of pin).
- **End:** paper invoice becomes the **Data Capsule**.
- **Copy AR:** أنت تعمل مرة واحدة. → GATES يربط الباقي.
- **Feature:** `invoice-posting-orchestrator` (stock MAC, COGS, VAT, AR, credit, JE).

---

## D — Data Capsule

Reusable motif (`DataCapsule.tsx`):

```
SALE
#SO-1842
84,250 EGP
```

Blue glass pill. `dir=ltr` on id/amount. Travels with `x/y/scale` (and motionPath where a path already exists). Same object in Opening and later chips.

---

## E — Sales → Inventory → Customer → Accounting

- **Camera** follows the capsule. One event, one system. No separate websites.
- Sales dock: CONFIRMED + 84,250.
- Inventory: 124 → 123, «تم تحديث المخزون».
- Customer (new surface): شركة النيل · الرصيد يزيد.
- Accounting: JE-9022 debit 1121 / credit 4110 · مرحّل.
- **UI size:** sales chrome ≥70vw; satellite cards larger than the previous 24rem.
- **Feature:** same orchestrator + party credit.

---

## F — Executive dashboard reveal

- **Start:** last accounting still.
- **Move:** ProductScale enter through **LTR GATES** (existing WOW) then dashboard settles at **~80vw × 82vh**.
- **Copy AR:** شوف شركتك. كما هي الآن.
- **Decisions not vanity KPIs:** مبيعات 1,284,500 · تحصيل 418,200 · إنتاج 1,450 · استثناءات.
- **Feature:** executive analytics surfaces (SAMPLE).

---

## G — Margin anomaly

- **Start:** full dashboard.
- **End:** هامش ↓ 8.4% dominates; other panels recede (opacity 0.28).
- **Hold.**
- **Feature:** P&L exists (`getProfitAndLossSummary`). 8.4% is SAMPLE, labeled.

---

## H — Dashboard → GATES AI

- **Start:** margin card.
- **Move:** cursor + «ليه هامش الربح قل؟» AI chrome grows **out of** the dashboard (scale/opacity), not a new page.
- **Copy AR:** بدل ما تدور على التقرير. اسأل GATES.
- **Feature:** `POST /ai/chat/stream` + command-palette Gates Intelligence.

---

## I — AI investigation

- Pulses to Sales / Purchasing / Inventory / Accounting / Branches (existing probe language).
- Checks assemble. Answer is SAMPLE and tool-shaped:
  - تكلفة الخامات ↑ 12.7%
  - الخصومات ↑ 6.2%
  - فرع الإسكندرية ↓ 4.1%
- Recommendation (honest): اعرض الأصناف المتأثرة — not auto-post, not fake forecast.
- **Copy AR:** يفهم. يشرح. ويساعدك تقرر.
- **Tools that exist:** `getSalesSummary`, `getProfitAndLossSummary`, `getInventoryStatus`, `getSupplierPayables`, branch analytics. No dedicated “margin decomposition” tool — do not claim live calc.

---

## Out of this build

- Chapter 08 industries, 09 transformation, OPEN THE GATES ground.
- Schools, CRM module, multi-company switcher, scheduled 06:00 cron as a promise.

---

## Arabic / RTL

- `LTR` / `bdi` on GATES, SO-1842, ⌘K, EGP amounts.
- Phrase/mask reveals only. IBM Plex Sans Arabic. No SETAG.

---

## Quality gate

Transaction is a physical capsule. Cause → effect is one camera path. ERP depth is the orchestrator, not a module grid. AI is a layer on the dashboard. One screen-record moment: confirm → capsule → 124→123 → POSTED → margin → ask.
