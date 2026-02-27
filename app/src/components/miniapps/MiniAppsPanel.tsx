import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { miniApps, APP_CATEGORIES, AppCategory } from "./apps.ts";
import AppCard from "./AppCard.tsx";
import "@/assets/pages/miniapps.less";

function MiniAppsPanel() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<AppCategory>("all");

  const filtered = useMemo(() => {
    return miniApps.filter((app) => {
      const matchCategory =
        activeCategory === "all" || app.category === activeCategory;
      const matchSearch =
        search.trim() === "" ||
        app.name.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [search, activeCategory]);

  return (
    <div className="miniapps-container">
      <div className="miniapps-header">
        <h1 className="miniapps-title">{t("bar.miniapps")}</h1>
        <div className="miniapps-search-wrapper">
          <Search className="miniapps-search-icon" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("miniapps.search")}
            className="miniapps-search-input"
          />
        </div>
      </div>

      <div className="miniapps-categories">
        {APP_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`miniapps-category-btn${activeCategory === cat ? " active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {t(`miniapps.category.${cat}`)}
          </button>
        ))}
      </div>

      <div className="miniapps-grid">
        {filtered.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
        {filtered.length === 0 && (
          <div className="miniapps-empty">{t("miniapps.empty")}</div>
        )}
      </div>
    </div>
  );
}

export default MiniAppsPanel;
