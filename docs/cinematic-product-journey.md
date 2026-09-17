# GATES cinematic product journey — proposed storyboard

**Status:** discovery + story only. Not implemented.  
**Constraint:** the approved scale composition (Cairo HQ · Alexandria · Warehouse · Factory · Retail + dashboard) is the start frame. Do not redesign acts already shipped.

---

## 1. What we discovered about GATES

GATES is not a suite of loosely coupled apps. It is a **Delphi-era Egyptian ERP** rewritten as a single tenant-scoped system (company + branch + fiscal year). Posting is atomic. Licensing gates verticals (`POS`, `MANUFACTURING`, `CONTRACTING`, `PAYROLL`, `ETA`, `REAL_ESTATE`, `SCHOOLS`) while **core GL and inventory stay always-on**.

### What is actually in the product (inspected)

| Area | What exists | Why it matters |
|------|-------------|----------------|
| **Sales / purchase invoices** | `invoice-posting-orchestrator` — one post writes stock, moving-average cost, per-line revenue/COGS, VAT, optional WHT, AR/AP, cost-center allocation, credit/budget checks, cash settlement, approval/audit | The real “one action, many ledgers” engine |
| **Inventory** | Warehouses, transfers, issues, receipts, stocktaking, below-cost sell block, reorder / runout signals | Physical consequence of the invoice |
| **Accounting / treasury** | Journal, opening balance, cash orders/vouchers, incoming/outgoing cheques, securities papers, banks, full Arabic report suite (أستاذ، يومية، قائمة دخل، ميزان، مركز مالي) | Egyptian bookkeeping depth |
| **POS** | `/pos/point-of-sale`, daily close | Matches the **Retail Store** already on the map |
| **Manufacturing** | BOM, production order (draft → release → issue materials → labor/OH → complete), WIP → FG + moving average | Matches **Factory**; thinner than invoices |
| **Contracting / extracts** | Client & subcontractor extracts: gross → advance → retention → VAT 14% → WHT 1% → AR/AP + project cost center | Strongest *Egyptian* differentiator — but the approved map is not a construction site |
| **Parties** | Customer / supplier cards, credit limits, aging, delegates | Downstream of every invoice |
| **HR / payroll** | Licensed module + AI `HrPayrollTool` | Real, not the hero of this map |
| **ETA e-invoicing** | Licensed `/electronic-invoices` | Egypt-specific; supporting texture, not the plot |
| **Tenancy** | Multi-company JWT, `X-Branch-Id`, fiscal year required to post, FGAC (`view/edit/post/approve`) | Explains HQ vs Alexandria |

### Gates AI — implemented, not theoretical

The architecture markdown still reads like a spec. The **code is live**:

- Read tools wrap **existing** report services: sales, top customers, overdue AR, inventory status, cash/banks, P&L, project profitability, supplier AP, morning briefing, aging, cost-center projects, document RAG, growth, CFO what-if.
- **Proactive CFO detectors:** cash-flow risk, receivables risk, **stock runout**, **project margin**.
- **Write path is honest:** `propose_transaction_draft` / `PrepareCreateSalesInvoice` / purchase / payment / stock issue create an **action card**. Nothing is saved until the user clicks **اعتماد كمسودة**. OCR of a supplier invoice follows the same rule.
- Morning briefing: «إيه الأخبار النهاردة» → `getMorningBriefing`.
- Constitution: never invent totals; never say a document was created before confirm.

That last point is a **trust differentiator**, not a weakness. The film should show the confirm tap.

---

## 2. Strongest differentiating capabilities

Ranked for a business owner (not an ERP buyer checklist):

1. **One posted document updates stock, cost, VAT, party credit, and the journal in one transaction.**  
2. **AI that reads the same posted books** (not a chatbot with fake KPIs), then **proposes a draft the human still owns**.  
3. **Proactive stock-runout and receivables detectors** — the system speaks first.  
4. **Branch-scoped posting** (Retail vs HQ warehouse vs Alexandria).  
5. **Egyptian contracting extracts** (retention / advance / WHT) — unique, but reserved for a later industry chapter so we do not contradict the approved map.  
6. **Manufacturing completion costing into FG + GL** — use as a *network event*, not the A-plot (coverage is thinner).  
7. **Cheques / securities / cash forecast** — texture on the live network.  
8. **CFO what-if** (discount / price / overhead on posted history) — powerful, easy to overstuff; keep for a later beat if this chapter is approved.

