#!/usr/bin/env node
/**
 * Security audit: every route that changes data (POST/PUT/PATCH/DELETE) must check a
 * permission. Frontend checks are UX only (CLAUDE.md §5).
 *
 * Parses each route file with the TypeScript compiler (no regex guessing) and reports
 * mutating routes whose handler chain has no permission guard, either on the route itself
 * or through a `router.use(...)` guard registered earlier in the same file.
 *
 * Usage:
 *   node scripts/audit-route-authorize.mjs            # print the report
 *   node scripts/audit-route-authorize.mjs --json     # machine-readable list
 *
 * The regression test `route-authorize-baseline.spec.ts` compares the current list with
 * `scripts/route-authorize-baseline.json` and fails when a NEW unguarded route appears.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'modules');
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

/**
 * Calls that count as a permission guard. `authorize` is the standard one; the rest are
 * existing module-specific guards that check permissions or roles themselves.
 */
const GUARD_PATTERN =
  /^(authorize\w*|require\w*(Permission|Permissions|Admin|Owner|Role|Access)|requirePlatformAdmin|authenticatePlatformAdmin|authenticateInternalAutomation|authenticateConnector|requireConnectorToken|ensureAdmin|adminOnly|ownerOnly|checkPermission|permissionGrantedFromCache)$/;

/** Strip `x as T`, `<T>x`, `x!`, `(x)` and `x satisfies T`. */
function unwrap(node) {
  let n = node;
  while (
    ts.isAsExpression(n) ||
    ts.isTypeAssertionExpression(n) ||
    ts.isNonNullExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n))
  ) {
    n = n.expression;
  }
  return n;
}

/** True when a function body calls a guard, e.g. `const can = (a) => authorize({ ... })`. */
function bodyCallsGuard(fn, guardIdents) {
  let found = false;
  function scan(n) {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const name = calleeName(n);
      if (name && (GUARD_PATTERN.test(name) || guardIdents.has(name))) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, scan);
  }
  scan(fn);
  return found;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(routes|controller)\.ts$/.test(entry.name) || entry.name === 'routes.ts') out.push(full);
  }
  return out;
}

/** Text of the callee for `foo(...)`, `foo.bar(...)`, or a bare identifier. */
function calleeName(node) {
  if (ts.isCallExpression(node)) {
    const e = node.expression;
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return e.name.text;
  }
  if (ts.isIdentifier(node)) return node.text;
  return '';
}

/** True if any argument of the route call is (or spreads) a guard. */
function argIsGuard(rawArg, guardIdents) {
  const arg = unwrap(rawArg);
  if (ts.isSpreadElement(arg)) return argIsGuard(arg.expression, guardIdents);
  if (ts.isArrayLiteralExpression(arg)) return arg.elements.some((el) => argIsGuard(el, guardIdents));
  const name = calleeName(arg);
  if (name && (GUARD_PATTERN.test(name) || guardIdents.has(name))) return true;
  return false;
}

function auditFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings = [];
  // Routers (by variable name) that have a guard applied with `router.use(guard)`, in order.
  const guardedRouters = new Map(); // name -> position of the first guarding .use()
  // `const adminOnly = [authenticate, authorize(...)]` style constants.
  const guardIdents = new Set();

  // Router variables: `const router = Router()`, `express.Router()`, `asyncSafeRouter()`.
  // Only calls on these count as routes, so `personService.delete(id)` is not a route.
  const routerIdents = new Set();
  (function collectRouters(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      const init = unwrap(node.initializer);
      if (ts.isCallExpression(init) && /router$/i.test(calleeName(init))) routerIdents.add(node.name.text);
    }
    ts.forEachChild(node, collectRouters);
  })(sf);

  // Local guard helpers anywhere in the file: `const can = (...) => authorize(...)`,
  // `function allowEntityAccess(...) { return authorize(...) }`, `const adminOnly = [authorize(...)]`.
  // Two passes so a helper built from another helper is found too.
  for (let pass = 0; pass < 2; pass += 1) {
    (function collect(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
        const init = unwrap(node.initializer);
        if (
          argIsGuard(init, guardIdents) ||
          ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && bodyCallsGuard(init, guardIdents))
        ) {
          guardIdents.add(node.name.text);
        }
      }
      if (ts.isFunctionDeclaration(node) && node.name && node.body && bodyCallsGuard(node.body, guardIdents)) {
        guardIdents.add(node.name.text);
      }
      ts.forEachChild(node, collect);
    })(sf);
  }

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const target = node.expression.expression;
      const routerName = ts.isIdentifier(target) && routerIdents.has(target.text) ? target.text : '';
      if (method === 'use' && routerName && node.arguments.some((a) => argIsGuard(a, guardIdents))) {
        if (!guardedRouters.has(routerName)) guardedRouters.set(routerName, node.getStart());
      }
      if (MUTATING.has(method) && routerName && node.arguments.length >= 2) {
        const first = node.arguments[0];
        const routePath = ts.isStringLiteralLike(first) ? first.text : '<dynamic>';
        const guardedHere = node.arguments.slice(1).some((a) => argIsGuard(a, guardIdents));
        const routerGuardPos = guardedRouters.get(routerName);
        const guardedByUse = routerGuardPos !== undefined && routerGuardPos < node.getStart();
        if (!guardedHere && !guardedByUse) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            file: path.relative(ROOT, file),
            line: line + 1,
            method: method.toUpperCase(),
            path: routePath,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return findings;
}

export function auditRoutes() {
  return walk(SRC).flatMap(auditFile);
}

/** Stable identity that survives line shifts. */
export function findingKey(f) {
  return `${f.file} ${f.method} ${f.path}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const findings = auditRoutes();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(findings.map(findingKey).sort(), null, 2) + '\n');
  } else {
    const byFile = new Map();
    for (const f of findings) {
      if (!byFile.has(f.file)) byFile.set(f.file, []);
      byFile.get(f.file).push(f);
    }
    console.log(`mutating routes without a permission guard: ${findings.length} in ${byFile.size} files`);
    for (const [file, list] of byFile) {
      console.log(`\n${file}`);
      for (const f of list) console.log(`  ${f.line}: ${f.method} ${f.path}`);
    }
  }
}
