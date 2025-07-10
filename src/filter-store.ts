import { observable, type Observable } from "@legendapp/state";
import {
  type FilterAST,
  type FilterNode,
  type Group,
  type Rule,
} from "./types";

/**
 * FilterStore provides a reactive, observable tree structure for managing filter rules and groups.
 * 
 * The filter tree is composed of groups (with combinators and children) and rules (field, op, value).
 * This class allows you to add, update, remove, and query rules and groups anywhere in the tree,
 * and exposes a reactive state for UI binding.
 * 
 * Example usage:
 * 
 *   const store = new FilterStore();
 *   store.addRule({ field: "name", op: "eq", value: "Alice", component: "text" });
 *   store.addGroup({ combinator: "or", children: [] });
 *   store.updateRule(ruleId, { value: "Bob" });
 *   store.removeNode(nodeId);
 *   const allRules = store.getAllRules();
 *   const json = store.toJSON();
 */
export class FilterStore {
  /**
   * The observable filter tree state.
   * @private
   */
  private filters: Observable<FilterAST>;

  /**
   * Create a new FilterStore.
   * @param initialState Optional initial filter tree. If not provided, creates a root group with no children.
   */
  constructor(initialState?: FilterAST) {
    this.filters = observable(initialState ?? {
        id: crypto.randomUUID(),
        combinator: "and",
        children: [],
      },
    );
  }

  /**
   * Get the observable filter tree state.
   * Useful for binding to UI or subscribing to changes.
   */
  public get state() {
    return this.filters;
  }

