"use client";

import type { Category } from "@/lib/types";

interface TabConfig {
  key: Category;
  label: string;
}

const TABS: TabConfig[] = [
  { key: "popular", label: "인기" },
  { key: "rising", label: "상승률" },
  { key: "falling", label: "하락률" },
  { key: "volume", label: "거래량" },
  { key: "foreignBuy", label: "외인매수" },
  { key: "foreignSell", label: "외인매도" },
  { key: "institutionBuy", label: "기관매수" },
  { key: "institutionSell", label: "기관매도" },
];

interface CategoryTabsProps {
  active: Category;
  onChange: (category: Category) => void;
}

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            active === tab.key
              ? "bg-accent text-white"
              : "bg-card text-text-secondary hover:bg-card-hover hover:text-text-primary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