---

## 3. Candidate stories considered

| Candidate | Enter from | Verdict |
|-----------|------------|---------|
| **A. Replay “sale → inventory → accounting”** | HQ dashboard | Rejected. Act 1 already did this. A remake would feel like a product tour. |
| **B. Factory production complete** | Factory | Strong GATES module, weaker “owner in 8 seconds” story. Manufacturing API is real but thinner. Use as a later pulse on the map. |
| **C. Client extract (مستخلص)** | Invent a site / HQ | Most Egypt-unique. **Rejected for this chapter** — the approved locations are Factory + Retail + Warehouse, not a construction site. Schedule for the industries morph later. |
| **D. OCR supplier bill → draft purchase** | HQ | Impressive AI, but starts in a document, not in the map. Better as a *tool* inside the selected story. |
| **E. Retail sale of A12 → warehouse runout → AI briefing → draft PO → confirm → network alive** | **Retail Store** | **Selected.** Continues demo data, uses the map, shows the orchestrator *and* the AI that already exists, without repeating Act 1’s camera path. |

---

## 4–5. Selected story and why

### Story title

**«بعد الحركة» — The day after the connected sale**

Act 1 proved: one action updates the system.  
This chapter proves: **the system notices what the human would miss, and helps execute the next decision — without posting behind their back.**

We enter **Retail Store** (already on screen). Same company, same SKU **A12**, same customer **شركة النيل**, same **84,250 ج.م**. We do **not** fade the map. We travel into one node.

Why this wins:

- A business owner understands a shop sale instantly.
- It is **not** a module parade; it is cause → consequence → attention → action.
- It uses **real** posting, **real** stock-runout detection, **real** morning briefing, **real** draft-purchase action cards.
- It reuses Act 1 objects (invoice, A12, 84,250, Nile) so the film has memory.
- Contracting/manufacturing remain available for later chapters without lying about this company’s map.

---

## 6–8. Scene sequence (visual + product mapping)

Demo company (one dataset, SAMPLE DATA — to live in a future `lib/marketing/demo-company.ts`, not invented per screen):

| Entity | Value |
|--------|--------|
| Company | شركة النور للصناعات والتجارة |
| Customer | شركة النيل |
| SKU | A12 وحدة تامة |
| This sale | POS-2081 · 1 × A12 · **84,250 ج.م** (same total as SO-1842) |
| After Act 1 | Warehouse on-hand **123** |
| After this retail sale | Warehouse **122**; **retail shelf 8** vs reorder **20** |
| VAT | Shown as included in 84,250 so AR stays **+84,250** (Act 1 continuity) |
| Supplier | مورد المواد A · draft PO to restore 20 units |

### Scene P0 — Hold the approved map (20vh)

Cairo HQ, Alexandria, Warehouse, Factory, Retail, dashboard in the middle. **No fade.** A single blue pulse appears on **Retail Store**. Other nodes stay.

**Product:** geographic / branch model the visitor already accepted.

### Scene P1 — Enter Retail (50–70vh)

Camera pushes toward Retail. Other locations recede (scale down, lower contrast, stay visible). We pass through a minimal shop plane into a **stylized POS / sales invoice** (not a screenshot dump). One fact only: **بيع A12 · 84,250 · شركة النيل**.

**Product:** `/pos/point-of-sale` + sales invoice post.

### Scene P2 — The same blue object leaves the shop (80–100vh)

The invoice token (the Act 1 object language) lifts off the POS surface. Camera follows it.

1. **Main Warehouse** — 123 → **122**. Caption: تم تحديث المخزون.  
2. **HQ Accounting** — journal **مرحّل**: ذمم مدينة +84,250 · إيراد. Cost/COGS implied, not a lecture.  
3. **Customer card** — شركة النيل · الرصيد يزيد.

