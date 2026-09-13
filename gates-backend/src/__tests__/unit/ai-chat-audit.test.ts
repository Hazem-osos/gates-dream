import { AiAuditStatus } from '@prisma/client';
import {
  classifyChatAuditStatus,
  detectFinancialAdvisory,
  NO_MATCHING_RECORD_AR,
  OUT_OF_SCOPE_REFUSAL_AR,
} from '../../modules/ai/security/ai-chat-audit';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: { aiAuditLog: { create: jest.fn() } },
}));

describe('AI chat audit classifiers', () => {
  it('flags P&L / tax tools and keywords as financial advisory', () => {
    expect(
      detectFinancialAdvisory({
        toolNames: ['getProfitAndLossSummary'],
        prompt: 'ملخص',
        response: 'الأرقام',
      })
    ).toBe(true);
    expect(
      detectFinancialAdvisory({
        toolNames: [],
        prompt: 'ما هي ضريبة القيمة المضافة هذا الشهر؟',
        response: '',
      })
    ).toBe(true);
    expect(
      detectFinancialAdvisory({
        toolNames: ['universal_record_lookup'],
        prompt: 'اسم العميل',
        response: NO_MATCHING_RECORD_AR,
      })
    ).toBe(false);
  });

  it('classifies out-of-scope and RBAC blocks', () => {
    expect(
      classifyChatAuditStatus({
        response: OUT_OF_SCOPE_REFUSAL_AR,
        toolResults: [],
      })
    ).toBe(AiAuditStatus.OUT_OF_SCOPE);

    expect(
      classifyChatAuditStatus({
        response: 'عذراً',
        toolResults: [{ toolName: 'hr_payroll_tool', ok: false, error: 'PERMISSION_DENIED', data: {} }],
      })
    ).toBe(AiAuditStatus.BLOCKED_BY_RBAC);

    expect(
      classifyChatAuditStatus({
        failed: true,
        response: 'تعذّر',
        toolResults: [],
      })
    ).toBe(AiAuditStatus.FAILED);
  });
});
