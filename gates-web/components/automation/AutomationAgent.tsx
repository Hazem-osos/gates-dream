'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { GatesDataNetwork } from '@/components/visual/GatesDataNetwork';
import { catalogText, operatorLabel } from '@/lib/automation/labels';
import { findActionDef, findEvent } from '@/lib/automation/metadata';
import { suggestAutomation, type RuleSuggestion } from '@/lib/automation/suggest-rule';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';

const EXAMPLES = [
  'automation.agentExampleInvoice',
  'automation.agentExampleStock',
  'automation.agentExampleSalary',
  'automation.agentExampleProject',
] as const;

export function AutomationAgent() {
  const { t } = useI18n();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { data } = useAutomationMetadataQuery();
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [phase, setPhase] = useState(0);
  const [asked, setAsked] = useState(false);
  const [suggestion, setSuggestion] = useState<RuleSuggestion | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const ask = (raw = text) => {
    const sentence = raw.trim();
    if (sentence.length < 3) return;
    setText(sentence);
    clearTimers();
    setThinking(true);
    setAsked(true);
    setSuggestion(null);
    setPhase(0);
    const wait = reduce ? 0 : 280;
    timers.current = [1, 2].map((step) =>
      window.setTimeout(() => setPhase(step), wait * step),
    );
    timers.current.push(
      window.setTimeout(() => {
        setSuggestion(suggestAutomation(sentence));
        setThinking(false);
      }, wait * 3),
    );
  };

  const event = findEvent(data?.data, suggestion?.eventType);
  const action = findActionDef(data?.data, suggestion?.actions[0]?.type);
  const condition = suggestion?.conditions[0];
  const field = event?.fields.find((item) => item.key === condition?.field);

  const openSuggestion = () => {
    if (!suggestion) return;
    const params = new URLSearchParams({
      event: suggestion.eventType,
      name: suggestion.name,
    });
    if (condition) {
      params.set('field', condition.field);
      params.set('op', condition.operator);
      params.set('value', String(condition.value));
    }
    params.set('action', suggestion.actions[0]?.type ?? 'gates.createNotification');
    router.push(`/automation/new?${params.toString()}`);
  };

  const phases = [t('automation.thinkingRead'), t('automation.thinkingMatch'), t('automation.thinkingDraft')];

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-primary text-primary-foreground shadow-[0_24px_80px_-32px_rgba(8,47,73,0.65)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.22),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(0,0,0,0.35),transparent_42%)]" />
      <GatesDataNetwork className="absolute inset-0 h-full w-full" opacity={0.34} />
      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('automation.agentEyebrow')}
          </span>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">{t('automation.agentTitle')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">{t('automation.agentLead')}</p>

          <div className="mt-6 rounded-2xl border border-white/15 bg-black/15 p-2 backdrop-blur-sm">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  ask();
                }
              }}
              rows={3}
              placeholder={t('automation.agentPlaceholder')}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/45"
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1">
              <p className="text-[11px] text-white/55">{t('automation.agentHint')}</p>
              <button
                type="button"
                onClick={() => ask()}
                disabled={text.trim().length < 3 || thinking}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-[var(--primary-hover)] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {thinking ? t('automation.agentThinking') : t('automation.agentApply')}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => ask(t(key))}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-start text-[11px] text-white/85 transition hover:bg-white/20"
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[280px] flex-col justify-end">
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.ol
                key="thinking"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur-md"
              >
                {phases.map((label, index) => {
                  const active = index <= phase;
                  return (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                          active ? 'bg-white text-[var(--primary-hover)]' : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className={active ? 'text-white' : 'text-white/45'}>{label}</span>
                    </li>
                  );
                })}
              </motion.ol>
            ) : suggestion && event ? (
              <motion.div
                key={suggestion.eventType + suggestion.name}
                initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl bg-white p-4 text-foreground shadow-xl"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t('automation.liveRule')}</p>
                <p className="mt-2 text-base font-semibold">{catalogText(t, event.labelKey)}</p>
                <dl className="mt-4 flex flex-col gap-2 text-sm">
                  <div>
                    <dt className="text-[11px] font-bold text-foreground-muted">{t('automation.whenLabel')}</dt>
                    <dd>{catalogText(t, event.labelKey)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-foreground-muted">{t('automation.ifLabel')}</dt>
                    <dd className="text-foreground-muted">
                      {condition
                        ? `${catalogText(t, field?.labelKey) || condition.field} ${operatorLabel(t, condition.operator, field?.type)} ${String(condition.value)}`
                        : t('automation.everyTime')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold text-foreground-muted">{t('automation.thenLabel')}</dt>
                    <dd>{action ? catalogText(t, action.labelKey) : t('automation.thenPrompt')}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={openSuggestion}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  {t('automation.agentApply')}
                </button>
              </motion.div>
            ) : asked ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/15 bg-black/20 p-4 text-sm text-white/75"
              >
                {t('automation.agentEmpty')}
              </motion.p>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-white/70">
                {t('automation.agentHint')}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
