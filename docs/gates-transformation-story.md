# GATES transformation story

**Status:** first homepage slice is implemented (RTL isolate, Arabic rewrite, Act I–II, retitled Act V, ⌘K hinge, story reorder, industries + finale).  
**Rule:** do not throw away the current cinematic. Keep visual quality, blue/white identity, motion language, navigation, and the scenes that already work. Rebuild the *narrative*.  
**Arabic first.** The homepage is for an Egyptian business owner.

Inspected from the live application (not prior prompts): invoice posting orchestrator, license map, command palette, Gates AI tool registry, proactive detectors, contracting extracts, manufacturing, POS, HR, real estate, and the current homepage pin (`OpeningJourney` + `ProductScaleJourney` + company-story overlay).

---

## A. Positioning in one sentence

**GATES يخلّي نظام الشركة يشغّل الشغل — مش العكس.**

English: GATES is the business operating system that helps run the company — you no longer operate a pile of programs.

---

## B. What old ERP gets wrong

The owner does not hate “ERP.” They hate this feeling:

- The company is one thing. The information is not.
- Excel, WhatsApp, a warehouse printout, an accountant, a branch manager — each holds a piece.
- To know *what happened*, someone opens a report, sets dates, exports, argues.
- To know *why*, they call three people.
- Depth means complexity. Simplicity means a toy.
- AI, when it exists, is a chatbot next to the software — not inside the books.

Old ERP asks the company to serve the software.

---

## C. What GATES changes

| From | To |
|------|----|
| You operate the software | The software helps operate the business |
| Data entry | Understanding + the next action |
| Modules | One company |
| Reports | Answers |
| Searching | Asking |
| Complicated because it is deep | Deep, and fast for the daily task |
| Reacting after the month closes | Seeing what needs attention today |

GATES is a Delphi-era Egyptian ERP rewritten as one tenant-scoped system (company + branch + fiscal year). Posting is atomic. That is the product truth under the film.

The visitor should leave thinking: this is not another حسابات program. This is an operational upgrade.

---

## D. Target visitor emotional journey

1. أعرف المشكلة دي.
2. استنى — كل ده يتربط؟
3. شكله أسهل مما توقعت.
4. وفيه عمق أكبر مما بان في أول ثانية.
5. أقدر أشوف شركتي وهي شغّالة.
6. الذكاء فاهم الشغل، مش بيرد كلام عام.
7. يقدر يقولي *ليه*.
8. ويساعدني أقرر الخطوة الجاية — وأنا اللي أعتمد.
9. ده يغيّر طريقة شغلنا.
10. عايز أشوفه على شركتي.

---

## Arabic / RTL audit (must fix before new scenes)

This is a production defect, not a polish item.

### Critical: GATES → SETAG

In `ProductScaleJourney`, the wordmark is five flex children:

```ts
const LETTERS = ['G', 'A', 'T', 'E', 'S']
```

Arabic marketing sets `<html dir="rtl">` (`MarketingShell` + `locale.tsx`). A default `flex` row **reverses in RTL**, so the visitor reads **SETAG**. This must never ship again.

**Fix (implementation later):** wrap the wordmark in an LTR isolate (`<bdi dir="ltr">` or a reusable `<LTR>`). Do not rely on flex order for Latin brands. Prefer one unsplit `GATES` string unless a letter animation truly needs spans — and then force `dir="ltr"` + `unicode-bidi: isolate` on the wrapper.

### Other RTL / Arabic issues found

