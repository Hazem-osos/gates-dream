import { ChevronDown } from 'lucide-react';

/** Small vertical connector communicating execution order between WHEN/IF/THEN blocks. */
export function FlowConnector() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <div className="flex flex-col items-center">
        <span className="h-4 w-px bg-slate-200" />
        <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
      </div>
    </div>
  );
}
