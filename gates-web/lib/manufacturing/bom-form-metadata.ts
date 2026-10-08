export type BomFormMetadataLike = {
  stage?: string;
};

export function normalizeBomFormMetadata(raw: unknown): BomFormMetadataLike {
  if (raw == null) return {};
  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }
  const stage = obj.stage;
  return {
    stage: typeof stage === 'string' ? stage.trim() : undefined,
  };
}

export function bomStageFromFormMetadata(raw: unknown): string {
  return normalizeBomFormMetadata(raw).stage ?? '';
}
