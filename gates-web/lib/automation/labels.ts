/**
 * Resolves backend labelKey / descriptionKey through the existing i18n tree.
 * Description keys are `….name.description`; messages store those under
 * `*Descriptions.name` so a key can be both a label and a parent of a description.
 */
type Translate = (key: string, vars?: Record<string, string | number>) => string;

const DESCRIPTION_BUCKET: Record<string, string> = {
  events: 'eventDescriptions',
  actions: 'actionDescriptions',
  fields: 'fieldDescriptions',
  templates: 'templateDescriptions',
};

export function catalogText(t: Translate, key: string | undefined): string {
  if (!key) return '';
  const parts = key.split('.');
  if (parts.at(-1) === 'description' && parts.length >= 3) {
    const name = parts.at(-2) as string;
    const section = parts.at(-3) as string;
    const bucket = DESCRIPTION_BUCKET[section];
    if (bucket) {
      const prefix = parts.slice(0, -3).join('.');
      const mapped = `${prefix}.${bucket}.${name}`;
      const text = t(mapped);
      if (text !== mapped) return text;
    }
  }
  const text = t(key);
  return text === key ? key.split('.').pop() ?? key : text;
}

const DATE_OPERATOR_KEYS: Record<string, string> = {
  gt: 'automation.operators.after',
  gte: 'automation.operators.onOrAfter',
  lt: 'automation.operators.before',
  lte: 'automation.operators.onOrBefore',
};

export function operatorLabel(t: Translate, operator: string, fieldType?: string): string {
  if (fieldType === 'date') {
    const semantic = DATE_OPERATOR_KEYS[operator];
    if (semantic) {
      const text = t(semantic);
      if (text !== semantic) return text;
    }
  }
  const key = `automation.operators.${operator}`;
  const text = t(key);
  return text === key ? operator : text;
}

export function categoryLabel(t: Translate, category: string): string {
  const key = `automation.categories.${category}`;
  const text = t(key);
  return text === key ? category : text;
}

export function enumLabel(t: Translate, value: string): string {
  const key = `automation.enums.${value}`;
  const text = t(key);
  return text === key ? value : text;
}
