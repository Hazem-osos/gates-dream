import { ChevronDown } from 'lucide-react';

/** Small vertical connector communicating execution order between WHEN/IF/THEN blocks. */
export function FlowConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <div className="gates-flow-pulse flex flex-col items-center">
        <span className="h-5 w-px bg-border" />
        <ChevronDown className="h-3.5 w-3.5 text-primary/60" />
      </div>
    </div>
  );
}
