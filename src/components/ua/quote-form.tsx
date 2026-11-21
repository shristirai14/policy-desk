"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPageAction } from "@/app/(app)/quotes/actions";
import type { DetailControls, RatingView } from "@/components/ua/compound-widgets";
import type { EsignView, PaymentView } from "@/components/ua/flow-widgets";
import { QuestionRow } from "@/components/ua/question-row";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { riskCount, riskDefaults } from "@/lib/ua/engine";
import { fieldKey, interpolate, isYes, makeContext } from "@/lib/ua/packet";
import type { Navigation, Packet, UAPage, UAQuestion, UASection } from "@/lib/ua/types";
import { isQuestionVisible, isSectionVisible, validatePage } from "@/lib/ua/validate";
import { isEntryType, normalizeType, RISK_COUNT_FIELD } from "@/lib/ua/widgets/registry";
import { cn } from "@/lib/utils";

export type Step = { id: number; label: string; order: number };

type QuoteFormProps = {
  quoteId: number;
  page: UAPage;
  steps: Step[];
  furthestOrder: number;
  packet: Packet;
  userType: string;
  locked: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  nextText: string;
  previousText: string;
  maxRisks?: number;
  rating?: RatingView;
  payment?: PaymentView;
  esign?: EsignView;
  preview?: boolean;
};

