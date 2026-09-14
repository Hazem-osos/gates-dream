'use client';

import { gsap } from '../../lib/gsap';
import { COMPANY_STORY } from '../../lib/animations';

type Gsap = typeof gsap;
import type { MarketingCopy } from '../../lib/marketing/copy';
import { DEMO_COMPANY, type DemoLocale } from '../../lib/marketing/demo-company';
import {
  AnswerCard,
  BriefingCard,
  CustomerUpdateCard,
  DraftActionCard,
  JournalUpdateCard,
  PosSurface,
  ProbeTile,
  PurchaseEffectCard,
  StockWarningCard,
  WarehouseUpdateCard,
} from './story-surfaces';

const PHASE = COMPANY_STORY.phases;

export type CompanyStoryRefs = {
  pulse: HTMLDivElement | null;
  shopFloor: HTMLDivElement | null;
  pos: HTMLDivElement | null;
  token: HTMLDivElement | null;
  warehouse: HTMLDivElement | null;
  warehouseQty: HTMLSpanElement | null;
  journal: HTMLDivElement | null;
  customer: HTMLDivElement | null;
  warning: HTMLDivElement | null;
  briefing: HTMLDivElement | null;
  question: HTMLDivElement | null;
  probes: (HTMLDivElement | null)[];
  checks: (HTMLDivElement | null)[];
  probePulses: (SVGCircleElement | null)[];
  answer: HTMLDivElement | null;
  draft: HTMLDivElement | null;
  notSaved: HTMLParagraphElement | null;
  confirm: HTMLDivElement | null;
  created: HTMLDivElement | null;
  purchase: HTMLDivElement | null;
  purchaseQty: HTMLSpanElement | null;
  decision: HTMLDivElement | null;
  live: (HTMLDivElement | null)[];
  os: HTMLDivElement | null;
};

export function createCompanyStoryRefs(): CompanyStoryRefs {
  return {
    pulse: null,
    shopFloor: null,
    pos: null,
    token: null,
    warehouse: null,
    warehouseQty: null,
    journal: null,
    customer: null,
    warning: null,
    briefing: null,
    question: null,
    probes: [],
    checks: [],
    probePulses: [],
    answer: null,
    draft: null,
    notSaved: null,
    confirm: null,
    created: null,
    purchase: null,
    purchaseQty: null,
    decision: null,
    live: [],
    os: null,
  };
}

function nodes(refs: CompanyStoryRefs) {
  return {
    pulse: refs.pulse,
    shopFloor: refs.shopFloor,
    pos: refs.pos,
    token: refs.token,
    warehouse: refs.warehouse,
    journal: refs.journal,
    customer: refs.customer,
    warning: refs.warning,
    briefing: refs.briefing,
    question: refs.question,
    probes: refs.probes.filter(Boolean) as HTMLDivElement[],
    checks: refs.checks.filter(Boolean) as HTMLDivElement[],
    pulses: refs.probePulses.filter(Boolean) as SVGCircleElement[],
    answer: refs.answer,
    draft: refs.draft,
    notSaved: refs.notSaved,
    confirm: refs.confirm,
    created: refs.created,
    purchase: refs.purchase,
    decision: refs.decision,
    live: refs.live.filter(Boolean) as HTMLDivElement[],
    os: refs.os,
  };
}