| Issue | Where | Risk |
|-------|--------|------|
| Root `app/layout.tsx` is `lang="en" dir="rtl"` until marketing JS runs | Hydration flash | Wrong dir for a frame |
| Leaving marketing resets `html.dir` to `rtl` even after English | `MarketingShell` cleanup | English pages inherit RTL |
| Blanket `letter-spacing: 0` on any `tracking-*` in RTL | `global.css` | Correct for Arabic; also kills intentional Latin tracking on GATES unless isolated |
| Blanket `text-transform: none` on `uppercase` in RTL | `global.css` | Fine for Arabic; Latin badges (POSTED, SAMPLE) stay mixed |
| No `<LTR>` / `<bdi>` utility on the homepage | Cinematic + copy | `GATES`, `AI`, `POS`, `A12`, `SO-1842`, `ERP` can reorder next to Arabic |
| Arabic headlines use English tracking utilities (`tracking-[-0.05em]`) | Opening + scale type | CSS zeroes them in RTL, but the *intent* is still English typography |
| Editorial Arabic uses IBM Plex Sans Arabic (good) | `MarketingShell` | Newsreader is loaded and unused; English editorial falls back to Geist, not a designed Latin serif pairing |
| Copy is often a translation of English structure | `copy.ts` | «متصل أخيراً.» / «عمل بالكامل يتفاعل.» / leftover unused section copy (`hero`, `connected`…) sounds like a translated site |
| Opening module tile labelled CRM / «العلاقات» | `OpeningJourney` | There is **no CRM module**. Honest label: العملاء |
| Command palette and skip-link mix | Navbar | Fine if Latin ⌘K is isolated |

### Animation rules for Arabic (implementation later)

- Do **not** split Arabic into characters or per-letter spans. Shaping will break.
- No SplitText on Arabic.
- Reveal by **line, word (space-separated), mask, clip-path, or whole-phrase transform**.
- Mixed strings (`اسأل GATES`, `نظام GATES`, `GATES ERP`) must be one phrase with Latin isolated, not reordered by flex.

### Typography rules

- Keep **IBM Plex Sans Arabic** as the Arabic face (already on the marketing shell). It is contemporary and pairs with the blue/white system.
- Tune Arabic separately: larger line-height on headlines (~1.15–1.25), almost no letter-spacing, shorter line length, earlier wraps.
- English may use a distinct editorial face; do not copy English `tracking` / `leading-none` onto Arabic.

### Copy rule

Rewrite homepage Arabic as native owner-language. Short. Confident. Not accounting documentation. Not generic ads. For every major line below, three candidates were written internally; **the chosen line is shown**.

---

## Product truth used by this story

### Strongest differentiators (owner ranking)

1. **One posted document** updates stock (moving average), COGS, VAT/WHT, party credit, cash settlement, and the journal in one transaction (`invoice-posting-orchestrator.ts`). POS sales use the same engine.
2. **Gates AI reads those same books** (25 tools). It does not invent totals. Writes are **drafts** until **اعتماد كمسودة**.
3. **The system can speak first:** cash-flow risk (14-day liquidity), overdue receivables, stock runout, project margin (`proactive-cfo.job.ts`). Morning briefing reads those insights.
4. **Egyptian contracting extracts:** gross → advance → retention → VAT 14% → WHT → AR/AP + project cost (`computeExtractTotals.ts`). Unique on this map.
5. **⌘K command palette:** new sales invoice, customer, journal, item, entity search — real few-keystroke UX (inventory + accounting; not the whole app).
6. **Branch-scoped company** (HQ / Alexandria / warehouse / factory / retail is honest). Multi-currency exists. **Multi-company switch in one login does not** — do not film a tenant hopper.
7. Manufacturing (BOM → issue → labor/OH → complete → FG + MAC) is real; thinner than invoices. Use as texture + industry beat.
8. Cheques, securities, banks, full Arabic GL report suite — depth, not the A-plot.
9. ETA e-invoicing is licensed and real; supporting Egypt texture, not a hero scene.
10. OCR purchase invoice → draft card is implemented. Strong, but secondary to “ask → investigate → confirm.”

### Do not invent on the homepage

