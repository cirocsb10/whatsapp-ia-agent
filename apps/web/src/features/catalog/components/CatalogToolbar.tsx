import { Grid3X3, List, Search, SlidersHorizontal } from "lucide-react";

export type ViewMode = "grid" | "list";
export type FilterTab = "all" | "active" | "inactive" | "out_of_stock";

const FILTER_LABELS: Record<FilterTab, string> = {
  all: "Todos",
  active: "Ativos",
  inactive: "Inativos",
  out_of_stock: "Esgotados",
};

const FILTER_TABS: FilterTab[] = ["all", "active", "inactive", "out_of_stock"];

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  filterTab: FilterTab;
  onFilterTabChange: (tab: FilterTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeFilterCount: number;
  onOpenFilterPanel: () => void;
}

export function CatalogToolbar({
  search,
  onSearchChange,
  filterTab,
  onFilterTabChange,
  viewMode,
  onViewModeChange,
  activeFilterCount,
  onOpenFilterPanel,
}: Props) {
  return (
    <div className="catalog-toolbar" style={{ marginBottom: 16 }}>
      <div className="catalog-search-wrap" style={{ flex: "1 1 220px", maxWidth: "none" }}>
        <Search className="catalog-search-icon" />
        <input
          className="catalog-search-input"
          placeholder="Buscar por nome, SKU..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="catalog-filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onFilterTabChange(tab)}
              className={`orders-tab ${filterTab === tab ? "orders-tab-active" : ""}`}
            >
              {FILTER_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="catalog-view-toggle">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`catalog-view-btn ${viewMode === "grid" ? "catalog-view-btn-active" : ""}`}
            title="Grade"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`catalog-view-btn ${viewMode === "list" ? "catalog-view-btn-active" : ""}`}
            title="Lista"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          className={`orders-tool-btn relative${activeFilterCount > 0 ? " orders-tool-btn--active" : ""}`}
          title="Filtros avançados"
          onClick={onOpenFilterPanel}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
      </div>
    </div>
  );
}
