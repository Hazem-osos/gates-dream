import { GraphQLError } from 'graphql';
import { logger } from '../logger';

/**
 * GraphQL Query Complexity Limiter
 * Prevents expensive GraphQL queries by analyzing complexity
 */

export interface ComplexityOptions {
  maxComplexity?: number; // Maximum allowed complexity (default: 100)
  maxDepth?: number; // Maximum query depth (default: 10)
  complexityCost?: Record<string, number>; // Cost per field type
  onError?: (complexity: number, maxComplexity: number) => void;
}

const DEFAULT_MAX_COMPLEXITY = 100;
const DEFAULT_MAX_DEPTH = 10;

// Default complexity costs
const DEFAULT_COMPLEXITY_COST: Record<string, number> = {
  // Scalars are cheap
  String: 1,
  Int: 1,
  Float: 1,
  Boolean: 1,
  ID: 1,
  Date: 1,
  DateTime: 1,

  // Lists multiply complexity
  listMultiplier: 10,

  // Relations are expensive
  relation: 5,
};

/**
 * Calculate query complexity
 */
export function calculateComplexity(
  query: string,
  options: ComplexityOptions = {}
): { complexity: number; depth: number } {
  const maxComplexity = options.maxComplexity || DEFAULT_MAX_COMPLEXITY;
  const maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
  const complexityCost = { ...DEFAULT_COMPLEXITY_COST, ...options.complexityCost };

  let complexity = 0;
  let depth = 0;
  let currentDepth = 0;

  // Simple heuristic: count fields and nested levels
  const lines = query.split('\n');
  const fieldPattern = /(\w+)\s*\{/g;
  const listPattern = /\[.*?\]/g;

  for (const line of lines) {
    // Count opening braces (depth)
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    currentDepth += openBraces - closeBraces;
    depth = Math.max(depth, currentDepth);

    // Count fields
    const fieldMatches = line.match(fieldPattern);
    if (fieldMatches) {
      complexity += fieldMatches.length * complexityCost.String;
    }

    // Check for lists
    if (listPattern.test(line)) {
      complexity += complexityCost.listMultiplier;
    }

    // Check for relations (fields with nested queries)
    if (/\w+\s*\{/.test(line)) {
      complexity += complexityCost.relation;
    }
  }

  return { complexity, depth };
}

/**
 * Validate query complexity
 */
export function validateComplexity(
  query: string,
  options: ComplexityOptions = {}
): void {
  const maxComplexity = options.maxComplexity || DEFAULT_MAX_COMPLEXITY;
  const maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;

  const { complexity, depth } = calculateComplexity(query, options);

  // Check depth
  if (depth > maxDepth) {
    const error = new GraphQLError(
      `Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}`,
      {
        extensions: {
          code: 'QUERY_DEPTH_EXCEEDED',
          depth,
          maxDepth,
        },
      }
    );
    throw error;
  }

  // Check complexity
  if (complexity > maxComplexity) {
    logger.warn(
      {
        complexity,
        maxComplexity,
        depth,
        query: query.substring(0, 200), // Log first 200 chars
      },
      'GraphQL query complexity exceeded'
    );

    if (options.onError) {
      options.onError(complexity, maxComplexity);
    }

    const error = new GraphQLError(
      `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}`,
      {
        extensions: {
          code: 'QUERY_COMPLEXITY_EXCEEDED',
          complexity,
          maxComplexity,
        },
      }
    );
    throw error;
  }

  logger.debug(
    {
      complexity,
      depth,
      maxComplexity,
      maxDepth,
    },
    'GraphQL query complexity validated'
  );
}

/**
 * GraphQL complexity validation middleware
 */
export function createComplexityValidator(options: ComplexityOptions = {}) {
  return (query: string) => {
    validateComplexity(query, options);
  };
}

/**
 * More sophisticated complexity calculation using AST
 * This is a simplified version - for production, consider using graphql-query-complexity library
 */
export function calculateComplexityFromAST(
  ast: any,
  options: ComplexityOptions = {}
): number {
  const complexityCost = { ...DEFAULT_COMPLEXITY_COST, ...options.complexityCost };
  let complexity = 0;

  function traverse(node: any, depth: number = 0): void {
    if (!node) {
      return;
    }

    // Base cost for this node
    complexity += 1;

    // If it's a list, multiply cost
    if (node.kind === 'ListType') {
      complexity += complexityCost.listMultiplier;
    }

    // If it's a field with selections, it's a relation
    if (node.selectionSet) {
      complexity += complexityCost.relation;
      // Traverse nested selections
      if (node.selectionSet.selections) {
        for (const selection of node.selectionSet.selections) {
          traverse(selection, depth + 1);
        }
      }
    }

    // Traverse arguments (they can contain nested queries)
    if (node.arguments) {
      for (const arg of node.arguments) {
        traverse(arg.value, depth);
      }
    }
  }

  if (ast.definitions) {
    for (const definition of ast.definitions) {
      if (definition.selectionSet) {
        traverse(definition.selectionSet);
      }
    }
  }

  return complexity;
}

