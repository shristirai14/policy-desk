"use client";

import { FormSelect } from "@/components/form-select";
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addNodeAction,
  copyQuestionAction,
  moveNodeAction,
  removeNodeAction,
  saveNodeAction,
  type BuilderResult,
} from "@/app/(app)/builder/actions";
import { FIELD_LIST_ID, SettingField } from "@/components/builder/setting-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BChoice, BManual, BPage, BQuestion, BSection, BView, NodeKind } from "@/lib/ua/builder-types";
import type { Props } from "@/lib/ua/types";
import {
  getWidget,
  listWidgets,
  PAGE_SETTINGS,
  SECTION_SETTINGS,
  settingsForQuestion,
  VIEW_SETTINGS,
  type SettingDef,
} from "@/lib/ua/widgets/registry";


const USER_CLASSES = ["ALL", "agent", "internal"];

function useBuilderAction(manualId: number) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(action: () => Promise<BuilderResult>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.node) router.push(`/builder/${manualId}?node=${result.node}`);
      router.refresh();
    });
  }

  return { pending, error, run };
}

type ShellProps = {
  manualId: number;
  kind: NodeKind;
  id: number;
  title: string;
  description: string;
  coreDefs: SettingDef[];
  core: Props;
  settingDefs: SettingDef[] | ((core: Props) => SettingDef[]);
  props: Props;
  choices?: BChoice[];
  removeLabel?: string;
  removeConfirm?: string;
  movable?: boolean;
  previewHref?: string;
  notice?: string;
};

