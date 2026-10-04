type ClaimUpdate = (args: {
  where: { id: string; companyId: string; isPosted: boolean };
  data: { isPosted: boolean; postedAt: Date | null };
}) => Promise<{ count: number }>;

/** Flip isPosted inside the posting transaction so a second click cannot post twice. */
export async function claimDocumentPost(updateMany: ClaimUpdate, id: string, companyId: string) {
  const claimed = await updateMany({
    where: { id, companyId, isPosted: false },
    data: { isPosted: true, postedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new Error('المستند مرحّل بالفعل');
  }
}

export async function claimDocumentUnpost(updateMany: ClaimUpdate, id: string, companyId: string) {
  const claimed = await updateMany({
    where: { id, companyId, isPosted: true },
    data: { isPosted: false, postedAt: null },
  });
  if (claimed.count !== 1) {
    throw new Error('المستند غير مرحّل');
  }
}
