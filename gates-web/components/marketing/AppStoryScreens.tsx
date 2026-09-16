import type { ReactNode } from 'react';
import type { MarketingCopy } from '../../lib/marketing/copy';

export type AppStoryCopy = MarketingCopy['appStory'];
export type AiJourneyCopy = MarketingCopy['aiJourney'];
export type JourneyCopy = MarketingCopy['journey'];

export function CaptionCard({
  cardRef,
  kicker,
  body,
  theme = 'cyan',
}: {
  cardRef: (el: HTMLDivElement | null) => void;
  kicker: string;
  body: string;
  theme?: 'cyan' | 'violet' | 'lime' | 'amber' | 'ice';
}) {
  return (
    <div ref={cardRef} className="gates-story-card" data-theme={theme === 'cyan' ? undefined : theme}>
      <p className="meta">GATES</p>
      <p className="kicker">{kicker}</p>
      <p className="body">{body}</p>
    </div>
  );
}

export function GatesAppFrame({
  frameRef,
  copy,
  nav,
  children,
  active = 'dash',
}: {
  frameRef: (el: HTMLDivElement | null) => void;
  copy: AppStoryCopy;
  nav: {
    dash: (el: HTMLDivElement | null) => void;
    sales: (el: HTMLDivElement | null) => void;
    stock: (el: HTMLDivElement | null) => void;
    books: (el: HTMLDivElement | null) => void;
    ai: (el: HTMLDivElement | null) => void;
  };
  children: ReactNode;
  active?: 'dash' | 'sales' | 'stock' | 'books' | 'ai';
}) {
  return (
    <div ref={frameRef} className="gates-app">
      <aside className="gates-app-nav" aria-hidden>
        <div className="gates-app-brand">
          <i />
          GATES
        </div>
        <div ref={nav.dash} className="gates-app-item" data-on={active === 'dash' ? 'true' : 'false'}>
          <b />
          {copy.navDash}
        </div>
        <div ref={nav.sales} className="gates-app-item" data-on={active === 'sales' ? 'true' : 'false'}>
          <b />
          {copy.navSales}
        </div>
        <div ref={nav.stock} className="gates-app-item" data-on={active === 'stock' ? 'true' : 'false'}>
          <b />
          {copy.navStock}
        </div>
        <div ref={nav.books} className="gates-app-item" data-on={active === 'books' ? 'true' : 'false'}>
          <b />
          {copy.navBooks}
        </div>
        <div className="gates-app-item">
          <b />
          {copy.navBuy}
        </div>
        <div ref={nav.ai} className="gates-app-item" data-on={active === 'ai' ? 'true' : 'false'}>
          <b />
          {copy.navAi}
        </div>
      </aside>
      <div className="gates-app-main">
        <div className="gates-app-top">
          <div className="gates-app-search">{copy.search}</div>
          <span className="gates-app-chip">{copy.company}</span>
          <span className="gates-app-chip">{copy.sample}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DashboardScreen({
  screenRef,
  copy,
}: {
  screenRef: (el: HTMLDivElement | null) => void;
  copy: AppStoryCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <p className="gates-app-h">{copy.dashTitle}</p>
      <p className="gates-app-sub">{copy.dashSub}</p>
      <div className="gates-kpis">
        <div className="gates-kpi">
          <span>{copy.kpiSales}</span>
          <strong>
            {copy.kpiSalesVal} {copy.currency}
          </strong>
        </div>
        <div className="gates-kpi">
          <span>{copy.kpiCash}</span>
          <strong>
            {copy.kpiCashVal} {copy.currency}
          </strong>
        </div>
        <div className="gates-kpi">
          <span>{copy.kpiAr}</span>
          <strong>
            {copy.kpiArVal} {copy.currency}
          </strong>
        </div>
        <div className="gates-kpi">
          <span>{copy.kpiProfit}</span>
          <strong>
            {copy.kpiProfitVal} {copy.currency}
          </strong>
        </div>
      </div>
      <div className="gates-alert">{copy.alert}</div>
      <table className="gates-table">
        <thead>
          <tr>
            <th>{copy.recent}</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{copy.docInv}</td>
            <td>{copy.docSale}</td>
            <td>
              {copy.amount} {copy.currency}
            </td>
          </tr>
          <tr>
            <td>{copy.docJe}</td>
            <td>{copy.docJournal}</td>
            <td>
              {copy.amount} {copy.currency}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SalesScreen({
  screenRef,
  badgeRef,
  copy,
}: {
  screenRef: (el: HTMLDivElement | null) => void;
  badgeRef: (el: HTMLSpanElement | null) => void;
  copy: AppStoryCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <p className="gates-app-h">{copy.saleTitle}</p>
      <p className="gates-app-sub">{copy.saleNo}</p>
      <div className="gates-doc">
        <div className="gates-doc-head">
          <div>
            <p className="gates-app-sub">{copy.customer}</p>
            <p className="gates-app-h">{copy.item}</p>
          </div>
          <span ref={badgeRef} className="gates-badge">
            {copy.confirm}
          </span>
        </div>
        <div className="gates-line">
          <span>{copy.qty}</span>
          <strong>
            {copy.amount} {copy.currency}
          </strong>
        </div>
        <div className="gates-line">
          <span>{copy.vat}</span>
          <span>
            {copy.vatVal} {copy.currency}
          </span>
        </div>
        <div className="gates-line">
          <strong>{copy.total}</strong>
          <strong>
            {copy.totalVal} {copy.currency}
          </strong>
        </div>
      </div>
    </div>
  );
}

export function StockScreen({
  screenRef,
  stockRef,
  copy,
}: {
  screenRef: (el: HTMLDivElement | null) => void;
  stockRef: (el: HTMLSpanElement | null) => void;
  copy: AppStoryCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <p className="gates-app-h">{copy.stockTitle}</p>
      <table className="gates-table">
        <thead>
          <tr>
            <th>{copy.sku}</th>
            <th>{copy.name}</th>
            <th>{copy.onHand}</th>
            <th>{copy.reorder}</th>
            <th>{copy.loc}</th>
          </tr>
        </thead>
        <tbody>
          <tr data-hot="true">
            <td>A12</td>
            <td>{copy.item}</td>
            <td>
              <span ref={stockRef}>124</span>
            </td>
            <td>20</td>
            <td>{copy.locVal}</td>
          </tr>
          <tr>
            <td>B04</td>
            <td>—</td>
            <td>86</td>
            <td>15</td>
            <td>{copy.locVal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function BooksScreen({
  screenRef,
  copy,
}: {
  screenRef: (el: HTMLDivElement | null) => void;
  copy: AppStoryCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <p className="gates-app-h">{copy.booksTitle}</p>
      <p className="gates-app-sub">{copy.booksNo}</p>
      <div className="gates-doc">
        <div className="gates-doc-head">
          <p className="gates-app-h">{copy.auto}</p>
          <span className="gates-badge">{copy.posted}</span>
        </div>
        <div className="gates-line">
          <span>
            {copy.debit} · {copy.arAcct}
          </span>
          <strong>
            {copy.amount} {copy.currency}
          </strong>
        </div>
        <div className="gates-line">
          <span>
            {copy.credit} · {copy.revAcct}
          </span>
          <strong>
            {copy.amount} {copy.currency}
          </strong>
        </div>
      </div>
    </div>
  );
}

export function SentinelScreen({
  screenRef,
  copy,
  journey,
}: {
  screenRef?: (el: HTMLDivElement | null) => void;
  copy: AppStoryCopy;
  journey: JourneyCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <p className="gates-app-h">{copy.navAi}</p>
      <p className="gates-app-sub">Sentinel</p>
      <div className="gates-brief">
        <p className="gates-brief-hi">{journey.sentHi}</p>
        <ul>
          <li>{journey.sent1}</li>
          <li>{journey.sent2}</li>
          <li>{journey.sent3}</li>
        </ul>
      </div>
    </div>
  );
}

export function AskScreen({
  screenRef,
  copy,
  journey,
}: {
  screenRef?: (el: HTMLDivElement | null) => void;
  copy: AppStoryCopy;
  journey: JourneyCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <div className="gates-chips">
        <span>{journey.chipBrief}</span>
        <span>{journey.chipStock}</span>
        <span>{journey.chipDebt}</span>
      </div>
      <div className="gates-chat">
        <div className="gates-bubble" data-who="you">
          {journey.qBrief}
        </div>
        <div className="gates-bubble" data-who="ai">
          {journey.aBrief}
        </div>
        <div className="gates-bubble" data-who="you">
          {journey.qStock}
        </div>
        <div className="gates-bubble" data-who="ai">
          {journey.aStock}
        </div>
      </div>
      <p className="gates-app-sub" style={{ marginTop: '0.7rem' }}>
        {copy.navAi} · {copy.sample}
      </p>
    </div>
  );
}

export function ActionScreen({
  screenRef,
  journey,
}: {
  screenRef?: (el: HTMLDivElement | null) => void;
  journey: JourneyCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen">
      <div className="gates-action">
        <p className="gates-app-sub">{journey.actType}</p>
        <p className="gates-app-h">{journey.actTitle}</p>
        <div className="gates-line">
          <span>{journey.actParty}</span>
          <span>{journey.actWh}</span>
        </div>
        <div className="gates-line">
          <span>{journey.actLine}</span>
        </div>
        <p className="gates-app-sub" style={{ marginTop: '0.75rem' }}>
          {journey.actTotal}
        </p>
        <div className="gates-actions">
          <span className="gates-act">{journey.actOk}</span>
          <span className="gates-act-ghost">{journey.actEdit}</span>
        </div>
      </div>
    </div>
  );
}

export function AiScreen({
  screenRef,
  qRef,
  a1Ref,
  a2Ref,
  a3Ref,
  recRef,
  actRef,
  draftRef,
  copy,
  ai,
}: {
  screenRef: (el: HTMLDivElement | null) => void;
  qRef: (el: HTMLDivElement | null) => void;
  a1Ref: (el: HTMLDivElement | null) => void;
  a2Ref: (el: HTMLDivElement | null) => void;
  a3Ref: (el: HTMLDivElement | null) => void;
  recRef: (el: HTMLDivElement | null) => void;
  actRef: (el: HTMLDivElement | null) => void;
  draftRef: (el: HTMLDivElement | null) => void;
  copy: AppStoryCopy;
  ai: AiJourneyCopy;
}) {
  return (
    <div ref={screenRef} className="gates-app-screen" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '0.8rem' }}>
      <div className="gates-chat">
        <div ref={qRef} className="gates-bubble" data-who="you">
          {ai.q}
        </div>
        <div ref={a1Ref} className="gates-bubble" data-who="ai">
          {ai.a1}
        </div>
        <div ref={a2Ref} className="gates-bubble" data-who="ai">
          {ai.a2}
        </div>
        <div ref={a3Ref} className="gates-bubble" data-who="ai">
          {ai.a3}
        </div>
        <div ref={recRef} className="gates-bubble" data-who="ai">
          {ai.rec}
        </div>
        <div ref={actRef} className="gates-act">
          {ai.act}
        </div>
      </div>
      <div ref={draftRef} className="gates-doc">
        <div className="gates-doc-head">
          <div>
            <p className="gates-app-sub">{ai.draftNo}</p>
            <p className="gates-app-h">{ai.draftTitle}</p>
          </div>
          <span className="gates-app-chip">{copy.navAi}</span>
        </div>
        <p className="gates-app-sub" style={{ marginTop: '0.7rem' }}>
          {ai.draftNote}
        </p>
        <div className="gates-line">
          <span>{ai.supplier}</span>
          <span>A12 × 20</span>
        </div>
        <div className="gates-line">
          <span>{ai.expect}</span>
        </div>
      </div>
    </div>
  );
}
