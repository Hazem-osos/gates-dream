'use client';

import { useState } from 'react';
import { ManufacturingTheoreticalCapabilityResults } from '@/components/manufacturing/ManufacturingTheoreticalCapabilityResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterItemSelect,
  ReportFilterSection,
  ReportFilterWarehouseSelect,
} from '@/components/report/reportFilterFields';

export default function TheoreticalCapabilityPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const handlePreview = () => {
    const params: Record<string, string> = {};
    if (itemId) params.itemId = itemId;
    if (warehouseId) params.warehouseId = warehouseId;
    setPreviewQuery(params);
  };

  return (
    <ManufacturingReportChrome
      title="إمكانية التصنيع النظرية"
      onPreview={handlePreview}
      onReset={() => {
        setItemId('');
        setWarehouseId('');
        setPreviewQuery(null);
      }}
      below={
        previewQuery ? (
          <ManufacturingTheoreticalCapabilityResults query={previewQuery} />
        ) : null
      }
    >
      <ReportFilterSection title="المرشحات">
        <ReportFilterItemSelect
          label="الخامة"
          value={itemId}
          onChange={setItemId}
          emptyLabel="كل الخامات في النماذج"
        />
        <ReportFilterWarehouseSelect
          label="المخزن"
          value={warehouseId}
          onChange={setWarehouseId}
          emptyLabel="كل المخازن"
        />
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