export function hideCompanyStory(gsap: Gsap, refs: CompanyStoryRefs) {
  const n = nodes(refs);
  gsap.set(
    [
      n.pulse,
      n.shopFloor,
      n.pos,
      n.token,
      n.warehouse,
      n.journal,
      n.customer,
      n.warning,
      n.briefing,
      n.question,
      n.answer,
      n.draft,
      n.purchase,
      n.decision,
      n.os,
      ...n.probes,
      ...n.live,
    ].filter(Boolean),
    { opacity: 0 }
  );
  gsap.set(
    [n.pos, n.warehouse, n.journal, n.customer, n.warning, n.briefing, n.answer, n.draft, n.purchase].filter(Boolean),
    {
      scale: 0.92,
      y: 20,
      force3D: true,
    }
  );
  if (n.token) gsap.set(n.token, { scale: 0.6, x: 0, y: 0, force3D: true });
  gsap.set(n.checks, { opacity: 0, scale: 0.6 });
  gsap.set(n.pulses, { opacity: 0 });
  gsap.set([n.notSaved, n.confirm].filter(Boolean), { opacity: 0, y: 8 });
  if (n.created) gsap.set(n.created, { opacity: 0, y: 10 });
  gsap.set([n.question, n.decision, n.os].filter(Boolean), { y: 18 });
  gsap.set(n.probes, { y: 16 });
  gsap.set(n.live, { y: 8 });
  if (refs.warehouseQty) refs.warehouseQty.textContent = String(DEMO_COMPANY.warehouseAfterAct1);
  if (refs.purchaseQty) refs.purchaseQty.textContent = String(DEMO_COMPANY.retailShelf);
}

export function showCompanyStoryEnd(gsap: Gsap, refs: CompanyStoryRefs) {
  const n = nodes(refs);
  gsap.set(
    [n.shopFloor, n.pos, n.token, n.warehouse, n.journal, n.customer, n.warning, n.briefing, n.question, n.answer, n.draft, n.purchase, n.decision, ...n.probes],
    { opacity: 0 }
  );
  gsap.set(n.pulse, { opacity: 0.45, scale: 1.2 });
  gsap.set(n.live, { opacity: 1, y: 0 });
  gsap.set(n.os, { opacity: 1, y: 0 });
}