| Tempting claim | Truth |
|----------------|--------|
| Full CRM | Customers, delegates, commissions, growth follow-up. No CRM module. |
| Schools on the live product | Backend exists; **not mounted** in `app.ts`; **no** `gates-web/app/schools`. License code unused at the route layer. |
| Professional-services industry | Marketing catalog only. |
| Multi-company switching | One company per login. |
| AI “forecast our cash” | No forecast tool. There is a **14-day liquidity risk detector**. |
| AI posts by itself | Constitution + action cards forbid this. |
| AI always runs at 06:00 | Cron needs Redis. Insights exist; scheduling is conditional. |
| Universal search of manufacturing/HR/contracting | Palette indexes inventory + accounting nav + a few entities. |
| POS shift close in the UI | Backend close exists; frontend close is thin. Daily report exists. |

---

## E. Exact cinematic story

Fifteen acts. One continuous camera language. Existing pins are **reused and re-ordered**, not discarded.

**Logline:** The owner’s company is already one company. GATES is the first system that treats it that way — simple on the surface, deep underneath, and intelligent enough to explain *why* and prepare *what next* — with the human still in charge.

**Arc:**

`الفوضى الأنيقة → نظام واحد → العمق → السهولة → حركة واحدة → الشركة حيّة → اسأل → افهم ليه → اعتمد → النظام يجيلك → الشبكة → القطاع → التحوّل → اللحظة → OPEN THE GATES`

---

## F–K. Scene-by-scene storyboard

For each scene: Arabic (chosen), English, what the product actually is, what the camera does, how we leave.

### Act I — The old way  
**Pin: new · ~220vh desktop / ~170vh compact**

- **AR (chosen):** شركتك واحدة. ليه بياناتها متفرقة؟  
  *Rejected:* «بياناتك ضايعة.» (depressing) · «أوقف العشوائية.» (ad-speak)
- **EN:** Your company is one. Why isn’t the information?
- **Product:** None yet. This is the problem the orchestrator and AI later solve. Questions are things owners actually ask Gates AI today (`getSalesSummary`, `getProfitAndLossSummary`, `getInventoryStatus`).
- **Scroll:** Beautiful fragments — Excel, WhatsApp, invoice, stock list, a manager note, a GL print, a warehouse ping, a branch slip — drift on independent clocks. Three spoken questions, three late/wrong answers:
  - «مبيعاتنا كام النهارده؟»
  - «ليه الهامش قل؟»
  - «المخزون الحقيقي كام؟»
- **Transition:** Fragments hesitate. A quiet center appears. We do not fade to black.

### Act II — One business  
**Pin: new · ~200vh / ~160vh**  
**WOW 1**

- **AR:** كل شركتك. نظام واحد.  
  *Rejected:* «اجمع شغلك.» · «منصة موحدة.»
- **EN:** Your whole company. One system.
- **Then, isolated LTR:** GATES  
  **AR sub:** نظام تشغيل أعمالك.  
  **EN sub:** Business Operating System
- **Product:** The real connected core — sales invoice, inventory, GL, parties, HR, manufacturing, projects/extracts. Not a logo mashup of fake apps.
- **Scroll:** Fragments physically travel and dock: invoice → Sales, stock → Inventory, journal → Accounting, people → HR, production → Manufacturing, customer card → العملاء (not “CRM”), extract → Projects. They become one chassis.
- **Transition:** We are close enough to read **GATES**. We enter the A.

### Act III — Show the depth  
**Pin: new · ~280vh / ~210vh**  
Uses the **executive dashboard surface already built**.

- **AR:** تحت البساطة… شركة كاملة.  
  *Rejected:* «وحدات النظام.» · «كل الوحدات في مكان.»
- **EN:** Under the simplicity, a whole company.
- **Product (only what exists):**
  - **المالية:** COA, journal, AR/AP, cash/banks, cheques, securities, cost centers, trial balance, P&L, balance sheet
  - **التشغيل التجاري:** sales, purchasing, customers, suppliers, POS, price lists
  - **العمليات:** inventory, warehouses, transfers, stocktaking, manufacturing, projects/extracts
  - **الأفراد:** HR, payroll, attendance *(licensed)*
  - **الإدارة:** dashboards, reports, FGAC permissions, branches
