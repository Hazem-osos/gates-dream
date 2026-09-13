export const GATES_AI_ASK_EVENT = 'gates-ai:ask';

export function askGatesAi(prompt: string): void {
  if (typeof window === 'undefined') return;
  const text = prompt.trim();
  if (!text) return;
  window.dispatchEvent(new CustomEvent(GATES_AI_ASK_EVENT, { detail: { prompt: text } }));
}

export function buildScreenHelpPrompt(screenTitle: string): string {
  const name = screenTitle.trim() || 'هذه الشاشة';
  return `أنا في شاشة ${name}. اشرح لي بإيجاز أهم الوظائف هنا، وكيف أتعامل مع الأزرار والإجراءات المتاحة`;
}

export function triggerScreenHelp(screenTitle: string): void {
  askGatesAi(buildScreenHelpPrompt(screenTitle));
}
