/**
 * Regression: the paged migration report routes (issues, account mapping, coverage
 * fields/tables) returned 500. validate() replaces req.query with the parsed value
 * (gapsOnly becomes a boolean) and each handler parses it again with the same schema,
 * which used to reject the boolean.
 */
import { migrationReportPageQuerySchema } from '../../modules/migration-engine/schemas/migration-engine.schema';

describe('migrationReportPageQuerySchema', () => {
  it('parses raw query strings', () => {
    expect(migrationReportPageQuerySchema.parse({ page: '2', limit: '50', gapsOnly: 'true' })).toEqual({
      page: 2,
      limit: 50,
      gapsOnly: true,
    });
  });

  it('accepts its own output (validate() middleware then handler re-parse)', () => {
    for (const raw of [{}, { gapsOnly: '1' }, { gapsOnly: 'false' }, { page: '3' }]) {
      const once = migrationReportPageQuerySchema.parse(raw);
      expect(migrationReportPageQuerySchema.parse(once)).toEqual(once);
    }
  });

  it('defaults gapsOnly to false', () => {
    expect(migrationReportPageQuerySchema.parse({}).gapsOnly).toBe(false);
  });
});