export function buildCompanyStoryTimeline({
  gsap,
  refs,
  world,
  dashWrap,
  locations,
  lines,
  compact,
}: {
  gsap: Gsap;
  refs: CompanyStoryRefs;
  world: HTMLDivElement;
  dashWrap: HTMLDivElement;
  locations: HTMLDivElement[];
  lines: SVGSVGElement | null;
  compact: boolean;
}) {
  const n = nodes(refs);
  const tl = gsap.timeline({ defaults: { ease: 'none', force3D: true } });
  const warehouseState = { n: DEMO_COMPANY.warehouseAfterAct1 };
  const purchaseState = { n: DEMO_COMPANY.retailShelf };

  const scaleEnd = {
    world: { scale: compact ? 0.78 : 0.7, x: 0, y: 34, rotateX: 14 },
    dash: { scale: compact ? 0.46 : 0.36, y: compact ? -40 : -70, rotateX: 10, opacity: 1 },
  };

  hideCompanyStory(gsap, refs);

  tl.to(n.pulse, { opacity: 0.95, scale: 1.22, duration: PHASE.holdEnd * 0.55 }, 0);
  tl.to(n.pulse, { opacity: 0.4, scale: 1.55, duration: PHASE.holdEnd * 0.45 }, PHASE.holdEnd * 0.55);

  tl.fromTo(
    world,
    { x: 0, y: 34, scale: scaleEnd.world.scale, rotateX: 14 },
    {
      x: compact ? -72 : -250,
      y: compact ? -70 : -168,
      scale: compact ? 1.42 : 1.88,
      rotateX: 8,
      duration: PHASE.retailEnd - PHASE.holdEnd,
      immediateRender: false,
    },
    PHASE.holdEnd
  );
  tl.fromTo(
    dashWrap,
    { opacity: 1, scale: scaleEnd.dash.scale, y: scaleEnd.dash.y, rotateX: 10 },
    { opacity: 0.16, scale: compact ? 0.3 : 0.22, duration: 0.05, immediateRender: false },
    PHASE.holdEnd
  );
  tl.fromTo(
    locations,
    { opacity: 1, scale: 1, y: 0 },
    { opacity: 0.22, duration: 0.05, immediateRender: false },
    PHASE.holdEnd
  );
  tl.to(n.pulse, { opacity: 1, scale: 1.08, duration: 0.04 }, PHASE.holdEnd);
  tl.to(n.shopFloor, { opacity: 0.7, duration: 0.04 }, PHASE.holdEnd + 0.02);
  tl.to(n.pos, { opacity: 1, scale: 1, y: 0, duration: 0.05 }, PHASE.holdEnd + 0.035);
  tl.to(n.token, { opacity: 1, scale: 1, duration: 0.03 }, PHASE.holdEnd + 0.05);
  tl.to({}, { duration: 0.02 }, PHASE.retailEnd - 0.02);

  tl.to(
    world,
    { x: compact ? -48 : -170, y: compact ? 8 : 28, scale: compact ? 1.12 : 1.28, rotateX: 10, duration: 0.05 },
    PHASE.retailEnd
  );
  tl.to(n.pos, { opacity: 0.28, scale: 0.9, y: compact ? -40 : -70, duration: 0.05 }, PHASE.retailEnd);
  tl.to(
    n.token,
    {
      motionPath: {
        path: '#gates-story-token-path',
        align: '#gates-story-token-path',
        alignOrigin: [0.5, 0.5],
      },
      duration: PHASE.tokenEnd - PHASE.retailEnd - 0.02,
    },
    PHASE.retailEnd
  );
  tl.to(n.warehouse, { opacity: 1, scale: 1, y: 0, duration: 0.035 }, PHASE.retailEnd + 0.02);
  tl.to(
    warehouseState,
    {
      n: DEMO_COMPANY.warehouseAfterRetail,
      duration: 0.03,
      onUpdate: () => {
        if (refs.warehouseQty) refs.warehouseQty.textContent = String(Math.round(warehouseState.n));
      },
    },
    PHASE.retailEnd + 0.03
  );
  tl.to(n.journal, { opacity: 1, scale: 1, y: 0, duration: 0.03 }, PHASE.retailEnd + 0.055);
  tl.to(n.customer, { opacity: 1, scale: 1, y: 0, duration: 0.03 }, PHASE.retailEnd + 0.075);
  tl.to({}, { duration: 0.02 }, PHASE.tokenEnd - 0.02);

  tl.to([n.warehouse, n.journal, n.customer, n.pos, n.token, n.shopFloor], { opacity: 0, duration: 0.03 }, PHASE.tokenEnd);
  tl.to(n.warning, { opacity: 1, scale: 1, y: 0, duration: 0.035 }, PHASE.tokenEnd + 0.01);
  tl.to(
    world,
    { x: 0, y: 8, scale: compact ? 0.9 : 0.86, rotateX: 8, duration: PHASE.briefingEnd - PHASE.tokenEnd },
    PHASE.tokenEnd
  );
  tl.to(
    dashWrap,
    { opacity: 1, scale: compact ? 0.7 : 0.82, y: compact ? -8 : -18, rotateX: 8, duration: 0.05 },
    PHASE.tokenEnd + 0.02
  );
  tl.to(n.briefing, { opacity: 1, scale: 1, y: 0, duration: 0.04 }, PHASE.tokenEnd + 0.035);
  tl.to({}, { duration: 0.02 }, PHASE.briefingEnd - 0.02);

  tl.to(n.warning, { opacity: 0, y: -12, duration: 0.025 }, PHASE.briefingEnd);
  tl.to(n.briefing, { opacity: 0.18, scale: 0.94, y: compact ? -70 : -96, duration: 0.04 }, PHASE.briefingEnd);
  tl.to(n.question, { opacity: 1, y: 0, duration: 0.04 }, PHASE.briefingEnd + 0.01);
  tl.to(world, { scale: compact ? 0.82 : 0.78, y: 16, duration: 0.05 }, PHASE.briefingEnd);
  n.probes.forEach((probe, i) => {
    tl.to(probe, { opacity: 1, scale: 1, y: 0, duration: 0.03 }, PHASE.briefingEnd + 0.03 + i * 0.012);
    const pulse = n.pulses[i];
    if (pulse) {
      tl.to(pulse, { opacity: 0.95, duration: 0.015 }, PHASE.briefingEnd + 0.035 + i * 0.012);
      tl.to(
        pulse,
        {
          motionPath: {
            path: `#gates-story-probe-${i}`,
            align: `#gates-story-probe-${i}`,
            alignOrigin: [0.5, 0.5],
          },
          duration: 0.045,
        },
        PHASE.briefingEnd + 0.04 + i * 0.012
      );
      tl.to(
        pulse,
        {
          motionPath: {
            path: `#gates-story-probe-${i}`,
            align: `#gates-story-probe-${i}`,
            alignOrigin: [0.5, 0.5],
            start: 1,
            end: 0,
          },
          duration: 0.035,
        },
        PHASE.briefingEnd + 0.09 + i * 0.01
      );
    }
    if (n.checks[i]) {
      tl.to(n.checks[i], { opacity: 1, scale: 1, duration: 0.02 }, PHASE.briefingEnd + 0.08 + i * 0.012);
    }
  });
  tl.to(n.answer, { opacity: 1, scale: 1, y: 0, duration: 0.04 }, PHASE.briefingEnd + 0.11);
  tl.to({}, { duration: 0.02 }, PHASE.investigateEnd - 0.02);

  tl.to([n.question, n.answer, n.briefing, ...n.probes], { opacity: 0, duration: 0.03 }, PHASE.investigateEnd);
  tl.to(dashWrap, { opacity: 0.2, duration: 0.04 }, PHASE.investigateEnd);
  tl.to(n.draft, { opacity: 1, scale: 1, y: 0, duration: 0.045 }, PHASE.investigateEnd + 0.01);
  tl.to(n.notSaved, { opacity: 1, y: 0, duration: 0.03 }, PHASE.investigateEnd + 0.03);
  tl.to(n.confirm, { opacity: 1, y: 0, scale: 1, duration: 0.03 }, PHASE.investigateEnd + 0.045);
  tl.to(n.confirm, { scale: 0.94, duration: 0.02 }, PHASE.investigateEnd + 0.08);
  tl.to(n.confirm, { scale: 1, duration: 0.015 }, PHASE.investigateEnd + 0.1);
  tl.to(n.created, { opacity: 1, y: 0, duration: 0.03 }, PHASE.investigateEnd + 0.105);
  tl.to(n.notSaved, { opacity: 0.35, duration: 0.02 }, PHASE.investigateEnd + 0.105);
  tl.to({}, { duration: 0.02 }, PHASE.draftEnd - 0.02);

  tl.to(n.draft, { opacity: 0.18, scale: 0.9, y: compact ? -50 : -80, duration: 0.035 }, PHASE.draftEnd);
  tl.to(n.purchase, { opacity: 1, scale: 1, y: 0, duration: 0.04 }, PHASE.draftEnd + 0.015);
  tl.to(
    purchaseState,
    {
      n: DEMO_COMPANY.expectedAfterPurchase,
      duration: 0.05,
      onUpdate: () => {
        if (refs.purchaseQty) refs.purchaseQty.textContent = String(Math.round(purchaseState.n));
      },
    },
    PHASE.draftEnd + 0.03
  );
  tl.to(dashWrap, { opacity: 0.55, scale: compact ? 0.58 : 0.5, duration: 0.05 }, PHASE.draftEnd + 0.02);
  tl.to({}, { duration: 0.02 }, PHASE.purchaseEnd - 0.02);

  tl.to([n.purchase, n.draft, n.pulse], { opacity: 0, duration: 0.03 }, PHASE.purchaseEnd);
  tl.to(
    world,
    { x: 0, y: 0, scale: 1, rotateX: 4, duration: PHASE.decisionEnd - PHASE.purchaseEnd },
    PHASE.purchaseEnd
  );
  tl.to(
    dashWrap,
    { opacity: 1, scale: 1, y: 0, rotateX: 6, duration: PHASE.decisionEnd - PHASE.purchaseEnd },
    PHASE.purchaseEnd
  );
  tl.to(locations, { opacity: 0.12, duration: 0.04 }, PHASE.purchaseEnd);
  tl.to(n.decision, { opacity: 1, y: 0, duration: 0.05 }, PHASE.purchaseEnd + 0.03);
  tl.to({}, { duration: 0.02 }, PHASE.decisionEnd - 0.02);

  tl.to(n.decision, { opacity: 0, y: -16, duration: 0.03 }, PHASE.decisionEnd);
  tl.to(world, { ...scaleEnd.world, duration: PHASE.networkEnd - PHASE.decisionEnd }, PHASE.decisionEnd);
  tl.to(dashWrap, { ...scaleEnd.dash, duration: PHASE.networkEnd - PHASE.decisionEnd }, PHASE.decisionEnd);
  tl.to(locations, { opacity: 1, scale: 1, y: 0, duration: 0.05 }, PHASE.decisionEnd + 0.02);
  tl.to(lines, { opacity: 0.72, duration: 0.04 }, PHASE.decisionEnd + 0.03);
  n.live.forEach((chip, i) => {
    tl.to(chip, { opacity: 1, y: 0, duration: 0.03 }, PHASE.decisionEnd + 0.04 + i * 0.012);
  });
  tl.to(n.pulse, { opacity: 0.5, scale: 1.18, duration: 0.04 }, PHASE.decisionEnd + 0.05);
  tl.to({}, { duration: 0.02 }, PHASE.networkEnd - 0.02);

  tl.to(n.os, { opacity: 1, y: 0, duration: 0.06 }, PHASE.networkEnd);
  tl.to({}, { duration: 0.03 }, PHASE.osEnd - 0.03);

  return tl;
}

