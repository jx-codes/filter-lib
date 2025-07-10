import { create } from 'zustand';
import {
  type FilterAST,
  type FilterNode,
  type Group,
  type Rule,
} from "./types";

interface FilterStoreState {
  filters: FilterAST;
  
  // Actions
  addRule: (rule: Omit<Rule, "id">, parentId?: string) => void;
  updateRule: (ruleId: string, rule: Partial<Rule>) => void;
  addGroup: (group: Omit<Group, "id">, parentId?: string) => void;
  updateGroup: (groupId: string, group: Partial<Omit<Group, "id" | "children">>) => void;
  removeRule: (ruleId: string) => void;
  removeGroup: (groupId: string) => void;
  removeNode: (nodeId: string) => void;
  getNode: (nodeId: string) => FilterNode | null;
  getGroup: (groupId: string) => Group | null;
  hasNode: (nodeId: string) => boolean;
  getAllRules: () => Rule[];
  getAllGroups: () => Group[];
  toString: () => string;
  toJSON: () => FilterAST;
}

/**
 * FilterStore provides a reactive store for managing filter rules and groups using Zustand.
 * 
 * The filter tree is composed of groups (with combinators and children) and rules (field, op, value).
 * This store allows you to add, update, remove, and query rules and groups anywhere in the tree,
 * and exposes a reactive state for UI binding.
 * 
 * Example usage:
 * 
 *   const useFilterStore = createFilterStore();
 *   const { addRule, addGroup, updateRule, removeNode, getAllRules, toJSON } = useFilterStore();
 *   
 *   // Add a rule
 *   addRule({ field: "name", op: "eq", value: "Alice", component: "text" });
 *   
 *   // Add a group
 *   addGroup({ combinator: "or", children: [] });
 *   
 *   // Update a rule
 *   updateRule(ruleId, { value: "Bob" });
 *   
 *   // Remove a node
 *   removeNode(nodeId);
 *   
 *   // Get all rules
 *   const allRules = getAllRules();
 *   
 *   // Export to JSON
 *   const json = toJSON();
 */
export const createFilterStore = (initialState?: FilterAST) => {
  return create<FilterStoreState>((set, get) => {
    // Helper functions
    const findNodeById = (
      nodeId: string,
      nodes: FilterNode[] = get().filters.children,
    ): FilterNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          return node;
        }
        if ("children" in node) {
          const found = findNodeById(nodeId, node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const findGroupById = (
      groupId: string,
      nodes: FilterNode[] = get().filters.children,
    ): Group | null => {
      for (const node of nodes) {
        if (node.id === groupId && "children" in node) {
          return node as Group;
        }
        if ("children" in node) {
          const found = findGroupById(groupId, node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const updateTree = (
      nodes: FilterNode[],
      targetId: string,
      updateFn: (node: FilterNode) => FilterNode | null,
    ): FilterNode[] => {
      return nodes
        .map((node) => {
          if (node.id === targetId) {
            return updateFn(node);
          }
          if ("children" in node) {
            return {
              ...node,
              children: updateTree(node.children, targetId, updateFn),
            };
          }
          return node;
        })
        .filter((node): node is FilterNode => node !== null);
    };

    const collectRules = (nodes: FilterNode[]): Rule[] => {
      const rules: Rule[] = [];
      for (const node of nodes) {
        if ("children" in node) {
          rules.push(...collectRules(node.children));
        } else {
          rules.push(node);
        }
      }
      return rules;
    };

    const collectGroups = (nodes: FilterNode[]): Group[] => {
      const groups: Group[] = [];
      for (const node of nodes) {
        if ("children" in node) {
          groups.push(node as Group);
          groups.push(...collectGroups(node.children));
        }
      }
      return groups;
    };

    return {
      filters: initialState ?? {
        id: crypto.randomUUID(),
        combinator: "and",
        children: [],
      },

      addRule: (rule: Omit<Rule, "id">, parentId?: string) => {
        const newRule: Rule = { ...rule, id: crypto.randomUUID() };
        
        set((state) => {
          if (parentId) {
            const parent = findGroupById(parentId, state.filters.children);
            if (parent) {
              return {
                ...state,
                filters: {
                  ...state.filters,
                  children: updateTree(state.filters.children, parentId, (node) => {
                    if ("children" in node) {
                      return {
                        ...node,
                        children: [...node.children, newRule],
                      };
                    }
                    return node;
                  }),
                },
              };
            }
            return state;
          } else {
            return {
              ...state,
              filters: {
                ...state.filters,
                children: [...state.filters.children, newRule],
              },
            };
          }
        });
      },

      updateRule: (ruleId: string, rule: Partial<Rule>) => {
        set((state) => ({
          ...state,
          filters: {
            ...state.filters,
            children: updateTree(state.filters.children, ruleId, (node) => {
              if ("children" in node) {
                return node; // Don't update groups
              }
              return { ...node, ...rule };
            }),
          },
        }));
      },

      addGroup: (group: Omit<Group, "id">, parentId?: string) => {
        const newGroup: Group = { ...group, id: crypto.randomUUID() };
        
        set((state) => {
          if (parentId) {
            const parent = findGroupById(parentId, state.filters.children);
            if (parent) {
              return {
                ...state,
                filters: {
                  ...state.filters,
                  children: updateTree(state.filters.children, parentId, (node) => {
                    if ("children" in node) {
                      return {
                        ...node,
                        children: [...node.children, newGroup],
                      };
                    }
                    return node;
                  }),
                },
              };
            }
            return state;
          } else {
            return {
              ...state,
              filters: {
                ...state.filters,
                children: [...state.filters.children, newGroup],
              },
            };
          }
        });
      },

      updateGroup: (groupId: string, group: Partial<Omit<Group, "id" | "children">>) => {
        set((state) => ({
          ...state,
          filters: {
            ...state.filters,
            children: updateTree(state.filters.children, groupId, (node) => {
              if ("children" in node) {
                return { ...node, ...group };
              }
              return node; // Don't update rules
            }),
          },
        }));
      },

      removeRule: (ruleId: string) => {
        set((state) => ({
          ...state,
          filters: {
            ...state.filters,
            children: updateTree(state.filters.children, ruleId, () => null),
          },
        }));
      },

      removeGroup: (groupId: string) => {
        set((state) => ({
          ...state,
          filters: {
            ...state.filters,
            children: updateTree(state.filters.children, groupId, () => null),
          },
        }));
      },

      removeNode: (nodeId: string) => {
        set((state) => ({
          ...state,
          filters: {
            ...state.filters,
            children: updateTree(state.filters.children, nodeId, () => null),
          },
        }));
      },

      getNode: (nodeId: string) => {
        return findNodeById(nodeId, get().filters.children);
      },

      getGroup: (groupId: string) => {
        return findGroupById(groupId, get().filters.children);
      },

      hasNode: (nodeId: string) => {
        return findNodeById(nodeId, get().filters.children) !== null;
      },

      getAllRules: () => {
        return collectRules(get().filters.children);
      },

      getAllGroups: () => {
        return collectGroups(get().filters.children);
      },

      toString: () => {
        return JSON.stringify(get().filters, null, 2);
      },

      toJSON: () => {
        return get().filters;
      },
    };
  });
};