function EditorShell(shell: ShellProps) {
  const { manualId, kind, id } = shell;
  const { pending, error, run } = useBuilderAction(manualId);
  const [core, setCore] = useState<Props>(shell.core);
  const [props, setProps] = useState<Props>(shell.props);
  const [choices, setChoices] = useState<BChoice[]>(shell.choices ?? []);
  const settingDefs = typeof shell.settingDefs === "function" ? shell.settingDefs(core) : shell.settingDefs;
  const showChoices = kind === "question" && Boolean(getWidget(core.type ?? "")?.hasChoices);
  const idPrefix = `${kind}-${id}`;

  function save(event: React.FormEvent) {
    event.preventDefault();
    run(() => saveNodeAction({ manualId, kind, id, core, props, choices: kind === "question" ? choices : undefined }));
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{shell.title}</h2>
          <p className="text-sm text-muted-foreground">{shell.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shell.movable && kind !== "manual" && kind !== "view" ? (
            <>
              <Button type="button" variant="outline" size="icon" disabled={pending} onClick={() => run(() => moveNodeAction({ manualId, kind, id, direction: "up" }))}>
                <ArrowUp />
                <span className="sr-only">Move up</span>
              </Button>
              <Button type="button" variant="outline" size="icon" disabled={pending} onClick={() => run(() => moveNodeAction({ manualId, kind, id, direction: "down" }))}>
                <ArrowDown />
                <span className="sr-only">Move down</span>
              </Button>
            </>
          ) : null}
          {kind === "question" ? (
            <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => copyQuestionAction({ manualId, id }))}>
              <Copy />
              Copy
            </Button>
          ) : null}
          {shell.previewHref ? (
            <Button nativeButton={false} variant="outline" render={<Link href={shell.previewHref} target="_blank" />}>
              <Eye />
              Preview
            </Button>
          ) : null}
          {shell.removeLabel && kind !== "manual" ? (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (window.confirm(shell.removeConfirm ?? "Remove this item?")) run(() => removeNodeAction({ manualId, kind, id }));
              }}
            >
              <Trash2 />
              {shell.removeLabel}
            </Button>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {shell.notice ? (
        <Alert>
          <AlertDescription>{shell.notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {shell.coreDefs.map((def) => (
              <SettingField
                key={def.key}
                def={def}
                idPrefix={`${idPrefix}-core`}
                value={core[def.key] ?? ""}
                onChange={(key, value) => setCore((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build settings</CardTitle>
            <CardDescription>Empty settings use the default behaviour.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {settingDefs.length === 0 ? <p className="text-sm text-muted-foreground sm:col-span-2">This item has no extra settings.</p> : null}
            {settingDefs.map((def) => (
              <SettingField
                key={`${core.type ?? ""}-${def.key}`}
                def={def}
                idPrefix={`${idPrefix}-prop`}
                value={props[def.key] ?? ""}
                onChange={(key, value) => setProps((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {showChoices ? (
        <Card>
          <CardHeader>
            <CardTitle>Choices</CardTitle>
            <CardDescription>The value is stored in the quote; the text is what the agent sees.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {choices.length > 0 ? (
              <div className="grid grid-cols-[1fr_2fr_auto_auto] items-center gap-2 text-xs text-muted-foreground">
                <span>Value</span>
                <span>Text</span>
                <span>Default</span>
                <span className="sr-only">Remove</span>
              </div>
            ) : null}
            {choices.map((choice, index) => (
              <div key={index} className="grid grid-cols-[1fr_2fr_auto_auto] items-center gap-2">
                <Input
                  aria-label={`Choice ${index + 1} value`}
                  value={choice.value}
                  onChange={(e) => setChoices((current) => current.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                />
                <Input
                  aria-label={`Choice ${index + 1} text`}
                  value={choice.text}
                  onChange={(e) => setChoices((current) => current.map((item, i) => (i === index ? { ...item, text: e.target.value } : item)))}
                />
                <input
                  type="radio"
                  name={`${idPrefix}-default`}
                  aria-label={`Make choice ${index + 1} the default`}
                  className="mx-3 size-4 accent-primary"
                  checked={choice.isDefault}
                  onChange={() => setChoices((current) => current.map((item, i) => ({ ...item, isDefault: i === index })))}
                />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setChoices((current) => current.filter((_, i) => i !== index))}>
                  <X />
                  <span className="sr-only">Remove choice {index + 1}</span>
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChoices((current) => [...current, { value: "", text: "", isDefault: false, disableCode: "" }])}
              >
                <Plus />
                Add choice
              </Button>
              {choices.some((choice) => choice.isDefault) ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setChoices((current) => current.map((item) => ({ ...item, isDefault: false })))}>
                  Clear default
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </form>
  );
}

export function FieldNameList({ names }: { names: string[] }) {
  return (
    <datalist id={FIELD_LIST_ID}>
      {names.map((name) => (
        <option key={name} value={name} />
      ))}
      <option value="usertype" />
      <option value="NumberOfRisks" />
    </datalist>
  );
}

export function ManualEditor({ manual }: { manual: BManual }) {
  return (
    <EditorShell
      manualId={manual.id}
      kind="manual"
      id={manual.id}
      title={manual.name}
      description={`Manual ID ${manual.id}. Agents can start quotes only while the status is Active and today is inside the date range.`}
      coreDefs={[
        { key: "name", label: "Name", control: "text", wide: true },
        { key: "policyTypeCode", label: "Product", control: "select", options: ["PVTCAR", "TWOWHEELER"], optionLabels: { PVTCAR: "Private car", TWOWHEELER: "Two-wheeler" } },
        { key: "status", label: "Status", control: "select", options: ["D", "A", "R"], optionLabels: { D: "Draft", A: "Active", R: "Retired" } },
        { key: "startDate", label: "Start date", control: "date" },
        { key: "endDate", label: "End date", control: "date", help: "Leave empty for no end." },
        { key: "maxRisks", label: "Maximum vehicles per quote", control: "number" },
        { key: "notes", label: "Notes", control: "longtext" },
      ]}
      core={{
        name: manual.name,
        policyTypeCode: manual.policyTypeCode,
        status: manual.status,
        startDate: manual.startDate,
        endDate: manual.endDate,
        maxRisks: String(manual.maxRisks),
        notes: manual.notes,
      }}
      settingDefs={[]}
      props={{}}
    />
  );
}

export function ViewEditor({ manualId, view }: { manualId: number; view: BView }) {
  return (
    <EditorShell
      manualId={manualId}
      kind="view"
      id={view.id}
      title={`View: ${view.name}`}
      description={`View ID ${view.id}. A view is one flow through the manual's pages.`}
      coreDefs={[
        { key: "name", label: "Name", control: "text", wide: true },
        { key: "userClassList", label: "Who can use it", control: "select", options: USER_CLASSES, optionLabels: { ALL: "Everyone", agent: "Agents only", internal: "Company staff only" } },
        { key: "quoteCodeList", label: "Quote codes", control: "text", help: "A is new business." },
      ]}
      core={{ name: view.name, userClassList: view.userClassList, quoteCodeList: view.quoteCodeList }}
      settingDefs={VIEW_SETTINGS}
      props={view.props}
      removeLabel="Delete view"
      removeConfirm={`Delete the view "${view.name}"? Pages used only by this view are deleted with it.`}
    />
  );
}

export function PageEditor({ manualId, viewId, page }: { manualId: number; viewId: number; page: BPage }) {
  return (
    <EditorShell
      manualId={manualId}
      kind="page"
      id={page.linkId}
      title={`Page: ${page.name}`}
      description={`Page ID ${page.id}.`}
      notice={page.usedIn > 1 ? `This page is used in ${page.usedIn} views. Changes to its name, headings and settings apply in all of them.` : undefined}
      coreDefs={[
        { key: "name", label: "Name", control: "text" },
        { key: "buttonText", label: "Progress bar label", control: "text" },
        { key: "heading", label: "Heading", control: "text", wide: true },
        { key: "subHeading", label: "Sub-heading", control: "text", wide: true },
        { key: "milestone", label: "Show in the progress bar", control: "bool" },
        { key: "restrict", label: "Restrict to", control: "select", options: ["agent", "internal"], optionLabels: { agent: "Agents only", internal: "Company staff only" } },
        { key: "disableCode", label: "Skip this page when", control: "condition" },
      ]}
      core={{
        name: page.name,
        buttonText: page.buttonText,
        heading: page.heading,
        subHeading: page.subHeading,
        milestone: page.milestone ? "Y" : "N",
        restrict: page.restrict,
        disableCode: page.disableCode,
      }}
      settingDefs={PAGE_SETTINGS}
      props={page.props}
      movable
      previewHref={`/builder/${manualId}/preview/${page.id}?view=${viewId}`}
      removeLabel="Remove from view"
      removeConfirm={
        page.usedIn > 1
          ? `Remove "${page.name}" from this view? It stays in the other views that use it.`
          : `Remove "${page.name}"? It is not used in another view, so the page is deleted. Sections used only here are deleted too.`
      }
    />
  );
}

export function SectionEditor({ manualId, section }: { manualId: number; section: BSection }) {
  return (
    <EditorShell
      manualId={manualId}
      kind="section"
      id={section.linkId}
      title={`Section: ${section.name}`}
      description={`Section ID ${section.id}.`}
      notice={section.usedOn > 1 ? `This section is used on ${section.usedOn} pages. Changes to it and its questions apply on all of them.` : undefined}
      coreDefs={[
        { key: "name", label: "Name", control: "text" },
        { key: "area", label: "Column", control: "select", options: ["1", "2"], optionLabels: { "1": "Main column", "2": "Side column" }, help: "The side column needs the page layout set to two columns." },
        { key: "heading", label: "Heading", control: "text", wide: true },
        { key: "subHeading", label: "Sub-heading", control: "text", wide: true },
        { key: "restrict", label: "Restrict to", control: "select", options: ["agent", "internal"], optionLabels: { agent: "Agents only", internal: "Company staff only" } },
        { key: "disableCode", label: "Hide this section when", control: "condition" },
      ]}
      core={{
        name: section.name,
        area: String(section.area),
        heading: section.heading,
        subHeading: section.subHeading,
        restrict: section.restrict,
        disableCode: section.disableCode,
      }}
      settingDefs={SECTION_SETTINGS}
      props={section.props}
      movable
      removeLabel="Remove from page"
      removeConfirm={
        section.usedOn > 1
          ? `Remove "${section.name}" from this page? It stays on the other pages that use it.`
          : `Remove "${section.name}"? It is not used on another page, so the section and its questions are deleted.`
      }
    />
  );
}

export function QuestionEditor({ manualId, question }: { manualId: number; question: BQuestion }) {
  const widgets = listWidgets();
  return (
    <EditorShell
      manualId={manualId}
      kind="question"
      id={question.id}
      title={`Question: ${question.text || question.fieldName || question.type}`}
      description={`Question ID ${question.id}.`}
      coreDefs={[
        { key: "text", label: "Question text", control: "text", wide: true, help: "Use {{FieldName}} to show another answer." },
        {
          key: "type",
          label: "Type",
          control: "select",
          options: widgets.map((widget) => widget.code),
          optionLabels: Object.fromEntries(widgets.map((widget) => [widget.code, `${widget.label} (${widget.group})`])),
        },
        { key: "fieldName", label: "Field name", control: "text", help: "Where the answer is stored. Letters and digits only." },
        { key: "required", label: "Required", control: "bool" },
        { key: "riskSpecific", label: "Asked once per vehicle", control: "bool" },
        { key: "placeholder", label: "Placeholder", control: "text" },
        { key: "help", label: "Help text", control: "text" },
        { key: "min", label: "Minimum (numbers)", control: "number" },
        { key: "max", label: "Maximum (numbers)", control: "number" },
        { key: "leftCols", label: "Label width (0 to 12)", control: "number", help: "0 hides the label; 12 puts it above the answer." },
        { key: "rightCols", label: "Answer width (1 to 12)", control: "number" },
        { key: "disableCode", label: "Hide this question when", control: "condition" },
      ]}
      core={{
        text: question.text,
        type: getWidget(question.type)?.code ?? question.type,
        fieldName: question.fieldName,
        required: question.required ? "Y" : "N",
        riskSpecific: question.riskSpecific ? "Y" : "N",
        placeholder: question.placeholder,
        help: question.help,
        min: question.min,
        max: question.max,
        leftCols: String(question.leftCols),
        rightCols: String(question.rightCols),
        disableCode: question.disableCode,
      }}
      settingDefs={(core) => settingsForQuestion(core.type ?? "")}
      props={question.props}
      choices={question.choices}
      movable
      removeLabel="Delete"
      removeConfirm="Delete this question? Answers already stored in quotes are kept but no longer shown."
    />
  );
}

type AddFormProps = {
  manualId: number;
  kind: "view" | "page" | "section" | "question";
  parentId: number;
  parentLabel: string;
  existing?: Array<{ id: number; name: string }>;
};

export function AddForm({ manualId, kind, parentId, parentLabel, existing = [] }: AddFormProps) {
  const { pending, error, run } = useBuilderAction(manualId);
  const [name, setName] = useState("");
  const [existingId, setExistingId] = useState("");
  const [type, setType] = useState("Input");
  const [fieldName, setFieldName] = useState("");
  const widgets = listWidgets();
  const noun = kind === "question" ? "question" : kind;
  const needsField = Boolean(getWidget(type)?.entry);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Add {noun}</h2>
        <p className="text-sm text-muted-foreground">To {parentLabel}.</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>New {noun}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid max-w-xl gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => addNodeAction({ manualId, kind, parentId, name, type, fieldName }));
            }}
          >
            {kind === "question" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-type" className="text-sm font-medium">
                  Type
                </label>
                <FormSelect
                  id="add-type"
                  value={type}
                  onValueChange={setType}
                  options={widgets.map((widget) => ({ value: widget.code, label: `${widget.label} (${widget.group})` }))}
                />
              </div>
            ) : null}
            {kind === "question" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-field" className="text-sm font-medium">
                  Field name{needsField ? "" : " (optional)"}
                </label>
                <Input id="add-field" required={needsField} value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="RegistrationNumber" />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="add-name" className="text-sm font-medium">
                {kind === "question" ? "Question text" : "Name"}
              </label>
              <Input id="add-name" required={kind !== "question"} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" className="justify-self-start" disabled={pending}>
              {pending ? "Adding..." : `Add ${noun}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(kind === "page" || kind === "section") && existing.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Reuse an existing {noun}</CardTitle>
            <CardDescription>The same {noun} appears in both places, so editing it changes both.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex max-w-xl flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                run(() =>
                  addNodeAction({
                    manualId,
                    kind: kind === "page" ? "existingPage" : "existingSection",
                    parentId,
                    existingId: Number(existingId) || undefined,
                  }),
                );
              }}
            >
              <div className="flex min-w-60 flex-1 flex-col gap-1.5">
                <label htmlFor="add-existing" className="text-sm font-medium">
                  Existing {noun}
                </label>
                <FormSelect
                  id="add-existing"
                  required
                  placeholder="Select"
                  value={existingId}
                  onValueChange={setExistingId}
                  options={existing.map((item) => ({ value: String(item.id), label: `${item.name} (ID ${item.id})` }))}
                />
              </div>
              <Button type="submit" variant="outline" disabled={pending}>
                Add existing {noun}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