- **Scroll:** Camera stays on one interface. **المالية** blooms (three honest surfaces), collapses back. **العمليات** blooms. **الأفراد**. **الإدارة**. No module grid. No schools. No CRM card.
- **Transition:** The interface looks heavy for a second — then we refuse that feeling.

### Act IV — But it’s easy  
**Pin: new · ~200vh / ~160vh**  
**UX demonstration**

- **AR:** القوة مش لازم تتعقّد.  
  *Rejected:* «كل القوة دي. من غير التعقيد.» (fine, longer) · «سهل على الكل.»
- **EN:** Power does not have to be complicated.
- **Product (real):** ⌘K command palette (`CommandPalette.tsx`, `commandRegistry.ts`): «+ إنشاء فاتورة بيع جديدة», «+ إضافة عميل جديد», entity search for a sales invoice, open Gates Intelligence. On the invoice itself: quick-add customer + item without leaving the document.
- **Scroll:** A long ghost path (تقارير → ذمم → عميل → تاريخ → تصدير) dissolves. The owner types: «مستحقات العملاء هذا الأسبوع». Palette + AI drawer answer from `getOverdueReceivables` / aging tools. Then three quick actions land: فاتورة · عميل · مخزون.
- **Do not** use a stopwatch. Do not claim the palette searches manufacturing.
- **Transition:** They create one sale. We follow it under the glass.

### Act V — One action, everything reacts  
**Pin: reuse `OpeningJourney` · keep ~860/680vh, trim intro headline**  
**WOW 3**

- **AR:** تعمل مرة. النظام يكمل.  
  *Rejected:* «أنت تعمل مرة واحدة. GATES يربط الباقي.» (instructional) · «حركة واحدة.» (already used, smaller)
- **EN:** You act once. The system finishes the thought.
- **Product:** `invoice-posting-orchestrator` — stock MAC, COGS, VAT, AR, credit, optional cash settle, journal POSTED. Same object language already filmed (SO-1842 / 84,250 / شركة النيل / A12).
- **Scroll:** Keep the physical invoice, sales dock, inventory 124→123, journal, pull-back. **Retitle.** Remove the CRM tile (use العملاء or drop). Keep manufacturing + projects tiles — they are real.
- **Transition:** The camera does not reset. We are inside GATES. We rise into the wordmark (LTR).

### Act VI — Your business, live  
**Pin: first half of `ProductScaleJourney` (enter → dashboard settle → module camera)**  

- **AR:** شوف شركتك. دلوقتي.  
  *Rejected:* «شوف شركتك. كما هي الآن.» · «لوحة التحكم.»
- **EN:** See your company. Right now.
- **Product:** Executive KPIs already on the stylized dashboard (sales, cash, receivables, low stock). Backed by real executive/analytics + AI tools — sample numbers stay SAMPLE DATA.
- **Scroll:** Enter through **GATES** (fixed LTR). Dashboard is Arabic-first. Camera visits Sales → Inventory → Accounting as *understanding*, not a tour.
- **Transition:** Type (keep, rewrite): افهم شغلك. وهو بيحصل.

### Act VII — From reports to answers  
**Pin: short new beat on the same dashboard · ~90vh**

- **AR:** مش تدور على التقرير. اسأل.  
  *Rejected:* «بدل ما تدور على التقرير. اسأل السؤال.» · «التقارير خلصت.»
- **EN:** Don’t hunt the report. Ask.
- **Product:** Gates AI chat (`POST /ai/chat/stream`) + tools. Command palette “Gates Intelligence”.
- **Scroll:** Search/command chrome on the dashboard becomes the AI field. The owner asks: «ليه الهامش قل الشهر ده؟»
- **Transition:** The question stays. Pulses leave.

### Act VIII — AI that knows the business  
**Pin: reuse company-story P4 investigation · ~100vh**  
**WOW 5**

- **AR:** لأنه شايف الشركة كلها.  
  *Rejected:* «ذكاء فاهم شغلك.» · «مش شات. سياق.»
