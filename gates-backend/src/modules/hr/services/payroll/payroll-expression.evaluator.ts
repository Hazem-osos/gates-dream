import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../../shared/middleware/error-handler';

export type PayrollExprContext = Record<string, number>;

const ALLOWED_FUNCS = new Set(['min', 'max', 'round', 'abs']);

type Tok =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: 'lp' }
  | { k: 'rp' }
  | { k: 'comma' };

function tokenize(expr: string): Tok[] {
  const s = expr.replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') {
      out.push({ k: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ k: 'rp' });
      i++;
      continue;
    }
    if (c === ',') {
      out.push({ k: 'comma' });
      i++;
      continue;
    }
    if ('+-*/'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new AppError(422, `Invalid number in expression: ${raw}`);
      out.push({ k: 'num', v: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_.]/.test(s[j])) j++;
      out.push({ k: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    throw new AppError(422, `Unexpected character in expression: ${c}`);
  }
  return out;
}

/** Safe numeric expression evaluator — no eval / Function. */
export function evaluatePayrollExpression(expr: string, ctx: PayrollExprContext): number {
  const tokens = tokenize(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parsePrimary = (): number => {
    const t = peek();
    if (!t) throw new AppError(422, 'Unexpected end of expression');
    if (t.k === 'num') {
      consume();
      return t.v;
    }
    if (t.k === 'id') {
      const idTok = consume() as { k: 'id'; v: string };
      const next = peek();
      if (next?.k === 'lp') {
        consume();
        if (!ALLOWED_FUNCS.has(idTok.v)) {
          throw new AppError(422, `Function not allowed: ${idTok.v}`);
        }
        const args: number[] = [];
        if (peek()?.k !== 'rp') {
          args.push(parseExpr());
          while (peek()?.k === 'comma') {
            consume();
            args.push(parseExpr());
          }
        }
        if (peek()?.k !== 'rp') throw new AppError(422, 'Expected )');
        consume();
        return applyFunc(idTok.v, args);
      }
      if (idTok.v in ctx) return ctx[idTok.v];
      throw new AppError(422, `Unknown variable: ${idTok.v}`);
    }
    if (t.k === 'lp') {
      consume();
      const v = parseExpr();
      if (peek()?.k !== 'rp') throw new AppError(422, 'Expected )');
      consume();
      return v;
    }
    if (t.k === 'op' && (t.v === '+' || t.v === '-')) {
      consume();
      const v = parsePrimary();
      return t.v === '-' ? -v : v;
    }
    throw new AppError(422, 'Invalid expression');
  };

  const parseMul = (): number => {
    let left = parsePrimary();
    while (peek()?.k === 'op' && ['*', '/'].includes((peek() as { v: string }).v)) {
      const op = (consume() as { v: string }).v;
      const right = parsePrimary();
      if (op === '/' && right === 0) throw new AppError(422, 'Division by zero');
      left = decimalOp(left, op, right);
    }
    return left;
  };

  const parseExpr = (): number => {
    let left = parseMul();
    while (peek()?.k === 'op' && ['+', '-'].includes((peek() as { v: string }).v)) {
      const op = (consume() as { v: string }).v;
      const right = parseMul();
      left = decimalOp(left, op, right);
    }
    return left;
  };

  const result = parseExpr();
  if (pos < tokens.length) throw new AppError(422, 'Unexpected tokens in expression');
  return result;
}

function decimalOp(a: number, op: string, b: number): number {
  const da = new Decimal(a);
  const db = new Decimal(b);
  if (op === '+') return da.plus(db).toNumber();
  if (op === '-') return da.minus(db).toNumber();
  if (op === '*') return da.times(db).toNumber();
  if (op === '/') return da.div(db).toNumber();
  throw new AppError(422, `Unknown operator ${op}`);
}

function applyFunc(name: string, args: number[]): number {
  if (name === 'min') return Math.min(...args);
  if (name === 'max') return Math.max(...args);
  if (name === 'abs') return Math.abs(args[0] ?? 0);
  if (name === 'round') {
    const v = args[0] ?? 0;
    const digits = args[1] ?? 2;
    const f = Math.pow(10, digits);
    return Math.round(v * f) / f;
  }
  throw new AppError(422, `Unknown function ${name}`);
}

/** Boolean conditions: comparisons only, combined with && || */
export function evaluatePayrollCondition(expr: string, ctx: PayrollExprContext): boolean {
  const trimmed = expr.trim();
  if (!trimmed || trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const parts = trimmed.split(/\s*\|\|\s*/);
  for (const orPart of parts) {
    const andParts = orPart.split(/\s*&&\s*/);
    let andOk = true;
    for (const atom of andParts) {
      if (!evalComparison(atom.trim(), ctx)) {
        andOk = false;
        break;
      }
    }
    if (andOk) return true;
  }
  return false;
}

function varForCondition(name: string, ctx: PayrollExprContext): number {
  const trimmed = name.trim();
  if (trimmed in ctx) return ctx[trimmed];
  return 0;
}

function evalComparison(atom: string, ctx: PayrollExprContext): boolean {
  const m = atom.match(/^(.+?)(>=|<=|==|!=|>|<)(.+)$/);
  if (!m) {
    const id = atom.trim();
    if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(id)) return varForCondition(id, ctx) !== 0;
    const v = evaluatePayrollExpression(atom, ctx);
    return v !== 0;
  }
  const left = /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(m[1].trim())
    ? varForCondition(m[1], ctx)
    : evaluatePayrollExpression(m[1], ctx);
  const right = /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(m[3].trim())
    ? varForCondition(m[3], ctx)
    : evaluatePayrollExpression(m[3], ctx);
  switch (m[2]) {
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    default:
      return false;
  }
}
