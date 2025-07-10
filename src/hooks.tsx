import { FilterStore } from "./filter-store";
import { createContext, useContext, useState } from "react";
import { createInitialFilterState, FilterConfig } from "./helpers";
import { FilterAST } from "./types";

const FilterStoreContext = createContext<FilterStore>(new FilterStore());

export const FilterStoreProvider = <ComponentKey extends string>({
  children,
  config,
  initialState,
}: {
  children: React.ReactNode;
  config: FilterConfig<ComponentKey>;
  initialState?: FilterAST;
}) => {
  const [store] = useState(
    () => new FilterStore(initialState ?? createInitialFilterState(config))
  );

  return (
    <FilterStoreContext.Provider value={store}>
      {children}
    </FilterStoreContext.Provider>
  );
};

export const useFilterStore = () => {
  return useContext(FilterStoreContext);
};