- **EN:** Because it can see the whole company.
- **Product (implemented tools):** `getSalesSummary` / `getTopSellingItems`, `getInventoryStatus`, `getSupplierPayables`, `getProfitAndLossSummary`, branch performance via executive analytics. Constitution: narrate tool JSON only.
- **Scroll:** Pulses through Sales, Inventory, Purchasing, Accounting, Branches — return — answer assembles.  
  **Honest sample (keep A12 continuity):**  
  - مبيعات A12 اليوم 84,250 (تجزئة القاهرة)  
  - الرصيد 8 مقابل حد 20  
  - آخر توريد من المورد A تأخر  
  Optional second beat (if we have air): margin down because input cost up — only if we keep numbers consistent with SAMPLE DATA, not a fairy tale. Prefer the stock-runout answer we can defend.
- **Transition:** A recommendation, not a post.

### Act IX — AI doesn’t just answer  
**Pin: reuse company-story P5–P6 · ~150vh**

- **AR:** يقترح. أنت تعتمد.  
  *Rejected:* «الذكاء يتصرف.» (lie) · «نفّذ.»
- **EN:** It proposes. You approve.
- **Product:** `propose_transaction_draft` / `DRAFT_PURCHASE_INVOICE` → `AiActionCard` → **اعتماد كمسودة**. Caption **لم تُحفظ بعد.** Then purchase-path consequences (expected stock 8→28, AP, supplier) via the same orchestrator *after* a human would post — film the draft as the honest climax; treat post as “what this draft becomes.”
- **Scroll:** Keep the existing draft card + confirm press. Do not invent supplier-comparison as a module. Optional one line: «نقارن الموردين؟» only as a *question*, not a fake screen — or skip.
- **Transition:** The company is no longer waiting to be asked.

### Act X — AI comes to you  
**Pin: reuse company-story P3 briefing · move *after* the owner has seen ask/act · ~80vh**

- **AR:** صباح الخير. دي أولوياتك.  
  *Rejected:* «هناك 3 أمور تحتاج انتباهك اليوم.» (current, a bit official) · «النظام صاحي.»
- **EN:** Good morning. Here is what matters.
- **Product:** `getMorningBriefing` + `InsightBriefingCard` + detectors (receivables, stock runout, cash-flow risk). **Label:** insights the product can compute. Do **not** say “every morning automatically” unless we add a quiet “عند تفعيل التنبيهات.”
- **Scroll:** Three attention items + **one opportunity** (e.g. هامش أو تحصيل) so it is not only alarms. Numbers stay SAMPLE and consistent (418,200 مستحقات already on the dashboard).
- **Transition:** Pull back. The map we already built finally has meaning.

### Act XI — Scale  
**Pin: reuse scale HQ + locations + live chips (P8) · ~180vh**  
**WOW 4**

- **AR:** شركة واحدة. مهما كبرت.  
  *Rejected:* «كل موقع. كل إدارة.» · «توسّع بلا فوضى.»
- **EN:** One company. However large it gets.
- **Product:** Branches, `X-Branch-Id`, warehouses, POS retail, manufacturing complete, treasury collection. **Honest stretch:** currencies exist. Multi-company = architecture (separate tenant), not a switcher — one quiet line max: «كل شركة لها دفاترها.» Do not morph into a Saudi map here.
- **Scroll:** Dashboard shrinks onto Cairo HQ. Alexandria, Warehouse, Factory, Retail. Live events already designed (بيع / مخزون / إنتاج / تحصيل / تنبيه). Paths and packets stay.
- **Transition:** The *kind* of company can change. The engine does not.

### Act XII — Industries  
**Pin: new · ~240vh / ~180vh**  
Central engine stays. Environment changes. **No cards.**

Only industries with a real app surface:

| Industry | 3–5 honest proofs | Status |
|----------|-------------------|--------|
| تجارة | warehouses, price lists, transfers, customers, sales/purchase tax | Implemented |
| تصنيع | BOM, production order, material issue, completion costing, scrap | Implemented |
| تجزئة | POS, branch, stock on hand, daily report | Implemented |
| مقاولات | projects, BOQ, **مستخلص** (advance/retention/VAT/WHT), cost control | Implemented — **give this the longest beat** |
| عقارات | units/contracts, reservation, cheques, closure | Implemented |

