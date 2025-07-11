import {
  defaultOperations,
  FilterAST,
  Group,
  Op,
  Rule,
} from "./types";

/**
 * Creates a new filter group root node.
 *
 * @param {("and" | "or")} [combinator="and"] - The logical combinator for the group ("and" or "or").
 * @returns {Group} The root group node with a unique id and empty children.
 */
function makeFilterRoot(combinator: "and" | "or" = "and"): Group {
  return { id: crypto.randomUUID(), combinator, children: [] };
}

/**
 * Configuration for a single filter field.
 *
 * @property {string} field - The field name (key in the data).
 * @property {string} label - The display label for the field.
 * @property {string} component - The component type identifier for the field.
 * @property {Op[]} [operations] - The allowed operations for this field (overrides defaults).
 * @property {Array<{ value: string; label: string }>} [options] - Options for select/multiselect fields.
 * @property {Op} [defaultOp] - The default operation for this field.
 * @property {Record<string, unknown>} [meta] - Additional metadata for the field.
 */
export interface FilterFieldConfig {
  field: string;
  label: string;
  component: string;
  operations?: Op[];
  options?: Array<{ value: string; label: string }>;
  defaultOp?: Op;
  meta?: Record<string, unknown>;
}

/**
 * The main filter configuration type.
 *
 * @property {FilterFieldConfig[]} fields - The list of filterable fields.
 * @property {Record<string, Op[]>} [defaultOperations] - Optional override for default operations per component type.
 */
export interface FilterConfig {
  fields: FilterFieldConfig[];
  defaultOperations?: Record<string, Op[]>;
}

/**
 * Initializes the filter state tree (AST) based on the provided filter configuration.
 *
 * For each field in the config, creates a rule node with:
 *   - a unique id,
 *   - the field name,
 *   - the default operation (from field, config, or fallback to "eq"),
 *   - the initial value (empty array for "multiselect", otherwise null),
 *   - the component type.
 *
 * @param {FilterConfig} config - The filter configuration describing fields and operations.
 * @returns {FilterAST} The initialized filter AST (root group with child rules).
 */
export const createInitialFilterState = (
  config: FilterConfig
): FilterAST => {
  const root = makeFilterRoot();
  root.children = config.fields.map((field) => {
    const initialValue = field.component === "multiselect" ? [] : null;
    const defaultOp =
      field.defaultOp ??
      config.defaultOperations?.[field.component]?.[0] ??
      defaultOperations[field.component]?.[0] ??
      "eq";

    return {
      id: crypto.randomUUID(),
      field: field.field,
      op: defaultOp,
      value: initialValue,
      component: field.component,
    };
  });
  return root;
};
