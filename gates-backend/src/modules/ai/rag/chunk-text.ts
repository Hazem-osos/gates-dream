export const RAG_CHUNK_TOKENS = 500;
export const RAG_CHUNK_OVERLAP = 50;

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

const SEPARATORS = ['\n\n', '\n', ' ', ''];

/**
 * Recursive character splitter targeting ~500 tokens with ~50-token overlap.
 */
export function splitIntoChunks(
  text: string,
  targetTokens = RAG_CHUNK_TOKENS,
  overlapTokens = RAG_CHUNK_OVERLAP
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;
  const pieces = splitRecursive(normalized, targetChars, SEPARATORS);
  if (pieces.length <= 1) return pieces.filter(Boolean);

  const chunks: string[] = [];
  for (let i = 0; i < pieces.length; i += 1) {
    let current = pieces[i];
    while (estimateTokenCount(current) < targetTokens && i + 1 < pieces.length) {
      i += 1;
      current = `${current}${current.endsWith('\n') ? '' : '\n'}${pieces[i]}`;
    }
    chunks.push(current.trim());
  }

  if (overlapChars <= 0 || chunks.length < 2) return chunks.filter(Boolean);

  const withOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const prevTail = i > 0 ? chunks[i - 1].slice(-overlapChars) : '';
    withOverlap.push(`${prevTail}${chunks[i]}`.trim());
  }
  return withOverlap.filter(Boolean);
}

function splitRecursive(text: string, maxChars: number, separators: string[]): string[] {
  if (text.length <= maxChars) return [text];
  const [sep, ...rest] = separators;
  if (!sep) {
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) parts.push(text.slice(i, i + maxChars));
    return parts;
  }
  const raw = text.split(sep);
  const out: string[] = [];
  let buffer = '';
  for (const part of raw) {
    const next = buffer ? `${buffer}${sep}${part}` : part;
    if (next.length <= maxChars) {
      buffer = next;
      continue;
    }
    if (buffer) out.push(buffer);
    if (part.length > maxChars) out.push(...splitRecursive(part, maxChars, rest));
    else buffer = part;
    buffer = buffer === part ? part : '';
  }
  if (buffer) out.push(buffer);
  return out;
}