**Omit from the main film:** Schools (not wired), Professional services (not a module).

- **AR:** نفس النظام. شغل مختلف.  
  *Rejected:* «مبني لقطاعك.» · «يتشكّل على شركتك.»
- **EN:** Same system. Different work.
- **Scroll:** Trading floor → factory pulse → retail POS (reuse stylized POS) → **construction extract** (one beautiful مستخلص: إجمالي → دفعة مقدمة → ضمان → ضريبة → احتجاز) → quiet real-estate reservation. Engine never leaves frame.
- **Transition:** We return to the *same* company as Act I.

### Act XIII — The transformation  
**Pin: new · ~140vh**

- **AR:** مش برنامج جديد. طريقة شغل جديدة.  
  *Rejected:* «مش مجرد نظام جديد. طريقة جديدة تدير بيها شركتك.» · «قبل وبعد.»
- **EN:** Not a new program. A new way to run the company.
- **Then four beats, not a paragraph:** أوضح. أسرع. أذكى. ومربوطة.
- **Product:** Reuse Act I fragments — now docked, flowing, the briefing visible, one employee on one screen.
- **Scroll:** No split-screen before/after. The scattered objects find their ports. Data moves. AI understands. Management sees.
- **Transition:** Almost no UI.

### Act XIV — Historical upgrade  
**Pin: new · ~120vh**  
White. Typography. Quiet.

- **AR:** الخطوة الجاية في شركتك مش برنامج.  
  **line 2:** دي طريقة شغل جديدة.  
  *Rejected:* «كل شركة ليها لحظة بتغيّر بعدها شغلها.» (soft-dramatic) · «تحوّل تشغيلي.» (consultant)
- **EN:** The next step in your company is not a program. It is a new way of working.
- **Then isolated:** GATES
- **Product:** None. Permission to feel this is an operations decision, not an IT purchase.
- **Transition:** Fragments from the whole film gather.

### Act XV — Final  
**Pin: new · ~160vh**  
**WOW 6** · Footer may return after this.

- **AR:** كل شركتك.  
  pause  
  نظام واحد.
- **Brand line (English, LTR):** OPEN THE GATES.
- **CTA AR:** احجز عرضاً  
  **Secondary:** اكتشف GATES
- **Product:** None. Conversion.
- **Scroll:** Sale, invoice, warehouse, factory, employee, customer, cash, extract, branch, insight — to center. Ground goes GATES blue. White type. Buttons.

---

## L. AI role

AI never gets a title card that says «فصل الذكاء الاصطناعي».

It arrives because:

1. The owner is tired of reports (Act VII).
2. The books already posted (Act V) — tools read **posted** services.
3. A detector can notice A12 (Act X) — `StockRunoutDetector`.
4. A draft is the only honest write (Act IX).

**Show:** investigation pulses, tool-backed answer, action card, confirm.  
**Do not show:** auto-post, ChatGPT wallpaper, fake forecast graphs, WhatsApp agent.

---

## M. UX simplicity demonstrations

| Film | Real path | Honest limit |
|------|-----------|--------------|
| ⌘K → فاتورة بيع جديدة | `commandRegistry` `action:new-sales-invoice` | Palette is strongest on inventory/accounting |
| Type a customer / invoice number | Entity search in `CommandPalette` | ≥2 characters; sales invoices + customers + items + accounts |
| Ask «مستحقات الأسبوع» | AI `getOverdueReceivables` / aging tools | Requires AI configured in product; homepage is SAMPLE |
| Quick-add عميل / صنف on the invoice | `CustomerQuickAddModal`, `ItemQuickAddModal` | Don’t film a 12-field CRM |
| AI → مسودة فاتورة | `prepareCreateSalesInvoice` / `propose_transaction_draft` | Human still opens or confirms |

