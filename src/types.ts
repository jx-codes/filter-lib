export type Primitive = string | number | boolean | Date | null;
export type Op = "eq" | "contains" | "lt" | "gt" | "lte" | "gte" | "ne" | "in" | "nin" | (string & {});
export type FilterNode = Rule | Group;

export interface Rule {
  id: string;
  field: string;
  op: Op;
  value: Primitive | Primitive[];
  component: string;
  meta?: Record<string, unknown>;
}

export interface Group {
  id: string;
  combinator: "and" | "or";
  children: FilterNode[];
}

export type FilterAST = Group;

// Default operations for common component types
export const defaultOperations: Record<string, Op[]> = {
  text: ["eq", "contains", "ne"],
  number: ["eq", "ne", "lt", "gt", "lte", "gte"],
  date: ["eq", "ne", "lt", "gt", "lte", "gte"],
  datetime: ["eq", "ne", "lt", "gt", "lte", "gte"],
  select: ["eq", "ne"],
  boolean: ["eq", "ne"],
  multiselect: ["in", "nin"],
} as const;
