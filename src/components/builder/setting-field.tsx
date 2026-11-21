"use client";

import { FormSelect } from "@/components/form-select";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSimple, OPERATORS, parseSimple, type Joiner, type Rule } from "@/lib/ua/condition-text";
import { ACTION_CATALOG, type SettingDef } from "@/lib/ua/widgets/registry";
import { cn } from "@/lib/utils";

export const FIELD_LIST_ID = "ua-field-names";


const TEXTAREA_CLASS =
  "min-h-16 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function ConditionBuilder({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const parsed = parseSimple(value);
  const [rules, setRules] = useState<Rule[]>(parsed?.rules ?? []);
  const [joiner, setJoiner] = useState<Joiner>(parsed?.joiner ?? "AND");
  const [raw, setRaw] = useState(parsed === null);

  function update(nextRules: Rule[], nextJoiner: Joiner) {
    setRules(nextRules);
    setJoiner(nextJoiner);
    onChange(buildSimple(nextRules, nextJoiner));
  }

  if (raw) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          id={id}
          className={cn(TEXTAREA_CLASS, "font-mono text-xs")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="(State,=,MH;State,=,GJ;OR);CoverType,=,PACKAGE;AND"
        />
        <p className="text-xs text-muted-foreground">
          Written as Field,operator,value rules separated by semicolons, ending in AND or OR. Use brackets to group.
        </p>
        {parseSimple(value) ? (
          <button
            type="button"
            className="self-start text-xs underline-offset-4 hover:underline"
            onClick={() => {
              const again = parseSimple(value);
              setRules(again?.rules ?? []);
              setJoiner(again?.joiner ?? "AND");
              setRaw(false);
            }}
          >
            Use the rule editor
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          {index > 0 ? (
            <FormSelect
              aria-label="Join with"
              className="w-20"
              value={joiner}
              onValueChange={(next) => update(rules, next === "OR" ? "OR" : "AND")}
              options={[
                { value: "AND", label: "and" },
                { value: "OR", label: "or" },
              ]}
            />
          ) : null}
          <Input
            aria-label="Field"
            list={FIELD_LIST_ID}
            placeholder="Field"
            className="w-40"
            value={rule.field}
            onChange={(e) => update(rules.map((item, i) => (i === index ? { ...item, field: e.target.value } : item)), joiner)}
          />
          <FormSelect
            aria-label="Operator"
            className="w-40"
            value={rule.operator}
            onValueChange={(next) => update(rules.map((item, i) => (i === index ? { ...item, operator: next } : item)), joiner)}
            options={OPERATORS.map((operator) => ({ value: operator.value, label: operator.label }))}
          />
          <Input
            aria-label="Value"
            placeholder={rule.operator === "in" || rule.operator === "not in" || rule.operator === "between" ? "A|B" : "Value or BLANK"}
            className="w-40"
            value={rule.value === "BLANK" ? "" : rule.value}
            onChange={(e) => update(rules.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)), joiner)}
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => update(rules.filter((_, i) => i !== index), joiner)}>
            <X />
            <span className="sr-only">Remove rule</span>
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button id={id} type="button" variant="outline" size="sm" onClick={() => update([...rules, { field: "", operator: "=", value: "" }], joiner)}>
          <Plus />
          Add rule
        </Button>
        <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setRaw(true)}>
          Edit as text
        </button>
        {rules.length === 0 ? <span className="text-xs text-muted-foreground">No rules: always applies.</span> : null}
      </div>
    </div>
  );
}

function ActionPicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const selected = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const extras = selected.filter((item) => !ACTION_CATALOG.includes(item));

  function toggle(action: string) {
    const next = selected.includes(action) ? selected.filter((item) => item !== action) : [...selected, action];
    onChange(next.join(","));
  }

  return (
    <div id={id} className="flex flex-wrap gap-2" role="group">
      {[...ACTION_CATALOG, ...extras].map((action) => {
        const active = selected.includes(action);
        return (
          <label
            key={action}
            className={cn(
              "flex h-7 cursor-pointer items-center rounded-lg border px-2.5 text-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted",
            )}
          >
            <input type="checkbox" className="sr-only" checked={active} onChange={() => toggle(action)} />
            {action}
          </label>
        );
      })}
    </div>
  );
}

export function SettingField({
  def,
  value,
  onChange,
  idPrefix,
}: {
  def: SettingDef;
  value: string;
  onChange: (key: string, value: string) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${def.key}`;
  const wide = def.wide || def.control === "condition" || def.control === "actions" || def.control === "longtext";
  const set = (next: string) => onChange(def.key, next);

  let control: React.ReactNode;
  switch (def.control) {
    case "condition":
      control = <ConditionBuilder id={id} value={value} onChange={set} />;
      break;
    case "actions":
      control = <ActionPicker id={id} value={value} onChange={set} />;
      break;
    case "longtext":
      control = <textarea id={id} className={TEXTAREA_CLASS} value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "yesno":
      control = (
        <FormSelect
          id={id}
          value={value}
          onValueChange={set}
          emptyLabel="Not set"
          options={[
            { value: "Y", label: "Yes" },
            { value: "N", label: "No" },
          ]}
        />
      );
      break;
    case "bool":
      control = (
        <FormSelect
          id={id}
          value={value === "Y" ? "Y" : "N"}
          onValueChange={set}
          options={[
            { value: "Y", label: "Yes" },
            { value: "N", label: "No" },
          ]}
        />
      );
      break;
    case "select":
      control = (
        <FormSelect
          id={id}
          value={value}
          onValueChange={set}
          emptyLabel="Default"
          options={(def.options ?? []).map((option) => ({ value: option, label: def.optionLabels?.[option] ?? option }))}
        />
      );
      break;
    case "date":
      control = <Input id={id} type="date" value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "number":
      control = <Input id={id} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />;
      break;
    default:
      control = <Input id={id} value={value} onChange={(e) => set(e.target.value)} />;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <label htmlFor={id} className="text-sm font-medium">
        {def.label}
      </label>
      {control}
      {def.help ? <p className="text-xs text-muted-foreground">{def.help}</p> : null}
    </div>
  );
}
