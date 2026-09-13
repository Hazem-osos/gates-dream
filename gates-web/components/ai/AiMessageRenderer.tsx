'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpLeft } from 'lucide-react';
import { splitScreenMentions } from '@/lib/ai/screen-route-map';

export function AiScreenChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="mx-1 inline-flex items-center gap-1 rounded bg-[#0E79AA]/10 px-2 py-0.5 text-xs font-medium text-[#0E79AA] transition-colors hover:bg-[#0E79AA]/20"
    >
      <span>{label}</span>
      <ArrowUpLeft className="h-3 w-3" />
    </Link>
  );
}

function renderScreenAwareText(text: string, keyPrefix: string): ReactNode[] {
  return splitScreenMentions(text).map((piece, index) => {
    if (piece.type === 'screen' && piece.href) {
      return <AiScreenChip key={`${keyPrefix}-s-${index}`} label={piece.value} href={piece.href} />;
    }
    return <span key={`${keyPrefix}-t-${index}`}>{piece.value}</span>;
  });
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(
        <strong key={`b-${index}`} className="font-bold text-[#0E79AA]">
          {renderScreenAwareText(part.slice(2, -2), `b-${index}`)}
        </strong>
      );
      return;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${index}`}
          className="rounded bg-[#E6F0F7] px-1 py-0.5 font-mono text-[11px] text-[#094C6B]"
        >
          {part.slice(1, -1)}
        </code>
      );
      return;
    }
    nodes.push(...renderScreenAwareText(part, `t-${index}`));
  });
  return nodes;
}

export function AiMessageRenderer({ text }: { text: string }) {
  if (!text.trim()) return null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-1 list-disc space-y-1 pr-4 text-sm leading-6 text-slate-700">
        {bullets.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*•]\s+/, ''));
      return;
    }
    flushBullets();
    if (!trimmed) {
      nodes.push(<div key={`br-${index}`} className="h-1.5" />);
      return;
    }
    if (trimmed.startsWith('### ')) {
      nodes.push(
        <h4 key={index} className="mt-2 text-sm font-bold text-[#0E79AA]">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      const title = trimmed.replace(/^#+\s+/, '');
      nodes.push(
        <h3 key={index} className="mt-2 text-[15px] font-bold text-[#0E79AA]">
          {renderInline(title)}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('```')) {
      return;
    }
    nodes.push(
      <p key={index} className="text-sm leading-6 text-slate-700">
        {renderInline(trimmed)}
      </p>
    );
  });
  flushBullets();

  return <div className="space-y-0.5">{nodes}</div>;
}
