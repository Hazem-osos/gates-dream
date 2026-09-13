import { estimateTokenCount, splitIntoChunks } from '../../modules/ai/rag/chunk-text';
import { cosineSimilarity } from '../../modules/ai/rag/vector-math';
import { SearchCompanyDocumentsTool } from '../../modules/ai/tools/search-company-documents.tool';
import type { SecurityContext } from '../../modules/ai/tools/types';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';

function context(overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    userId: 'user-a',
    companyId: COMPANY_A,
    permissions: ['report:view'],
    ...overrides,
  };
}

describe('Gates AI RAG', () => {
  it('chunks long text with overlap', () => {
    const text = Array.from({ length: 80 }, (_, i) => `فقرة رقم ${i} حول عقد المقاولة.`).join('\n\n');
    const chunks = splitIntoChunks(text, 40, 8);
    expect(chunks.length).toBeGreaterThan(1);
    expect(estimateTokenCount(chunks[0])).toBeGreaterThan(8);
  });

  it('scores identical vectors as 1', () => {
    const a = Array.from({ length: 8 }, () => 0.5);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1);
    expect(cosineSimilarity(a, a.map((n) => -n))).toBeCloseTo(-1);
  });

  it('searchCompanyDocuments uses JWT companyId and never invents hits', async () => {
    const search = jest.fn().mockResolvedValue({ found: false, matches: [] });
    const tool = new SearchCompanyDocumentsTool({ search });
    const result = await tool.execute(
      { query: 'غرامة التأخير', companyId: COMPANY_B, category: 'CONTRACT' },
      context()
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { found: boolean; instruction: string };
      expect(data.found).toBe(false);
      expect(data.instruction).toMatch(/No matching document|was not found|لا/i);
    }
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_A, query: 'غرامة التأخير', category: 'CONTRACT' })
    );
    expect(search.mock.calls[0][0].companyId).not.toBe(COMPANY_B);
  });
});
