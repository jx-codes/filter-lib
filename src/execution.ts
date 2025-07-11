import { FilterAST } from "./types";

/**
 * Context object that can be passed through the middleware chain
 */
export interface FilterExecutionContext {
  [key: string]: unknown;
}

/**
 * Base filter executor function signature
 */
export type FilterExecutor<T = unknown> = (
  ast: FilterAST,
  context?: FilterExecutionContext
) => Promise<T[]>;

/**
 * Middleware function signature
 * Takes the AST, a next function, and optional context
 * Returns a promise of filtered results
 */
export type FilterMiddleware<T = unknown> = (
  ast: FilterAST,
  next: FilterExecutor<T>,
  context?: FilterExecutionContext
) => Promise<T[]>;

/**
 * Creates a composed filter executor from middleware chain
 * The last argument should be the final executor that actually processes the data
 * 
 * @param middlewares Array of middleware functions, with the final executor last
 * @returns A composed executor function
 * 
 * @example
 * ```ts
 * const executor = createFilterExecutor(
 *   cacheMiddleware,
 *   loggingMiddleware,
 *   sqlExecutor
 * );
 * 
 * const results = await executor(ast, { userId: 123 });
 * ```
 */
export function createFilterExecutor<T = unknown>(
  ...middlewares: [...FilterMiddleware<T>[], FilterExecutor<T>]
): FilterExecutor<T> {
  if (middlewares.length === 0) {
    throw new Error("At least one middleware or executor is required");
  }

  if (middlewares.length === 1) {
    return middlewares[0] as FilterExecutor<T>;
  }

  return (ast: FilterAST, context?: FilterExecutionContext) => {
    let index = 0;

    const dispatch = async (i: number): Promise<T[]> => {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;

      const middleware = middlewares[i];
      if (!middleware) {
        throw new Error("No middleware found at index " + i);
      }

      if (i === middlewares.length - 1) {
        // Last one is the executor
        return (middleware as FilterExecutor<T>)(ast, context);
      }

      // Regular middleware
      return (middleware as FilterMiddleware<T>)(ast, (ast, ctx) => dispatch(i + 1), context);
    };

    return dispatch(0);
  };
}

/**
 * Simple identity executor that returns the AST as-is
 * Useful for testing or as a no-op executor
 */
export const identityExecutor: FilterExecutor<FilterAST> = async (ast) => [ast];

/**
 * Middleware that logs execution timing
 */
export const loggingMiddleware = <T>(
  label = "Filter execution"
): FilterMiddleware<T> => async (ast, next, context) => {
  const start = Date.now();
  console.log(`[${label}] Starting execution`, { ast, context });
  
  try {
    const results = await next(ast, context);
    const duration = Date.now() - start;
    console.log(`[${label}] Completed in ${duration}ms`, { resultCount: results.length });
    return results;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[${label}] Failed after ${duration}ms`, { error, ast, context });
    throw error;
  }
};

/**
 * Middleware that adds simple caching based on AST hash
 */
export const cacheMiddleware = <T>(
  storage: Map<string, T[]> = new Map()
): FilterMiddleware<T> => async (ast, next, context) => {
  const key = JSON.stringify(ast);
  
  if (storage.has(key)) {
    return storage.get(key)!;
  }
  
  const results = await next(ast, context);
  storage.set(key, results);
  return results;
};

/**
 * Middleware that adds retry logic with exponential backoff
 */
export const retryMiddleware = <T>(
  maxRetries = 3,
  baseDelay = 1000
): FilterMiddleware<T> => async (ast, next, context) => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await next(ast, context);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}; 