Sales surface stays in the background. **No cut.**

**Product:** `invoice-posting-orchestrator` (stock movement + auto GL + party credit).

### Scene P3 — The system speaks first (40–50vh)

Hold. Warehouse tile turns warning: **A12 · 8 متبقي · الحد 20**.  
Camera lifts to **Cairo HQ dashboard** (reuse the executive command center already built). A briefing card appears — not a new “AI section”:

> هناك 3 أمور تحتاج انتباهك اليوم.

1. مخزون A12 تحت حد إعادة الطلب  
2. مستحقات شركة النيل  
3. ضغط على السيولة هذا الأسبوع  

**Product:** `StockRunoutDetector`, `ReceivablesRiskDetector`, `CashFlowRiskDetector`, `getMorningBriefing`, Insight cards in the AI drawer.

### Scene P4 — Ask why (the signature AI shot) (90–110vh)

User (or auto-type) selects the stock item. Question:

> لماذا وصل A12 لحد الخطر بعد حركة اليوم؟

Camera pulls back slightly. **Blue investigation pulses** leave the AI core and travel through the *same* module tiles we already know:

| Pulse | Tool (real) | Check mark |
|-------|-------------|------------|
| Sales | `getSalesSummary` / `getTopSellingItems` | ✓ |
| Inventory | `getInventoryStatus` | ✓ |
| Purchasing / AP | `getSupplierPayables` | ✓ |
| Accounting | `getProfitAndLossSummary` | ✓ |
| Branches | sales by branch in executive analytics | ✓ |

Pulses **return**. Answer assembles (SAMPLE, consistent with the sale):

- مبيعات A12 اليوم: **84,250** (تجزئة القاهرة)  
- الرصيد بعد الترحيل: **8** مقابل حد **20**  
- آخر توريد من المورد A تأخر  

**Product:** tool registry + “narrate only tool JSON” constitution. We **show** the investigation; we do not invent a margin fairy tale that contradicts 84,250.

### Scene P5 — Answer → draft → human confirm (70–90vh)

Recommendation:

> أنشئ أمر شراء لـ 20 وحدة A12 من المورد A.

Button: **مقارنة الموردين** is optional one beat (Supplier B 8% cheaper — *conceptual* unless we wire a real price-list compare; **prefer not to fake a module we do not have**). Safer honest action:

**إنشاء مسودة فاتورة مشتريات**

A GATES action card appears (the real UI pattern): lines, totals, warehouse. Caption: **لم تُحفظ بعد.**  
Scroll/click: **اعتماد كمسودة**.

Only then: PURCHASE DRAFT CREATED.

**Product:** `ProposeTransactionDraftTool` / `DRAFT_PURCHASE_INVOICE` + `ai-action-execution` after confirm.

### Scene P6 — Downstream of the purchase (60–80vh)

Same blue object, now a purchase token:

- Supplier updated  
- Expected stock **8 → 28**  
- AP + draft amount  
- Cash forecast ticks  
- HQ dashboard KPIs refresh  

**Product:** purchase invoice post path (same orchestrator, `PURCHASE` kind).

### Scene P7 — Executive pullback (50–60vh)

Camera back to the full dashboard. The visitor now *knows* what sits behind المبيعات / المخزون / النقد. Type:

**من كل حركة. إلى كل قرار.**  
EN: FROM EVERY TRANSACTION TO EVERY DECISION.

### Scene P8 — The company is alive (70–90vh)

Camera back to the **same five locations**. Do not rebuild them. They are now running:

| Location | Event (max 4) |
|----------|----------------|
| Retail Store | بيع +84,250 |
| Main Warehouse | مخزون A12 122 → ثم 28 بعد التوريد |
| Factory | إنتاج مكتمل (one quiet pulse — manufacturing complete) |
| Alexandria | تحصيل مستلم |
| Cairo HQ | تنبيه الذكاء |

**Product:** multi-branch + manufacturing complete as *ambient truth*, not a new lecture.

### Scene P9 — Freeze and name it (50–70vh)

Lines stay. Type:

