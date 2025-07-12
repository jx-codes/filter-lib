import { createFilterStore } from "./filter-store";
import { createContext, useContext, useState } from "react";
import { createInitialFilterState, FilterConfig } from "./helpers";
import { FilterAST, FilterNode, Rule } from "./types";

const FilterStoreContext = createContext<ReturnType<typeof createFilterStore>>(
  createFilterStore({
    filterFields: { fields: [] },
  })
);

export const FilterStoreProvider = ({
  children,
  config,
  initialState,
}: {
  children: React.ReactNode;
  config: FilterConfig;
  initialState?: FilterAST;
}) => {
  const [store] = useState(() =>
    createFilterStore({
      initialState: initialState ?? createInitialFilterState(config),
      filterFields: config,
    })
  );

  return (
    <FilterStoreContext.Provider value={store}>
      {children}
    </FilterStoreContext.Provider>
  );
};

export const useFilterRuleById = (id: string) => {
  const store = useContext(FilterStoreContext);
  const { getNode } = store;
  const rule = getNode(id);

  if (rule && "children" in rule) {
    throw new Error("useFilterRuleById is only available for rules");
  }
  return rule;
};

export const useFilterGroupById = (id: string) => {
  const store = useContext(FilterStoreContext);
  const { getNode } = store;
  const group = getNode(id);
  if (group && !("children" in group)) {
    throw new Error("useFilterGroupById is only available for groups");
  }
  return group;
};

export const useFilterStoreContext = () => {
  return useContext(FilterStoreContext);
};
