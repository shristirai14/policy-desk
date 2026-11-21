"use client";

import { FormSelect } from "@/components/form-select";
import { DetailList, RatingTotals, VehiclePicker, type DetailControls, type RatingView } from "@/components/ua/compound-widgets";
import { EsignPanel, PaymentPanel, type EsignView, type PaymentView } from "@/components/ua/flow-widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/lib/status";
import type { ConditionContext } from "@/lib/ua/conditions";
import { evaluateCondition } from "@/lib/ua/conditions";
import { interpolate, isYes } from "@/lib/ua/packet";
import type { Navigation, UAQuestion } from "@/lib/ua/types";
import { isQuestionReadOnly, isQuestionRequired } from "@/lib/ua/validate";
import { isEntryType, normalizeType } from "@/lib/ua/widgets/registry";
import { cn } from "@/lib/utils";

const SPAN: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};


export type QuestionRowProps = {
  question: UAQuestion;
  fieldKey: string;
  value: string;
  error?: string;
  ctx: ConditionContext;
  locked: boolean;
  pending: boolean;
  onChange: (key: string, value: string) => void;
  onButton: (navigation: Navigation, actions: string[], confirmText?: string) => void;
  detail?: DetailControls;
  rating?: RatingView;
  vehicleLabel?: (risk: number) => string;
  payment?: PaymentView;
  esign?: EsignView;
  onPay?: (simulateFailure: boolean) => void;
};

function displayValue(question: UAQuestion, value: string) {
  const format = (question.props.Format ?? "").toLowerCase();
  if (format === "date") return formatDate(value);
  if (format === "currency") return formatMoney(value);
  if (format === "choice" || question.choices.length > 0) {
    return question.choices.find((choice) => choice.value === value)?.text ?? value;
  }
  return value;
}

