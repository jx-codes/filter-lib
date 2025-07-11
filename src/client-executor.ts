import { FilterAST, FilterNode, Rule, Group, Op, Primitive } from "./types";
import { FilterExecutor, FilterExecutionContext } from "./execution";

/**
 * Client executor configuration
 */
interface ClientExecutorConfig {
  /**
   * Custom operation handlers for extending the built-in operations
   */
  customOperations?: Record<string, OperationHandler>;
  
  /**
   * Custom field value extractors for complex object structures
   */
  fieldExtractors?: Record<string, (item: any) => any>;
}

/**
 * Operation handler function signature
 */
type OperationHandler = (fieldValue: any, ruleValue: Primitive | Primitive[]) => boolean;

/**
 * Built-in operation handlers
 */
const defaultOperations: Record<Op, OperationHandler> = {
  eq: (fieldValue, ruleValue) => fieldValue === ruleValue,
  ne: (fieldValue, ruleValue) => fieldValue !== ruleValue,
  contains: (fieldValue, ruleValue) => {
    if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
      return fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    }
    return false;
  },
  lt: (fieldValue, ruleValue) => ruleValue != null && fieldValue < ruleValue,
  lte: (fieldValue, ruleValue) => ruleValue != null && fieldValue <= ruleValue,
  gt: (fieldValue, ruleValue) => ruleValue != null && fieldValue > ruleValue,
  gte: (fieldValue, ruleValue) => ruleValue != null && fieldValue >= ruleValue,
  in: (fieldValue, ruleValue) => {
    if (Array.isArray(ruleValue)) {
      return ruleValue.indexOf(fieldValue) !== -1;
    }
    return false;
  },
  nin: (fieldValue, ruleValue) => {
    if (Array.isArray(ruleValue)) {
      return ruleValue.indexOf(fieldValue) === -1;
    }
    return true;
  },
};

/**
 * Extracts a field value from an object, supporting nested paths with dot notation
 */
function getFieldValue(obj: any, fieldPath: string): any {
  if (fieldPath.includes('.')) {
    return fieldPath.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }
  return obj?.[fieldPath];
}

/**
 * Evaluates a single rule against a data item
 */
function evaluateRule(item: any, rule: Rule, config: ClientExecutorConfig): boolean {
  const { customOperations = {}, fieldExtractors = {} } = config;
  
  // Extract field value using custom extractor or default getter
  const fieldValue = fieldExtractors[rule.field] 
    ? fieldExtractors[rule.field](item)
    : getFieldValue(item, rule.field);
  
  // Handle null/undefined values
  if (rule.value === null || rule.value === undefined) {
    return rule.op === 'eq' ? fieldValue == null : fieldValue != null;
  }
  
  // Get operation handler (custom or default)
  const operationHandler = customOperations[rule.op] || defaultOperations[rule.op];
  
  if (!operationHandler) {
    console.warn(`Unknown operation: ${rule.op}`);
    return false;
  }
  
  try {
    return operationHandler(fieldValue, rule.value);
  } catch (error) {
    console.error(`Error evaluating rule`, { rule, fieldValue, error });
    return false;
  }
}

/**
 * Evaluates a group node against a data item
 */
function evaluateGroup(item: any, group: Group, config: ClientExecutorConfig): boolean {
  if (group.children.length === 0) {
    return true;
  }
  
  if (group.combinator === 'and') {
    return group.children.every(child => evaluateNode(item, child, config));
  } else if (group.combinator === 'or') {
    return group.children.some(child => evaluateNode(item, child, config));
  }
  
  console.warn(`Unknown combinator: ${group.combinator}`);
  return false;
}

/**
 * Evaluates a filter node (rule or group) against a data item
 */
function evaluateNode(item: any, node: FilterNode, config: ClientExecutorConfig): boolean {
  if ('children' in node) {
    return evaluateGroup(item, node, config);
  } else {
    return evaluateRule(item, node, config);
  }
}

/**
 * Creates a client-based filter executor that works with local data
 * 
 * @param data The array of data to filter
 * @param config Optional configuration for custom operations and field extractors
 * @returns A filter executor function
 * 
 * @example
 * ```ts
 * const data = [
 *   { id: 1, name: 'John', age: 30 },
 *   { id: 2, name: 'Jane', age: 25 },
 * ];
 * 
 * const executor = createClientExecutor(data);
 * const results = await executor(ast);
 * ```
 */
export function createClientExecutor<T = any>(
  data: T[],
  config: ClientExecutorConfig = {}
): FilterExecutor<T> {
  return async (ast: FilterAST, context?: FilterExecutionContext): Promise<T[]> => {
    // If no children, return all data
    if (ast.children.length === 0) {
      return data;
    }
    
    // Filter the data based on the AST
    return data.filter(item => evaluateGroup(item, ast, config));
  };
}

/**
 * Common field extractors for nested object structures
 */
export const commonFieldExtractors = {
  /**
   * Extracts values from arrays (useful for tags, categories, etc.)
   */
  arrayIncludes: (field: string) => (item: any) => {
    const value = getFieldValue(item, field);
    return Array.isArray(value) ? value : [value];
  },
  
  /**
   * Extracts values from nested objects
   */
  nested: (path: string) => (item: any) => getFieldValue(item, path),
  
  /**
   * Case-insensitive string extraction
   */
  caseInsensitive: (field: string) => (item: any) => {
    const value = getFieldValue(item, field);
    return typeof value === 'string' ? value.toLowerCase() : value;
  },
};

/**
 * Common custom operations
 */
export const commonOperations = {
  /**
   * Fuzzy string matching
   */
  fuzzy: (fieldValue: any, ruleValue: any) => {
    if (typeof fieldValue !== 'string' || typeof ruleValue !== 'string') {
      return false;
    }
    const field = fieldValue.toLowerCase();
    const rule = ruleValue.toLowerCase();
    return field.includes(rule) || rule.includes(field);
  },
  
  /**
   * Date range operations
   */
  dateRange: (fieldValue: any, ruleValue: any) => {
    if (!Array.isArray(ruleValue) || ruleValue.length !== 2) {
      return false;
    }
    const [start, end] = ruleValue;
    const date = new Date(fieldValue);
    return date >= new Date(start) && date <= new Date(end);
  },
  
  /**
   * Array intersection (has any of)
   */
  hasAny: (fieldValue: any, ruleValue: any) => {
    if (!Array.isArray(fieldValue) || !Array.isArray(ruleValue)) {
      return false;
    }
    return fieldValue.some(item => ruleValue.indexOf(item) !== -1);
  },
  
  /**
   * Array subset (has all of)
   */
  hasAll: (fieldValue: any, ruleValue: any) => {
    if (!Array.isArray(fieldValue) || !Array.isArray(ruleValue)) {
      return false;
    }
    return ruleValue.every(item => fieldValue.indexOf(item) !== -1);
  },
}; 