**ليس مجرد برنامج إدارة.**  
pause  
**إنه نظام تشغيل أعمالك.**

STOP before Egypt map, Saudi, industries, history, final CTA (those remain later chapters).

---

## 9. How AI enters

AI does **not** get a chapter title card.

It enters because **Scene P2 created a stock-runout the detectors already compute**. The briefing is the same object as `InsightBriefingCard`. The investigation is the tool registry. The action is a **draft card**, which is what the constitution demands.

We will **not** show AI posting or “creating the PO in the database” without the confirm. That would be a lie about GATES.

---

## 10. Three biggest WOW moments

1. **Map → shop → ERP** — the approved scale scene *becomes* the product. Continuity.  
2. **AI walks the modules** — pulses through Sales / Inventory / Purchasing / Accounting and comes back with an answer that matches the sale we just watched.  
3. **Draft, then confirm, then the company lights up** — intelligence plus control, not autopilot.

---

## 11. Approximate scroll distance

| Scene | Distance | Rhythm |
|-------|----------|--------|
| P0 Hold map | 20vh | Pause |
| P1 Enter retail | 60vh | Travel |
| P2 Cross-module token | 90vh | Action |
| P3 Briefing | 45vh | Pause / reveal |
| P4 AI investigation | 100vh | **WOW** |
| P5 Draft + confirm | 80vh | Action |
| P6 Purchase effects | 70vh | Action |
| P7 Executive line | 55vh | Pause |
| P8 Live network | 80vh | Reveal |
| P9 Operating system | 60vh | Pause |
| **Total** | **~660vh** desktop (~520vh compact) | One pin after the current scale pin, or one extended pin if we stitch at the scale end |

Do not trigger five events in 20vh. P2 and P4 get the air.

---

## 12. Technical animation approach

- **Do not touch** `OpeningJourney` or the existing `ProductScaleJourney` timeline **except** a seam at the last frame: keep the five platforms mounted, hand their refs (or remount identical DOM) into the next master timeline so P0 is the current last pose.  
- One **GSAP** timeline, Lenis clock unchanged (`autoRaf: false`, `lagSmoothing(0)`, `ScrollTrigger.update`).  
- Transforms only: `x, y, scale, rotateX, rotateY, opacity`. Pulse via `MotionPathPlugin` on SVG paths already used on the map.  
- **No React state** during scrub.  
- Stylized surfaces (POS, journal, action card) — reconstruct, don’t iframe `/pos`.  
- Single demo config: `lib/marketing/demo-company.ts`.  
- Reduced motion: jump to P9 stills.

---

## Critical self-evaluation

| Question | Answer |
|----------|--------|
| Would an owner understand without ERP knowledge? | Yes — shop sale, shelf empty, system warns, they approve a purchase. Journal lines stay secondary. |
| Does it show *why* GATES is powerful? | Yes — posting **and** noticing **and** drafting with a human gate. |
| Does it differentiate? | Yes vs “AI chatbot + module grid”. Weaker vs a المستخلص film — that waits so we don’t break the approved map. |
| Cinematic? | Yes if P1 travel and P4 pulses are large. Risk: P2 could look like Act 1. Mitigation: start in **Retail/POS**, end in **AI + draft**, not in “journal posted”. |
| Does each scene cause the next? | Sale → stock 8 → detector → question → draft → confirm → network. |
| Is AI integrated? | Yes. Bolted-on would be a new white page saying «اسأل Gates». We refused that. |
| Honesty? | Draft-before-save is shown. No fake supplier-comparison module. No auto-post. VAT kept consistent with Act 1’s 84,250 AR. |

**If this feels too “inventory ops” for a CEO:** swap P5’s payload to **draft collection / payment voucher** against شركة النيل (real `DRAFT_PAYMENT_VOUCHER`) after the briefing’s receivables line. Same AI grammar; more cash-story. Recommend keeping stock-runout — it is the detector that maps 1:1 to A12 already on screen.

---

## Out of scope until you approve

Egypt map, Saudi, industries morph, history, final CTA, footer, contracting extract film, CFO what-if simulator scene, OCR supplier-bill scene.
