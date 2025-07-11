import { Observable, observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { FilterAST, FilterNode, Rule, Group } from "./types";
import { createInitialFilterState, FilterConfig } from "./helpers";
import { useMemo } from "react";

const isRule = (node: FilterNode): node is Rule => !("children" in node);
const isGroup = (node: FilterNode): node is Group => "children" in node;

export const createFilterStore = (args: {
  initialState?: FilterAST;
  filterFields: FilterConfig;
}) => {
  const { initialState, filterFields } = args;

  const filters = observable({
    filters: initialState ?? createInitialFilterState(filterFields),
    fields: filterFields,
  });

  // Helper functions for finding nodes and updating the tree
  const findNodeById = (
    nodeId: string,
    nodes: FilterNode[] = filters.filters.children.get(),
  ): FilterNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (isGroup(node)) {
        const found = findNodeById(nodeId, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const findGroupById = (
    groupId: string,
    nodes: FilterNode[] = filters.filters.children.get(),
  ): Group | null => {
    for (const node of nodes) {
      if (node.id === groupId && isGroup(node)) {
        return node;
      }
      if (isGroup(node)) {
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
        if (isGroup(node)) {
          return {
            ...node,
            children: updateTree(node.children, targetId, updateFn),
          };
        }
        return node;
      })
      .filter((node): node is FilterNode => node !== null);
  };

  // React hooks for reactive UI updates
  const useFilterState = () => use$(filters);
  
  const useFilterChildren = (selector?: (node: FilterNode) => boolean) =>
    use$(() => {
      return filters.filters.children
        .get()
        .filter((node) => (selector ? selector(node) : true));
    });
  
  const useFilterRules = (selector?: (node: Rule) => boolean) =>
    use$(() => {
      return filters.filters.children
        .get()
        .filter((node) => isRule(node))
        .filter((node) => (selector ? selector(node) : true));
    });

  const useFilterGroups = (selector?: (node: Group) => boolean) =>
    use$(() => {
      return filters.filters.children
        .get()
        .filter((node) => isGroup(node))
        .filter((node) => (selector ? selector(node) : true));
    });

  // Rule management
  const addRule = (rule: Omit<Rule, "id">, parentId?: string) => {
    const id = crypto.randomUUID();
    const newRule: Rule = { ...rule, id };
    
    if (parentId) {
      const parent = findGroupById(parentId);
      if (parent) {
        filters.filters.children.set(
          updateTree(filters.filters.children.get(), parentId, (node) => {
            if (isGroup(node)) {
              return {
                ...node,
                children: [...node.children, newRule],
              };
            }
            return node;
          }),
        );
      } else {
        throw new Error(`Parent group with id ${parentId} not found`);
      }
    } else {
      filters.filters.children.set([
        ...filters.filters.children.get(),
        newRule,
      ]);
    }
    return id;
  };

  const updateRule = (ruleId: string, rule: Partial<Rule>) => {
    filters.filters.children.set(
      updateTree(filters.filters.children.get(), ruleId, (node) => {
        if (isRule(node)) {
          return { ...node, ...rule };
        }
        return node; // Don't update groups
      }),
    );
  };

  const removeRule = (ruleId: string) => {
    filters.filters.children.set(
      updateTree(filters.filters.children.get(), ruleId, (node) => {
        if (isRule(node)) {
          return null; // Remove the rule
        }
        return node;
      }),
    );
  };

  // Group management
  const addGroup = (group: Omit<Group, "id">, parentId?: string) => {
    const id = crypto.randomUUID();
    const newGroup: Group = { ...group, id };
    
    if (parentId) {
      const parent = findGroupById(parentId);
      if (parent) {
        filters.filters.children.set(
          updateTree(filters.filters.children.get(), parentId, (node) => {
            if (isGroup(node)) {
              return {
                ...node,
                children: [...node.children, newGroup],
              };
            }
            return node;
          }),
        );
      } else {
        throw new Error(`Parent group with id ${parentId} not found`);
      }
    } else {
      filters.filters.children.set([
        ...filters.filters.children.get(),
        newGroup,
      ]);
    }
    return id;
  };

  const updateGroup = (groupId: string, group: Partial<Omit<Group, "id" | "children">>) => {
    filters.filters.children.set(
      updateTree(filters.filters.children.get(), groupId, (node) => {
        if (isGroup(node)) {
          return { ...node, ...group };
        }
        return node; // Don't update rules
      }),
    );
  };

  const removeGroup = (groupId: string) => {
    filters.filters.children.set(
      updateTree(filters.filters.children.get(), groupId, (node) => {
        if (isGroup(node)) {
          return null; // Remove the group
        }
        return node;
      }),
    );
  };

  // Generic node operations
  const removeNode = (nodeId: string) => {
    filters.filters.children.set(
      updateTree(filters.filters.children.get(), nodeId, () => null),
    );
  };

  const getNode = (nodeId: string): FilterNode | null => {
    return findNodeById(nodeId);
  };

  const getGroup = (groupId: string): Group | null => {
    return findGroupById(groupId);
  };

  const hasNode = (nodeId: string): boolean => {
    return findNodeById(nodeId) !== null;
  };

  // Utility methods
  const toString = (): string => {
    return JSON.stringify(filters.filters.get(), null, 2);
  };

  const toJSON = (): FilterAST => {
    return filters.filters.get();
  };

  // Get all rules in the tree (recursively)
  const getAllRules = (): Rule[] => {
    const extractRules = (nodes: FilterNode[]): Rule[] => {
      const rules: Rule[] = [];
      for (const node of nodes) {
        if (isRule(node)) {
          rules.push(node);
        } else if (isGroup(node)) {
          rules.push(...extractRules(node.children));
        }
      }
      return rules;
    };
    return extractRules(filters.filters.children.get());
  };

  // Get all groups in the tree (recursively)
  const getAllGroups = (): Group[] => {
    const extractGroups = (nodes: FilterNode[]): Group[] => {
      const groups: Group[] = [];
      for (const node of nodes) {
        if (isGroup(node)) {
          groups.push(node);
          groups.push(...extractGroups(node.children));
        }
      }
      return groups;
    };
    return extractGroups(filters.filters.children.get());
  };

  const useActions = () => {
    return useMemo(() => ({
      addRule,
      updateRule,
      removeRule,
      addGroup,
      updateGroup,
    }), [addRule, updateRule, removeRule, addGroup, updateGroup]);    
  }

  const useFilterFields = () => {
    return use$(() => filters.fields.fields.get());
  }

  return {
    // React hooks
    useFilterState,
    useFilterChildren,
    useFilterRules,
    useFilterGroups,
    useActions,
    useFilterFields,
    // Rule operations
    addRule,
    updateRule,
    removeRule,
    
    // Group operations
    addGroup,
    updateGroup,
    removeGroup,
    
    // Generic node operations
    removeNode,
    getNode,
    getGroup,
    hasNode,
    
    // Utility methods
    toString,
    toJSON,
    getAllRules,
    getAllGroups,
    
    // Direct access to the observable
    filters,
  };
};