function Control({ question, fieldKey, value, error, ctx, locked, onChange }: QuestionRowProps) {
  const type = normalizeType(question.type);
  const disabled = locked || isQuestionReadOnly(question, ctx);
  const common = {
    id: fieldKey,
    name: fieldKey,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${fieldKey}-error` : question.help ? `${fieldKey}-help` : undefined,
  };

  switch (type) {
    case "vehiclewidget":
      return (
        <VehiclePicker
          id={fieldKey}
          value={value}
          disabled={disabled}
          invalid={Boolean(error)}
          describedBy={common["aria-describedby"]}
          onChange={(code) => onChange(fieldKey, code)}
        />
      );
    case "select":
      return (
        <FormSelect
          {...common}
          size="lg"
          placeholder={question.placeholder || "Select"}
          value={value}
          onValueChange={(next) => onChange(fieldKey, next)}
          options={question.choices
            .filter((choice) => !(choice.disableCode && evaluateCondition(choice.disableCode, ctx)) || choice.value === value)
            .map((choice) => ({ value: choice.value, label: choice.text }))}
        />
      );
    case "yesno": {
      const options = [
        { value: "Y", text: question.props.YesText || "Yes" },
        { value: "N", text: question.props.NoText || "No" },
      ];
      return (
        <div role="radiogroup" aria-labelledby={`${fieldKey}-label`} className="inline-flex gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex h-9 min-w-16 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                value === option.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={fieldKey}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onChange(fieldKey, option.value)}
              />
              {option.text}
            </label>
          ))}
        </div>
      );
    }
    case "checkbox": {
      const checkedValue = question.props.CheckedValue || "Y";
      return (
        <input
          {...common}
          type="checkbox"
          className="size-4 rounded border-input accent-primary"
          checked={value === checkedValue}
          onChange={(e) => onChange(fieldKey, e.target.checked ? checkedValue : "")}
        />
      );
    }
    case "date":
      return <Input {...common} type="date" className="h-9" value={value} onChange={(e) => onChange(fieldKey, e.target.value)} />;
    case "number":
      return (
        <Input
          {...common}
          className="h-9"
          inputMode="decimal"
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
      );
    case "phone":
      return (
        <Input
          {...common}
          className="h-9"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value.replace(/\D/g, ""))}
        />
      );
    case "emailwidget":
      return (
        <Input
          {...common}
          className="h-9"
          type="email"
          autoComplete="email"
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
      );
    default:
      return (
        <Input
          {...common}
          className="h-9"
          maxLength={Number(question.props.MaxLength) || undefined}
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => onChange(fieldKey, isYes(question.props.Uppercase) ? e.target.value.toUpperCase() : e.target.value)}
        />
      );
  }
}

export function QuestionRow(props: QuestionRowProps) {
  const { question, fieldKey, value, error, ctx, locked, pending, onButton } = props;
  const type = normalizeType(question.type);
  const text = interpolate(question.text, ctx);

  if (type === "hidden" || type === "setvalue") return null;

  if (type === "detailselection") {
    return props.detail ? <DetailList question={question} controls={props.detail} /> : null;
  }

  if (type === "paymentwidget") {
    return (
      <PaymentPanel
        payment={props.payment}
        method={value}
        error={error}
        disabled={pending || locked}
        onMethod={(code) => props.onChange(fieldKey, code)}
        onPay={(simulateFailure) => props.onPay?.(simulateFailure)}
      />
    );
  }

  if (type === "esignstatus") {
    return <EsignPanel esign={props.esign} disabled={pending} onAction={(action, confirmText) => onButton("stay", [action], confirmText)} />;
  }

  if (type === "ratingtotals") {
    return <RatingTotals rating={props.rating} vehicleLabel={props.vehicleLabel ?? ((risk) => `Vehicle ${risk}`)} />;
  }

  if (type === "heading") {
    return (
      <div className="col-span-12">
        <h3 className={cn("font-medium", question.props.Level === "Small" ? "text-sm" : "text-base", question.props.LeftClass)}>
          {text}
        </h3>
      </div>
    );
  }

  if (type === "buttonwidget") {
    const variant = question.props.Variant === "outline" || question.props.Variant === "destructive" ? question.props.Variant : "default";
    const navigation = (["stay", "next", "prev"] as const).find((item) => item === question.props.Navigate) ?? "stay";
    const actions = (question.props.Actions ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    return (
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-3">
        {text ? <p className={cn("text-sm", question.props.LeftClass)}>{text}</p> : <span />}
        <Button
          type="button"
          variant={variant}
          disabled={pending || locked}
          onClick={() => onButton(navigation, actions, question.props.Confirm)}
        >
          {question.props.ButtonText || "Continue"}
        </Button>
      </div>
    );
  }

  if (!isEntryType(question.type)) {
    const shown = question.fieldName ? displayValue(question, value) : "";
    if (!question.fieldName) {
      return <p className={cn("col-span-12 text-sm", question.props.LeftClass)}>{text}</p>;
    }
    return (
      <>
        <div className={cn("col-span-12 text-sm text-muted-foreground", SPAN[question.leftCols], question.props.LeftClass)}>{text}</div>
        <div className={cn("col-span-12 text-sm font-medium", SPAN[question.rightCols], question.props.RightClass)}>
          {shown || <span className="font-normal text-muted-foreground">Not provided</span>}
        </div>
      </>
    );
  }

  const required = isQuestionRequired(question, ctx);
  const stacked = question.leftCols === 0 || question.leftCols >= 12;

  return (
    <>
      {question.leftCols > 0 ? (
        <label
          id={`${fieldKey}-label`}
          htmlFor={type === "yesno" ? undefined : fieldKey}
          data-field-label
          className={cn(
            "col-span-12 text-sm font-medium md:pt-2",
            stacked ? "md:col-span-12 md:pt-0" : SPAN[question.leftCols],
            question.props.LeftClass,
          )}
        >
          {text}
          {required ? <span className="text-destructive"> *</span> : null}
        </label>
      ) : null}
      <div className={cn("col-span-12 flex flex-col gap-1", stacked ? "md:col-span-12" : SPAN[question.rightCols], question.props.RightClass)}>
        <Control {...props} />
        {question.help && !error ? (
          <p id={`${fieldKey}-help`} className="text-xs text-muted-foreground">
            {question.help}
          </p>
        ) : null}
        {error ? (
          <p id={`${fieldKey}-error`} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
