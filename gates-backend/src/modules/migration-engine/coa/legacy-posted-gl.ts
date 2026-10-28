/** Posted journal filter confirmed from LegacyForensic reconciliation baseline. */
export const LEGACY_POSTED_GL_HEADER_WHERE = `
  RTRIM(h.Status) = 'Post'
  AND RTRIM(ISNULL(h.Deleted, '')) <> 'T'
`;

export const LEGACY_GL_DETAIL_JOIN = `
  INNER JOIN dbo.GLTrxHeader h
    ON h.CompanyCode = d.CompanyCode
   AND h.BranchCode = d.BranchCode
   AND h.YearID = d.YearID
   AND h.GlNum = d.GLNum
`;

/** Posted details without multiplying lines when two headers share GlNum (invoice + receipt). */
export const LEGACY_POSTED_DETAIL_EXISTS = `
  EXISTS (
    SELECT 1 FROM dbo.GLTrxHeader h
    WHERE h.CompanyCode = d.CompanyCode
      AND h.BranchCode = d.BranchCode
      AND h.YearID = d.YearID
      AND h.GlNum = d.GLNum
      AND ${LEGACY_POSTED_GL_HEADER_WHERE}
  )
`;