**Strongest single UX story:** speak a sale → stock already checked → pre-filled invoice → اعتماد كمسودة. That is the “old ERP was twenty screens” film without a stopwatch.

---

## N. Six biggest WOW moments

1. **Fragments become GATES** (Act II) — the problem physically organizes.
2. **Enter the wordmark** (Act II→VI) — existing scale enter, **LTR-fixed**.
3. **One sale, the ledgers move** (Act V) — existing opening film, retitled.
4. **Dashboard becomes a company** (Act XI) — existing HQ + five locations.
5. **AI walks the modules and answers why** (Act VIII) — existing P4.
6. **The whole journey collapses to one system** (Act XV).

**Seventh, if we have room:** the **مستخلص** bloom in Act XII. It is the most Egyptian proof we have. Worth more than another KPI.

---

## O. Implemented / planned / conceptual

### Implemented — safe to film as product

- Invoice orchestrator (stock, MAC, COGS, VAT/WHT, AR/AP, credit, settlement, JE)
- Inventory ops, MAC, reorder / runout inputs
- Accounting: COA, journal, treasury, cheques, securities, cost centers, M16 + Arabic report suite
- POS sale → same invoice engine; daily report
- Manufacturing BOM → production complete + costing
- Contracting projects + extracts (retention/advance/WHT)
- Real estate reservation / contracts / cheques
- HR/payroll posting (licensed)
- ETA module (licensed; live client env-gated)
- Multi-branch, currencies, FGAC
- ⌘K palette + quick create on core documents
- Gates AI: 25 tools, streaming chat, action cards, OCR purchase draft, CFO what-if on **posted** history, four detectors, briefing UI, RAG upload
- Constitution: no invented totals; no “created” before confirm

### Planned / conditional — film carefully or label

- Proactive scan **on a schedule** (needs Redis + worker)
- AI without `OPENAI_API_KEY` (503)
- Palette coverage beyond inventory/accounting
- POS shift **close** in the UI
- Schools product (code exists, not shipped on HTTP/UI)
- Landing `GatesAI.tsx` static Q&A (`data/ai-queries.ts`) — **not live**. Do not reuse as if it were the product.

### Conceptual / vision — do not imply “today”

- AI that posts without a human
- WhatsApp-operated ERP
- Full CRM pipeline
- Dedicated cash-forecast engine (vs 14-day liquidity risk)
- Multi-company switcher, Saudi expansion map, “historical company film”
- Professional-services vertical

---

## P. Technical animation strategy

Unchanged clock:

- Lenis `autoRaf: false`, GSAP ticker, `lagSmoothing(0)`, `ScrollTrigger.update`
- Transforms only: `x, y, scale, rotateX, rotateY, opacity`
- No React state during scrub
- One master timeline per pin (or two STs on one sticky stage, as scale+story already do)
- Reduced motion: jump to the last still of that pin

New work:

- **LTR isolate component** for all Latin brands/codes
- Arabic reveals = phrase/mask only
- Act I fragments = independent loops that **gain a parent** in Act II (parented motion, not fade)
- Act III = scale/opacity of *groups* around the existing dashboard, not a new website
- Reuse `OpeningJourney` and `ProductScaleJourney` DOM where the pose already exists; do not remake the invoice object or the five platforms
- Stylized surfaces only — no iframes of `/pos` or `/contracting/extracts`

Approximate new scroll (desktop): I 220 + II 200 + III 280 + IV 200 + V 860 + VI–XI ~1400 (existing scale+story, with VII/X spliced) + XII 240 + XIII 140 + XIV 120 + XV 160 ≈ **~4,000vh** if everything is full. **Too long.**

**Budget the first build of this story at ~2,200–2,600vh desktop** by:

- Keeping V, VI, VIII, IX, XI almost as-is
- Making I+II one pin
- Making III a tight bloom (not five lectures)
- Making VII a short hinge
- Making X a hold, not a new world
- Making XII three industries max in v1 (تجارة / تصنيع / **مقاولات**) with retail already taught
- Making XIII–XV one finale pin

