import { z } from 'zod';
import type { DocumentSearchHit } from '../rag/document-search.service';
import { BaseAiTool } from './base-ai-tool';
import { optionalUuid } from './shared-schemas';
import type { SecurityContext } from './types';

const CATEGORIES = [
  'CONTRACT',
  'BOQ_SPECIFICATION',
  'HR_POLICY',
  'COMPANY_BYLAW',
  'TAX_REGULATION',
  'OTHER',
] as const;

const paramsSchema = z.object({
  query: z.string().trim().min(2).max(2000).describe('Natural-language question about a company document'),
  category: z.enum(CATEGORIES).optional(),
  referenceId: optionalUuid.describe('Optional project / contractor / contract id'),
  topK: z.number().int().min(1).max(12).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type DocumentSearchPort = {
  search: (input: {
    companyId: string;
    query: string;
    category?: (typeof CATEGORIES)[number];
    referenceId?: string;
    topK?: number;
  }) => Promise<{ found: boolean; matches: DocumentSearchHit[] }>;
};

export class SearchCompanyDocumentsTool extends BaseAiTool<Params> {
  readonly name = 'searchCompanyDocuments';
  readonly description =
    'Semantic search over this company\'s uploaded contracts, BOQ specs, HR policies, bylaws, and tax documents. Cite sources. Never invent clauses.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';

  constructor(private readonly search: DocumentSearchPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const result = await this.search.search({
      companyId: context.companyId,
      query: params.query,
      category: params.category,
      referenceId: params.referenceId,
      topK: params.topK,
    });

    if (!result.found) {
      return {
        found: false,
        matches: [],
        instruction:
          'No matching document was found for this company. Say so clearly. Do not invent contract clauses, articles, or policy text.',
      };
    }

    return {
      found: true,
      matches: result.matches.map((hit) => ({
        title: hit.documentTitle,
        fileName: hit.fileName,
        category: hit.category,
        citation: hit.citation,
        page: hit.page,
        section: hit.section,
        excerpt: hit.content.slice(0, 1200),
        similarity: hit.similarity,
      })),
      instruction:
        'Answer only from these excerpts. Cite the document name and section/page, e.g. وفقاً للمادة (4) من «عقد مقاولة مشروع برج النور».',
    };
  }
}
