'use client';

import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { FileOutput } from 'lucide-react';

type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
};

export function DocumentFollowUpButton({ label, onClick, disabled, pending }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={`${formActionButtonClass} gap-1.5 border-[#0E78AA]/25 font-semibold text-[#094C6B]`}
      disabled={disabled || pending}
      onClick={onClick}
    >
      <FileOutput className="h-3.5 w-3.5" aria-hidden />
      {pending ? 'جاري التحضير…' : label}
    </Button>
  );
}
