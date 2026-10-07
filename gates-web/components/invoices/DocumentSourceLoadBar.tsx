'use client';

import { useCallback, useState } from 'react';
import { InvoiceSourceDocumentControl } from '@/components/invoices/InvoiceSourceDocumentControl';
import {
  SELECTABLE_SOURCE_TYPES,
  type SelectableSourceType,
  type SourceHydratePayload,
} from '@/lib/invoices/sourceDocument';

type ControlledProps = {
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  onTypeChange: (type: SelectableSourceType | '') => void;
};

type Props = {
  hasExistingLines: boolean;
  disabled?: boolean;
  onHydrate: (payload: SourceHydratePayload) => void;
  allowedTypes?: readonly SelectableSourceType[];
  className?: string;
} & Partial<ControlledProps>;

/** Default القسم / الرقم loader — same chip as sales & purchase invoices. */
export function DocumentSourceLoadBar({
  hasExistingLines,
  disabled = false,
  onHydrate,
  allowedTypes = SELECTABLE_SOURCE_TYPES,
  className,
  sourceType: controlledType,
  sourceId: controlledId,
  sourceNumber: controlledNumber,
  onTypeChange: controlledOnTypeChange,
}: Props) {
  const [localType, setLocalType] = useState('');
  const [localId, setLocalId] = useState('');
  const [localNumber, setLocalNumber] = useState('');

  const sourceType = controlledType ?? localType;
  const sourceId = controlledId ?? localId;
  const sourceNumber = controlledNumber ?? localNumber;

  const handleTypeChange = useCallback(
    (type: SelectableSourceType | '') => {
      if (controlledOnTypeChange) {
        controlledOnTypeChange(type);
        return;
      }
      setLocalType(type);
      setLocalId('');
      setLocalNumber('');
    },
    [controlledOnTypeChange]
  );

  const handleHydrate = useCallback(
    (payload: SourceHydratePayload) => {
      if (!controlledOnTypeChange) {
        setLocalType(payload.sourceType);
        setLocalId(payload.sourceId);
        setLocalNumber(payload.sourceNumber);
      }
      onHydrate(payload);
    },
    [controlledOnTypeChange, onHydrate]
  );

  return (
    <div className={className}>
      <InvoiceSourceDocumentControl
        sourceType={sourceType}
        sourceId={sourceId}
        sourceNumber={sourceNumber}
        hasExistingLines={hasExistingLines}
        disabled={disabled}
        allowedTypes={allowedTypes}
        onTypeChange={handleTypeChange}
        onHydrate={handleHydrate}
      />
    </div>
  );
}

export function resetDocumentSourceLoadBarState(
  setters: {
    setSourceType?: (v: string) => void;
    setSourceId?: (v: string) => void;
    setSourceNumber?: (v: string) => void;
  }
) {
  setters.setSourceType?.('');
  setters.setSourceId?.('');
  setters.setSourceNumber?.('');
}