  /**
   * Recursively find a node (rule or group) by its ID in the filter tree.
   * @param nodeId The ID of the node to find.
   * @param nodes The list of nodes to search (defaults to root children).
   * @returns The found FilterNode, or null if not found.
   * @private
   */
  private findNodeById(
    nodeId: string,
    nodes: FilterNode[] = this.filters.children.peek(),
  ): FilterNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if ("children" in node) {
        const found = this.findNodeById(nodeId, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Recursively find a group by its ID in the filter tree.
   * @param groupId The ID of the group to find.
   * @param nodes The list of nodes to search (defaults to root children).
   * @returns The found Group, or null if not found.
   * @private
   */
  private findGroupById(
    groupId: string,
    nodes: FilterNode[] = this.filters.children.peek(),
  ): Group | null {
    for (const node of nodes) {
      if (node.id === groupId && "children" in node) {
        return node as Group;
      }
      if ("children" in node) {
        const found = this.findGroupById(groupId, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Recursively update the filter tree by applying an update function to a node with a specific ID.
   * If the update function returns null, the node is removed.
   * @param nodes The list of nodes to update.
   * @param targetId The ID of the node to update.
   * @param updateFn The function to apply to the target node.
   * @returns The updated list of nodes.
   * @private
   */
  private updateTree(
    nodes: FilterNode[],
    targetId: string,
    updateFn: (node: FilterNode) => FilterNode | null,
  ): FilterNode[] {
    return nodes
      .map((node) => {
        if (node.id === targetId) {
          return updateFn(node);
        }
        if ("children" in node) {
          return {
            ...node,
            children: this.updateTree(node.children, targetId, updateFn),
          };
        }
        return node;
      })
      .filter((node): node is FilterNode => node !== null);
  }

  /**
   * Add a new rule to the filter tree.
   * If parentId is provided, adds the rule to the specified group; otherwise, adds to the root group.
   * @param rule The rule to add (without an ID; one will be generated).
   * @param parentId Optional ID of the parent group to add the rule to.
   */
  public addRule(rule: Omit<Rule, "id">, parentId?: string) {
    const newRule: Rule = { ...rule, id: crypto.randomUUID() };
    
    if (parentId) {
      const parent = this.findGroupById(parentId);
      if (parent) {
        this.filters.children.set(
          this.updateTree(this.filters.children.peek(), parentId, (node) => {
            if ("children" in node) {
              return {
                ...node,
                children: [...node.children, newRule],
              };
            }
            return node;
          }),
        );
      }
    } else {
      this.filters.children.push(newRule);
    }
  }

  /**
   * Update an existing rule anywhere in the filter tree.
   * @param ruleId The ID of the rule to update.
   * @param rule Partial rule properties to update.
   */
  public updateRule(ruleId: string, rule: Partial<Rule>) {
    this.filters.children.set(
      this.updateTree(this.filters.children.peek(), ruleId, (node) => {
        if ("children" in node) {
          return node; // Don't update groups
        }
        return { ...node, ...rule };
      }),
    );
  }

  /**
   * Add a new group to the filter tree.
   * If parentId is provided, adds the group to the specified parent group; otherwise, adds to the root group.
   * @param group The group to add (without an ID; one will be generated).
   * @param parentId Optional ID of the parent group to add the group to.
   */
  public addGroup(group: Omit<Group, "id">, parentId?: string) {
    const newGroup: Group = { ...group, id: crypto.randomUUID() };
    
    if (parentId) {
      const parent = this.findGroupById(parentId);
      if (parent) {
        this.filters.children.set(
          this.updateTree(this.filters.children.peek(), parentId, (node) => {
            if ("children" in node) {
              return {
                ...node,
                children: [...node.children, newGroup],
              };
            }
            return node;
          }),
        );
      }
    } else {
      this.filters.children.push(newGroup);
    }
  }

  /**
   * Update an existing group anywhere in the filter tree.
   * Only updates group properties except "id" and "children".
   * @param groupId The ID of the group to update.
   * @param group Partial group properties to update (excluding "id" and "children").
   */
  public updateGroup(groupId: string, group: Partial<Omit<Group, "id" | "children">>) {
    this.filters.children.set(
      this.updateTree(this.filters.children.peek(), groupId, (node) => {
        if ("children" in node) {
          return { ...node, ...group };
        }
        return node; // Don't update rules
      }),
    );
  }

  /**
   * Remove a rule from anywhere in the filter tree.
   * @param ruleId The ID of the rule to remove.
   */
  public removeRule(ruleId: string) {
    this.filters.children.set(
      this.updateTree(this.filters.children.peek(), ruleId, () => null),
    );
  }

  /**
   * Remove a group from anywhere in the filter tree.
   * All child rules and groups will also be removed.
   * @param groupId The ID of the group to remove.
   */
  public removeGroup(groupId: string) {
    this.filters.children.set(
      this.updateTree(this.filters.children.peek(), groupId, () => null),
    );
  }

  /**
   * Remove any node (rule or group) from anywhere in the filter tree.
   * @param nodeId The ID of the node to remove.
   */
  public removeNode(nodeId: string) {
    this.filters.children.set(
      this.updateTree(this.filters.children.peek(), nodeId, () => null),
    );
  }

  /**
   * Get a node (rule or group) by its ID from anywhere in the filter tree.
   * @param nodeId The ID of the node to retrieve.
   * @returns The FilterNode if found, or null.
   */
  public getNode(nodeId: string): FilterNode | null {
    return this.findNodeById(nodeId);
  }

  /**
   * Get a group by its ID from anywhere in the filter tree.
   * @param groupId The ID of the group to retrieve.
   * @returns The Group if found, or null.
   */
  public getGroup(groupId: string): Group | null {
    return this.findGroupById(groupId);
  }

  /**
   * Check if a node (rule or group) exists in the filter tree.
   * @param nodeId The ID of the node to check.
   * @returns True if the node exists, false otherwise.
   */
  public hasNode(nodeId: string): boolean {
    return this.findNodeById(nodeId) !== null;
  }

  /**
   * Get all rules from the entire filter tree as a flat array.
   * @returns An array of all Rule objects in the tree.
   */
  public getAllRules(): Rule[] {
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
    return collectRules(this.filters.children.peek());
  }

  /**
   * Get all groups from the entire filter tree as a flat array.
   * @returns An array of all Group objects in the tree.
   */
  public getAllGroups(): Group[] {
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
    return collectGroups(this.filters.children.peek());
  }

  /**
   * Get a pretty-printed JSON string representation of the filter tree.
   * @returns The filter tree as a formatted JSON string.
   */
  public toString() {
    return JSON.stringify(this.filters.peek(), null, 2);
  }

  /**
   * Get the current filter tree as a plain JavaScript object.
   * @returns The filter tree as a FilterAST object.
   */
  public toJSON(): FilterAST {
    return this.filters.peek();
  }
}