export function QuoteForm(props: QuoteFormProps) {
  const { quoteId, page, steps, furthestOrder, packet, userType, locked, hasPrevious, hasNext } = props;
  const maxRisks = props.maxRisks ?? 5;
  const router = useRouter();
  const [values, setValues] = useState<Packet>(packet);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingRisk, setEditingRisk] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const ctx = useMemo(() => makeContext(values, { userType }), [values, userType]);
  const riskCtx = useMemo(
    () => (editingRisk ? makeContext(values, { userType, risk: editingRisk }) : null),
    [values, userType, editingRisk],
  );

  const detailQuestion = page.sections.flatMap((section) => section.questions).find((question) => normalizeType(question.type) === "detailselection");
  const itemLabel = detailQuestion?.props.ItemLabel || "Item";
  const count = riskCount(values);

  function setField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function collect(risk?: number) {
    const posted: Record<string, string> = {};
    for (const section of page.sections) {
      for (const question of section.questions) {
        if (!question.fieldName || !isEntryType(question.type) || question.riskSpecific !== Boolean(risk)) continue;
        const key = fieldKey(question.fieldName, question.riskSpecific, risk);
        posted[key] = values[key] ?? "";
      }
    }
    return posted;
  }

  function focusFirst(found: Record<string, string>) {
    const first = Object.keys(found)[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)?.focus();
  }

  function submit(navigation: Navigation, actions: string[] = [], confirmText?: string, risk?: number, extra: Record<string, string> = {}) {
    if (confirmText && !window.confirm(confirmText)) return;
    const riskAction = actions.some((action) => action === "SAVERISK" || action === "DELETERISK");

    if (props.preview) {
      if (actions.includes("DELETERISK")) {
        toast.success("Preview only. Nothing was deleted.");
        return;
      }
      const found = risk ? validatePage(page, makeContext(values, { userType, risk }), risk) : navigation === "next" || actions.length > 0 ? validatePage(page, ctx) : {};
      setErrors(found);
      if (Object.keys(found).length > 0) {
        toast.error("Some answers need attention before you can continue.");
        return;
      }
      if (actions.includes("SAVERISK") && risk) {
        setValues((current) => ({ ...current, [RISK_COUNT_FIELD]: String(Math.max(riskCount(current), risk)) }));
        setEditingRisk(null);
      }
      toast.success(actions.length > 0 && !riskAction ? `Preview only. Would run: ${actions.join(", ")}.` : "Preview only. Nothing was saved.");
      return;
    }

    startTransition(async () => {
      const result = await submitPageAction({ quoteId, pageId: page.id, values: { ...collect(risk), ...extra }, navigation, actions, risk });
      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.message);
        focusFirst(result.errors);
        return;
      }
      setErrors({});
      setValues(result.packet);
      if (riskAction) {
        setEditingRisk(null);
        toast.success(actions.includes("DELETERISK") ? `${itemLabel} deleted.` : `${itemLabel} saved.`);
      } else if (actions.includes("PAY")) {
        toast.success("Payment received.");
      } else if (actions.includes("ESIGN")) {
        toast.success("Documents sent for e-sign.");
      } else if (actions.includes("RESENDESIGN")) {
        toast.success("Signing email sent again.");
      } else if (actions.includes("RESETESIGN")) {
        toast.success("E-sign cancelled.");
      } else if (navigation === "stay" && actions.length === 0) {
        toast.success("Saved.");
      }
      router.push(result.redirectTo);
      router.refresh();
    });
  }

  function startRisk(risk: number, isNew: boolean) {
    if (isNew) setValues((current) => ({ ...riskDefaults(page, risk), ...current }));
    setErrors({});
    setEditingRisk(risk);
  }

  function cancelRisk() {
    setValues((current) => {
      const next = { ...current };
      for (const key of Object.keys(collect(editingRisk ?? undefined))) {
        if (packet[key] === undefined) delete next[key];
        else next[key] = packet[key];
      }
      return next;
    });
    setErrors({});
    setEditingRisk(null);
  }

  const detail: DetailControls = {
    count,
    max: maxRisks,
    editing: editingRisk,
    values,
    error: errors[RISK_COUNT_FIELD],
    locked,
    pending,
    onAdd: () => startRisk(count + 1, true),
    onEdit: (risk) => startRisk(risk, false),
    onDelete: (risk) => submit("stay", ["DELETERISK"], `Delete ${itemLabel.toLowerCase()} ${risk}? This cannot be undone.`, risk),
  };

  const vehicleLabel = (risk: number) =>
    [values[`Make_${risk}`], values[`Model_${risk}`], values[`RegistrationNumber_${risk}`]].filter(Boolean).join(" ") || `Vehicle ${risk}`;

  function renderQuestion(question: UAQuestion) {
    const risk = question.riskSpecific ? (editingRisk ?? undefined) : undefined;
    const activeCtx = question.riskSpecific && riskCtx ? riskCtx : ctx;
    const key = fieldKey(question.fieldName, question.riskSpecific, risk);
    return (
      <QuestionRow
        key={`${question.id}-${risk ?? 0}`}
        question={question}
        fieldKey={key || `q${question.id}`}
        value={question.fieldName ? (values[key] ?? "") : ""}
        error={errors[key]}
        ctx={activeCtx}
        locked={locked}
        pending={pending}
        onChange={setField}
        onButton={submit}
        detail={detail}
        rating={props.rating}
        vehicleLabel={vehicleLabel}
        payment={props.payment}
        esign={props.esign}
        onPay={(simulateFailure) => submit("stay", ["PAY"], undefined, undefined, simulateFailure ? { PaymentTestOutcome: "FAIL" } : {})}
      />
    );
  }

  function renderSection(section: UASection) {
    if (!isSectionVisible(section, ctx)) return null;
    const questions = section.questions.filter((question) => {
      if (question.riskSpecific) return riskCtx !== null && isQuestionVisible(question, riskCtx);
      return isQuestionVisible(question, ctx);
    });
    if (questions.length === 0) return null;
    const riskOnly = questions.every((question) => question.riskSpecific);
    const headingCtx = riskOnly && riskCtx ? riskCtx : ctx;
    return (
      <Card key={section.id} className={cn(section.props.SectionClass, riskOnly && "border-primary")}>
        {section.heading ? (
          <CardHeader>
            <CardTitle>{interpolate(section.heading, headingCtx)}</CardTitle>
            {section.subHeading ? <CardDescription>{interpolate(section.subHeading, headingCtx)}</CardDescription> : null}
          </CardHeader>
        ) : null}
        <CardContent>
          <div className="grid grid-cols-12 items-start gap-x-4 gap-y-3">{questions.map(renderQuestion)}</div>
        </CardContent>
      </Card>
    );
  }

  const twoArea = page.props.DefaultLayout === "TwoArea";
  const main = page.sections.filter((section) => !twoArea || section.area !== 2);
  const side = twoArea ? page.sections.filter((section) => section.area === 2) : [];
  const errorCount = Object.keys(errors).length;
  const editing = editingRisk !== null;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Quote progress">
        <ol className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const current = step.id === page.id;
            const reachable = step.order <= furthestOrder;
            const done = reachable && step.order < page.order;
            const body = (
              <>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : index + 1}
                </span>
                {step.label}
              </>
            );
            const className = cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
              current ? "border-primary font-medium" : "border-transparent text-muted-foreground",
            );
            return (
              <li key={step.id}>
                {reachable && !current ? (
                  <Link href={`/quotes/${quoteId}/${step.id}`} className={cn(className, "hover:bg-muted")}>
                    {body}
                  </Link>
                ) : (
                  <span className={className} aria-current={current ? "step" : undefined}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {page.heading ? (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{interpolate(page.heading, ctx)}</h2>
          {page.subHeading ? <p className="text-sm text-muted-foreground">{interpolate(page.subHeading, ctx)}</p> : null}
        </div>
      ) : null}

      {locked ? (
        <Alert>
          <AlertDescription>This quote is locked. You can review the answers but not change them.</AlertDescription>
        </Alert>
      ) : null}
      {errorCount > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>{errorCount === 1 ? "1 answer needs attention." : `${errorCount} answers need attention.`}</AlertDescription>
        </Alert>
      ) : null}

      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (locked) return;
          if (editingRisk !== null) submit("stay", ["SAVERISK"], undefined, editingRisk);
          else if (hasNext) submit("next");
        }}
        className="flex flex-col gap-6"
      >
        <div className={cn("grid gap-4", twoArea && "lg:grid-cols-[2fr_1fr] lg:items-start")}>
          <div className="flex flex-col gap-4">{main.map(renderSection)}</div>
          {twoArea ? <div className="flex flex-col gap-4">{side.map(renderSection)}</div> : null}
        </div>

        {editing ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={cancelRisk}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : `Save ${itemLabel.toLowerCase()} ${editingRisk}`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div>
              {hasPrevious && !isYes(page.props.HidePreviousButton) ? (
                <Button type="button" variant="outline" disabled={pending} onClick={() => submit("prev")}>
                  {props.previousText}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              {locked ? null : (
                <Button type="button" variant="ghost" disabled={pending} onClick={() => submit("stay")}>
                  Save
                </Button>
              )}
              {hasNext && !locked && !isYes(page.props.HideNextButton) ? (
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : props.nextText}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
