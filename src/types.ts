export type Primitive = string | number | boolean | Date | null;
export type Op = "eq" | "contains" | "lt" | "gt" | (string & {});
export type FilterNode = Rule | Group;

export interface Rule {
  id: string;
  field: string;
  op: Op;
  value: Primitive | Primitive[];
  meta?: Record<string, unknown>;
  component: string;
}

export interface Group {
  id: string;
  combinator: "and" | "or";
  children: FilterNode[];
}

export type FilterAST = Group;

export type DefaultComponentType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "boolean"
  | "multiselect";

export const defaultOperations: Record<DefaultComponentType, Op[]> = {
  text: ["eq", "contains", "ne"],
  number: ["eq", "ne", "lt", "gt", "lte", "gte"],
  date: ["eq", "ne", "lt", "gt", "lte", "gte"],
  datetime: ["eq", "ne", "lt", "gt", "lte", "gte"],
  select: ["eq", "ne"],
  boolean: ["eq", "ne"],
  multiselect: ["in", "nin"],
} as const;

export type CustomComponentTypes<ComponentKey extends string> = Exclude<
  ComponentKey,
  DefaultComponentType
>;

export type HasCustomComponents<ComponentKey extends string> =
  CustomComponentTypes<ComponentKey> extends never ? false : true;
