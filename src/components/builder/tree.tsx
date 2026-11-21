"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { BQuestion, BuilderData } from "@/lib/ua/builder-types";
import { cn } from "@/lib/utils";

function questionLabel(question: BQuestion) {
  return question.text || question.fieldName || question.props.ButtonText || question.type;
}

function matches(question: BQuestion, filter: string) {
  return [question.text, question.fieldName, question.type].some((part) => part.toLowerCase().includes(filter));
}

export function BuilderTree({ data, selected, add }: { data: BuilderData; selected: string; add: string }) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const needle = filter.trim().toLowerCase();
  const base = `/builder/${data.manual.id}`;

  function toggle(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const row = (key: string, label: React.ReactNode, depth: number, options: { expandKey?: string; muted?: boolean } = {}) => {
    const active = selected === key && !add;
    const open = options.expandKey ? !collapsed.has(options.expandKey) || Boolean(needle) : false;
    return (
      <div className={cn("flex items-center rounded-md", active && "bg-muted")} style={{ paddingLeft: depth * 14 }}>
        {options.expandKey ? (
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted"
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => toggle(options.expandKey!)}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <Link
          href={`${base}?node=${key}`}
          aria-current={active ? "true" : undefined}
          className={cn("min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-sm hover:underline", active && "font-medium", options.muted && "text-muted-foreground")}
        >
          {label}
        </Link>
      </div>
    );
  };

  const addRow = (parentKey: string, kind: string, label: string, depth: number) => {
    const active = selected === parentKey && add === kind;
    return (
      <Link
        href={`${base}?node=${parentKey}&add=${kind}`}
        className={cn(
          "flex items-center gap-1 rounded-md py-1 text-xs text-muted-foreground hover:text-foreground hover:underline",
          active && "bg-muted font-medium text-foreground",
        )}
        style={{ paddingLeft: depth * 14 + 26 }}
      >
        <Plus className="size-3" />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Input aria-label="Search this manual" placeholder="Search field, text or type" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <nav aria-label="Manual structure" className="flex flex-col gap-0.5">
        {row("manual", data.manual.name, 0)}
        {data.views.map((view) => {
          const viewKey = `view:${view.id}`;
          const viewOpen = !collapsed.has(viewKey) || Boolean(needle);
          return (
            <div key={view.id} className="flex flex-col gap-0.5">
              {row(viewKey, <>View: {view.name}</>, 0, { expandKey: viewKey })}
              {viewOpen
                ? view.pages.map((page) => {
                    const pageKey = `page:${page.linkId}`;
                    const sections = page.sections
                      .map((section) => ({
                        section,
                        questions: needle ? section.questions.filter((question) => matches(question, needle)) : section.questions,
                      }))
                      .filter((item) => !needle || item.questions.length > 0);
                    if (needle && sections.length === 0) return null;
                    const pageOpen = !collapsed.has(pageKey) || Boolean(needle);
                    return (
                      <div key={page.linkId} className="flex flex-col gap-0.5">
                        {row(pageKey, page.name, 1, { expandKey: pageKey })}
                        {pageOpen
                          ? sections.map(({ section, questions }) => {
                              const sectionKey = `section:${section.linkId}`;
                              const sectionOpen = !collapsed.has(sectionKey) || Boolean(needle);
                              return (
                                <div key={section.linkId} className="flex flex-col gap-0.5">
                                  {row(sectionKey, section.name, 2, { expandKey: sectionKey })}
                                  {sectionOpen
                                    ? questions.map((question) => (
                                        <div key={question.id}>
                                          {row(
                                            `question:${question.id}`,
                                            <>
                                              {questionLabel(question)} <span className="text-xs text-muted-foreground">{question.type}</span>
                                            </>,
                                            3,
                                          )}
                                        </div>
                                      ))
                                    : null}
                                  {sectionOpen && !needle ? addRow(sectionKey, "question", "Add question", 3) : null}
                                </div>
                              );
                            })
                          : null}
                        {pageOpen && !needle ? addRow(pageKey, "section", "Add section", 2) : null}
                      </div>
                    );
                  })
                : null}
              {viewOpen && !needle ? addRow(viewKey, "page", "Add page", 1) : null}
            </div>
          );
        })}
        {needle ? null : addRow("manual", "view", "Add view", 0)}
      </nav>
    </div>
  );
}
