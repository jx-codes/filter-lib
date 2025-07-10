import {
  CustomComponentTypes,
  DefaultComponentType,
  defaultOperations,
  FilterAST,
  Group,
  HasCustomComponents,
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
 * Initializes the filter state tree (AST) based on the provided filter configuration.
 *
 * For each field in the config, creates a rule node with:
 *   - a unique id,
 *   - the field name,
 *   - the default operation (from field, config, or fallback to "eq"),
 *   - the initial value (empty array for "multiselect", otherwise null),
 *   - the component type.
 *
 * @template ComponentKey - The string union of all component types (default and custom).
 * @param {FilterConfig<ComponentKey>} config - The filter configuration describing fields, operations, and renderers.
 * @returns {FilterAST} The initialized filter AST (root group with child rules).
 */
export const createInitialFilterState = <ComponentKey extends string>(
  config: FilterConfig<ComponentKey>
): FilterAST => {
  const root = makeFilterRoot();
  root.children = config.fields.map((field) => {
    const initialValue = field.component === "multiselect" ? [] : null;
    const defaultOp =
      field.defaultOp ??
      config.defaultOperations?.[
        field.component as DefaultComponentType
      ]?.[0] ??
      defaultOperations[field.component as DefaultComponentType]?.[0] ??
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

/**
 * Configuration for a single filter field.
 *
 * @template ComponentKey - The string union of all component types (default and custom).
 * @property {string} field - The field name (key in the data).
 * @property {string} label - The display label for the field.
 * @property {ComponentKey} component - The component type for the field (e.g., "text", "number", custom).
 * @property {Op[]} [operations] - The allowed operations for this field (overrides defaults).
 * @property {Array<{ value: string; label: string }>} [options] - Options for select/multiselect fields.
 * @property {Op} [defaultOp] - The default operation for this field.
 * @property {Record<string, unknown>} [meta] - Additional metadata for the field.
 */
export interface FilterFieldConfig<ComponentKey extends string> {
  field: string;
  label: string;
  component: ComponentKey;
  operations?: Op[];
  options?: Array<{ value: string; label: string }>;
  defaultOp?: Op;
  meta?: Record<string, unknown>;
}

/**
 * Props for a custom or default filter display renderer component.
 *
 * @template ComponentKey - The string union of all component types (default and custom).
 * @property {Rule} rule - The rule node to display.
 * @property {() => void} onRemove - Callback to remove the rule.
 * @property {FilterFieldConfig<ComponentKey>} config - The field configuration for this rule.
 */
export interface FilterDisplayRendererProps<ComponentKey extends string> {
  rule: Rule;
  onRemove: () => void;
  config: FilterFieldConfig<ComponentKey>;
}

/**
 * Props for a custom or default filter input renderer component.
 *
 * @template ComponentKey - The string union of all component types (default and custom).
 * @property {string} value - The current value of the input.
 * @property {(value: string) => void} onChange - Callback when the value changes.
 * @property {FilterFieldConfig<ComponentKey>} config - The field configuration for this input.
 * @property {string} [placeholder] - Optional placeholder text for the input.
 */
export interface FilterInputRendererProps<ComponentKey extends string> {
  value: string;
  onChange: (value: string) => void;
  config: FilterFieldConfig<ComponentKey>;
  placeholder?: string;
}

/**
 * Base configuration for the filter system.
 *
 * @template ComponentKey - The string union of all component types (default and custom).
 * @property {FilterFieldConfig<ComponentKey>[]} fields - The list of filterable fields.
 * @property {Record<string, Op[]>} [defaultOperations] - Optional override for default operations per component type.
 */
interface BaseFilterConfig<ComponentKey extends string> {
  fields: FilterFieldConfig<ComponentKey>[];
  defaultOperations?: Record<string, Op[]>;
}

/**
 * The main filter configuration type.
 *
 * If custom components are present, requires explicit displayRenderers and inputRenderers for custom types,
 * and allows partial overrides for default types. Otherwise, only partial overrides for default types are allowed.
 *
 * @template ComponentKey - The string union of all component types (default and custom).
 */
export type FilterConfig<ComponentKey extends string> =
  BaseFilterConfig<ComponentKey> &
    (HasCustomComponents<ComponentKey> extends true
      ? {
          /**
           * Mapping of custom and default component types to their display renderer components.
           * Custom types are required, default types are optional.
           */
          displayRenderers: Record<
            CustomComponentTypes<ComponentKey>,
            React.ComponentType<FilterDisplayRendererProps<ComponentKey>>
          > &
            Partial<
              Record<
                DefaultComponentType,
                React.ComponentType<FilterDisplayRendererProps<ComponentKey>>
              >
            >;
          /**
           * Mapping of custom and default component types to their input renderer components.
           * Custom types are required, default types are optional.
           */
          inputRenderers: Record<
            CustomComponentTypes<ComponentKey>,
            React.ComponentType<FilterInputRendererProps<ComponentKey>>
          > &
            Partial<
              Record<
                DefaultComponentType,
                React.ComponentType<FilterInputRendererProps<ComponentKey>>
              >
            >;
        }
      : {
          /**
           * Optional mapping of default component types to their display renderer components.
           */
          displayRenderers?: Partial<
            Record<
              DefaultComponentType,
              React.ComponentType<FilterDisplayRendererProps<ComponentKey>>
            >
          >;
          /**
           * Optional mapping of default component types to their input renderer components.
           */
          inputRenderers?: Partial<
            Record<
              DefaultComponentType,
              React.ComponentType<FilterInputRendererProps<ComponentKey>>
            >
          >;
        });