Do not trigger five events in 20vh. V, VIII, XI, XV get air.

---

## Q. Existing scenes to preserve

| Scene | Why |
|-------|-----|
| Physical sales order object + dock + CONFIRMED | Best “this is a real document” shot we have |
| Inventory count 124→123 + journal POSTED | Honest orchestrator |
| Module tiles pull-back (minus fake CRM) | Depth without a grid |
| GATES wordmark enter into the product | WOW 2 — after LTR fix |
| Executive dashboard + Sales/Inventory/Accounting camera | Act VI |
| «افهم عملك» beat (rewrite words, keep type scale) | Breath before HQ |
| Cairo HQ + Alexandria + Warehouse + Factory + Retail + paths/packets | Act XI — already approved spatially |
| Stylized POS + blue token | Retail continuity |
| Warehouse 123→122 / shelf 8 vs 20 | Detector setup |
| AI pulses + checks + answer | Act VIII |
| Draft card + لم تُحفظ بعد + اعتماد كمسودة | Act IX — trust |
| Live location chips | Act XI payoff |
| Blue/white grade, sticky stage, no black sections, no footer until the end | Identity |

---

## R. Existing scenes to modify

| Scene | Change |
|-------|--------|
| Opening headlines «عملك. متصل أخيراً.» | Too small for the new ambition. Move that *idea* to Act II; Act V starts on the invoice |
| «حركة واحدة / عملك بالكامل يتفاعل» | Replace with «تعمل مرة. النظام يكمل.» |
| GATES letter flex | LTR isolate; consider unsplit word |
| CRM tile | العملاء or remove |
| Company-story order | Briefing (P3) **after** ask/act (P4–P5), so AI arrives as answers then as morning priorities |
| «ليس مجرد برنامج إدارة» | Move to Act XIII/XIV; don’t spend it before industries |
| `cashForecast` copy | Say ضغط سيولة / مستحقات أسبوع — not «توقّع» |
| Unused old sections (`GatesAI.tsx` queries, `ConnectedBusiness`, module grids) | Stay off the homepage. Do not resurrect as the story |
| Arabic tracking / leading on editorial type | Arabic-specific values |
| Demo company file | Keep one SAMPLE dataset across all new acts |

---

## S. Existing scenes to remove (from the *homepage journey*)

- A second, full remake of sale→inventory→accounting inside the retail chapter (P2 as a lecture). Keep a **short** token hop so the sale still has consequence; do not replay Act V.
- Module **cards** / industry **cards** / AI **chatbot mock** from `components/sections/*`
- Egypt political map, Saudi chapter, company-history film, fake certification claims
- Schools and professional-services as live industries
- Footer, legal, and “Book a demo” **until Act XV**
- Any visual that says the AI saved a document before اعتماد كمسودة
- Literal English uppercase posters used as Arabic headlines (`UNDERSTAND`, `FROM EVERY TRANSACTION`)

---

## Recommended first implementation slice (when approved)

Not in this document’s job to build. When we build:

0. **RTL + Arabic type + isolate GATES** (no SETAG). Rewrite visible homepage Arabic.
1. Act I–II (new pin) into existing Act V (opening, retitled).
2. Act IV hinge (⌘K) then existing scale enter.
3. Reorder story overlay: question → investigate → draft → briefing → map.
4. Act XII contracting bloom + Act XIII–XV finale.
5. Act III only if the film still feels like “a sales demo.” Depth may already be clear.

---

## Sources

Code inspections behind this story:

- Invoice orchestrator, licenses, reports, tenancy — application tree under `gates-backend/src` and `gates-web/app`
- [Audit GATES AI capabilities](d6d8d04d-6052-4f09-b6ac-28d1a9199d01)
- [Audit ERP modules depth](2ad1801f-bb45-4696-a93c-9e1e23b2ba81)
- [Audit verticals and UX](e841b612-5a2b-42ad-bacd-e374f86e60db)

---

GATES TRANSFORMATION STORY READY FOR REVIEW
