"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "cn";

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean };

type Item = { value: string | null; label: React.ReactNode; disabled?: boolean };

export function FormSelect({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  emptyLabel,
  required,
  disabled,
  size = "default",
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyLabel?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const items: Item[] = [...(emptyLabel ? [{ value: null, label: emptyLabel }] : []), ...options];
  const toRoot = (next: string) => (next === "" ? null : next);
  const valueProps =
    value !== undefined
      ? { value: toRoot(value) }
      : defaultValue !== undefined
        ? { defaultValue: toRoot(defaultValue) }
        : {};

  return (
    <Select<string | null>
      items={items}
      name={name}
      required={required}
      disabled={disabled}
      onValueChange={(next) => onValueChange?.(next ?? "")}
      {...valueProps}
    >
      <SelectTrigger
        id={id}
        size={size === "sm" ? "sm" : "default"}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn("w-full min-w-0", size === "lg" && "data-[size=default]:h-9", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "__empty"} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