export function CompanyStoryOverlay({
  copy,
  sample,
  locale,
  refs,
}: {
  copy: MarketingCopy['companyStory'];
  sample: string;
  locale: DemoLocale;
  refs: CompanyStoryRefs;
}) {
  const probes = [
    copy.probeSales,
    copy.probeInventory,
    copy.probePurchasing,
    copy.probeAccounting,
    copy.probeBranches,
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        ref={(el) => {
          refs.shopFloor = el;
        }}
        className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[#d7eaf4]/70 to-transparent opacity-0"
      />

      <p
        ref={(el) => {
          refs.question = el;
        }}
        className="absolute inset-x-[6vw] top-[10%] text-center font-editorial text-[clamp(1.3rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.04em] text-[#071b2b] opacity-0"
      >
        {copy.question}
      </p>

      <div
        ref={(el) => {
          refs.decision = el;
        }}
        className="absolute inset-x-[6vw] top-[16%] z-10 text-center opacity-0"
      >
        <p className="font-editorial text-[clamp(2.2rem,7vw,6.4rem)] font-semibold leading-none tracking-[-0.05em] text-[#0b6fa4]/30">
          {copy.decision1}
        </p>
        <p className="mt-2 font-editorial text-[clamp(1.3rem,3.6vw,3rem)] font-semibold tracking-[-0.04em] text-[#071b2b]/45">
          {copy.decision2}
        </p>
      </div>

      <div
        ref={(el) => {
          refs.os = el;
        }}
        className="absolute inset-x-[6vw] top-[14%] z-10 text-center opacity-0"
      >
        <p className="font-editorial text-[clamp(1.8rem,5.4vw,4.6rem)] font-semibold leading-none tracking-[-0.045em] text-[#071b2b]/55">
          {copy.os1}
        </p>
        <p className="mt-3 font-editorial text-[clamp(1.5rem,4.2vw,3.4rem)] font-semibold tracking-[-0.04em] text-[#0b6fa4]/70">
          {copy.os2}
        </p>
      </div>

      <div className="absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2">
        <PosSurface
          copy={copy}
          sample={sample}
          locale={locale}
          surfaceRef={(el) => {
            refs.pos = el;
          }}
        />
      </div>

      <div
        ref={(el) => {
          refs.token = el;
        }}
        className="absolute left-1/2 top-[48%] z-40 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1499d6] opacity-0"
        style={{ boxShadow: '0 0 0 8px rgba(20,153,214,0.16)' }}
      />

      <div className="absolute left-1/2 top-[18%] z-20 -translate-x-1/2 md:left-[8%] md:top-[22%] md:translate-x-0">
        <WarehouseUpdateCard
          copy={copy}
          surfaceRef={(el) => {
            refs.warehouse = el;
          }}
          qtyRef={(el) => {
            refs.warehouseQty = el;
          }}
        />
      </div>
      <div className="absolute left-1/2 top-[20%] z-20 -translate-x-1/2 md:left-auto md:right-[8%] md:top-[24%] md:translate-x-0">
        <JournalUpdateCard
          copy={copy}
          locale={locale}
          surfaceRef={(el) => {
            refs.journal = el;
          }}
        />
      </div>
      <div className="absolute bottom-[16%] left-1/2 z-20 -translate-x-1/2 md:bottom-[18%] md:left-[12%] md:translate-x-0">
        <CustomerUpdateCard
          copy={copy}
          locale={locale}
          surfaceRef={(el) => {
            refs.customer = el;
          }}
        />
      </div>

      <div className="absolute left-[8%] top-[28%] z-20">
        <StockWarningCard
          copy={copy}
          surfaceRef={(el) => {
            refs.warning = el;
          }}
        />
      </div>

      <div className="absolute left-1/2 top-[58%] z-20 -translate-x-1/2">
        <BriefingCard
          copy={copy}
          sample={sample}
          surfaceRef={(el) => {
            refs.briefing = el;
          }}
        />
      </div>

      <div className="absolute inset-x-[5vw] top-[38%] z-20 flex flex-wrap justify-center gap-2 md:top-[36%] md:gap-3">
        {probes.map((label, i) => (
          <ProbeTile
            key={label}
            label={label}
            tileRef={(el) => {
              refs.probes[i] = el;
            }}
            checkRef={(el) => {
              refs.checks[i] = el;
            }}
          />
        ))}
      </div>

      <div className="absolute left-1/2 top-[68%] z-20 -translate-x-1/2">
        <AnswerCard
          copy={copy}
          surfaceRef={(el) => {
            refs.answer = el;
          }}
        />
      </div>

      <div className="absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2">
        <DraftActionCard
          copy={copy}
          sample={sample}
          locale={locale}
          surfaceRef={(el) => {
            refs.draft = el;
          }}
          notSavedRef={(el) => {
            refs.notSaved = el;
          }}
          confirmRef={(el) => {
            refs.confirm = el;
          }}
          createdRef={(el) => {
            refs.created = el;
          }}
        />
      </div>

      <div className="absolute left-1/2 top-[50%] z-20 -translate-x-1/2 -translate-y-1/2">
        <PurchaseEffectCard
          copy={copy}
          locale={locale}
          surfaceRef={(el) => {
            refs.purchase = el;
          }}
          qtyRef={(el) => {
            refs.purchaseQty = el;
          }}
        />
      </div>

      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 1000 700" fill="none" aria-hidden>
        <path id="gates-story-token-path" d="M500 340 C 620 280, 760 240, 820 210 C 780 300, 620 360, 500 390" />
        <path id="gates-story-probe-0" d="M500 300 C 400 250, 280 230, 220 250" />
        <path id="gates-story-probe-1" d="M500 300 C 430 220, 360 180, 340 160" />
        <path id="gates-story-probe-2" d="M500 300 C 500 230, 500 190, 500 150" />
        <path id="gates-story-probe-3" d="M500 300 C 570 220, 640 180, 660 160" />
        <path id="gates-story-probe-4" d="M500 300 C 600 250, 720 230, 780 250" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            ref={(el) => {
              refs.probePulses[i] = el;
            }}
            r="5"
            fill="#1499d6"
          />
        ))}
      </svg>
    </div>
  );
}

export function LocationLiveChip({
  label,
  chipRef,
}: {
  label: string;
  chipRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={chipRef}
      className="absolute left-1/2 top-[-0.4rem] z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0b6fa4] px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.08em] text-white opacity-0"
    >
      {label}
    </div>
  );
}
