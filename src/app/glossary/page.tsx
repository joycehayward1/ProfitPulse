"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_TERMS,
  type GlossaryCategory,
} from "@/lib/glossary";

type FilterCategory = GlossaryCategory | "All";

export default function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("All");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return GLOSSARY_TERMS.filter((t) => {
      const matchesCategory =
        activeCategory === "All" || t.category === activeCategory;
      const matchesSearch =
        !q ||
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.example.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  const grouped = useMemo(() => {
    const groups: { category: (typeof GLOSSARY_CATEGORIES)[number]; terms: typeof GLOSSARY_TERMS }[] = [];
    for (const cat of GLOSSARY_CATEGORIES) {
      const terms = filtered.filter((t) => t.category === cat.id);
      if (terms.length > 0) {
        groups.push({ category: cat, terms });
      }
    }
    return groups;
  }, [filtered]);

  function clearFilters() {
    setSearch("");
    setActiveCategory("All");
  }

  const pills: { id: FilterCategory; label: string }[] = [
    { id: "All", label: "All" },
    ...GLOSSARY_CATEGORIES.map((c) => ({ id: c.id as FilterCategory, label: c.label })),
  ];

  return (
    <AppLayout>
      <div className="space-y-xl">
        {/* Header */}
        <div>
          <h1 className="font-display text-display text-text-primary">
            Glossary
          </h1>
          <p className="text-body text-text-muted mt-1">
            Plain-English definitions of every number in Profit Pulse.
          </p>
        </div>

        {/* Search */}
        <div>
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a term, definition, or example..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-surface text-body text-text-primary placeholder:text-text-muted focus:border-orange focus:ring-2 focus:ring-orange/15 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => {
            const isActive = activeCategory === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveCategory(pill.id)}
                className={[
                  "px-3 py-1.5 rounded-full text-body-sm font-medium border transition-colors",
                  isActive
                    ? "bg-orange/10 border-orange text-orange"
                    : "bg-transparent border-border-light text-text-secondary hover:border-border hover:text-text-primary",
                ].join(" ")}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {grouped.length === 0 ? (
          <div className="text-center py-2xl">
            <p className="text-body text-text-muted mb-md">
              No matches. Try a different word.
            </p>
            <button
              onClick={clearFilters}
              className="text-body-sm font-medium text-orange hover:text-orange-light transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-2xl">
            {grouped.map(({ category, terms }) => (
              <section key={category.id}>
                <div className="mb-md">
                  <h2 className="font-display text-h3 font-semibold text-text-primary tracking-tight">
                    {category.label}
                  </h2>
                  <p className="text-body-sm text-text-secondary mt-0.5">
                    {category.description}
                  </p>
                </div>

                <div className="space-y-md">
                  {terms.map((term) => (
                    <Card key={term.slug} variant="standard">
                      <h3 className="font-display text-[18px] font-semibold text-text-primary mb-sm">
                        {term.term}
                      </h3>

                      <p className="text-body text-text-primary leading-relaxed mb-md">
                        {term.definition}
                      </p>

                      <div className="bg-orange/5 rounded-md px-md py-sm mb-md">
                        <span className="text-caption uppercase tracking-wider text-orange font-semibold">
                          For example
                        </span>
                        <p className="text-body-sm text-text-secondary italic mt-0.5">
                          {term.example}
                        </p>
                      </div>

                      {term.whereToFind && (
                        <div className="flex items-center gap-1.5 text-body-sm text-text-muted">
                          <Icon icon="ph:map-pin" className="w-4 h-4 flex-shrink-0" />
                          <span>Find it in Profit Pulse:</span>
                          {term.whereToFindHref ? (
                            <Link
                              href={term.whereToFindHref}
                              className="text-text-secondary hover:text-orange transition-colors"
                            >
                              {term.whereToFind}
                            </Link>
                          ) : (
                            <span className="text-text-secondary">{term.whereToFind}</span>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
