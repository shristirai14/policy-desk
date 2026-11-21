import { ArrowLeft, CircleAlert, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddForm, FieldNameList, ManualEditor, PageEditor, QuestionEditor, SectionEditor, ViewEditor } from "@/components/builder/editors";
import { BuilderTree } from "@/components/builder/tree";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/session";
import { loadBuilderManual } from "@/lib/ua/builder";
import type { BuilderData } from "@/lib/ua/builder-types";
import { findIssues } from "@/lib/ua/issues";

export const metadata: Metadata = { title: "UA Builder" };
export const instant = false;

function findNode(data: BuilderData, kind: string, id: number) {
  for (const view of data.views) {
    if (kind === "view" && view.id === id) return { view };
    for (const page of view.pages) {
      if (kind === "page" && page.linkId === id) return { view, page };
      for (const section of page.sections) {
        if (kind === "section" && section.linkId === id) return { view, page, section };
        for (const question of section.questions) {
          if (kind === "question" && question.id === id) return { view, page, section, question };
        }
      }
    }
  }
  return null;
}

export default async function BuilderWorkspacePage({ params, searchParams }: PageProps<"/builder/[manualId]">) {
  await requireRole("admin");
  const { manualId } = await params;
  const query = await searchParams;
  const data = await loadBuilderManual(Number(manualId));
  if (!data) notFound();

  const requested = typeof query.node === "string" ? query.node : "manual";
  const add = typeof query.add === "string" ? query.add : "";
  const [kind, rawId] = requested.split(":");
  const found = kind === "manual" ? null : findNode(data, kind, Number(rawId));
  const selected = found ? requested : "manual";
  const issues = findIssues(data);
  const id = data.manual.id;

  let panel: React.ReactNode;
  if (!found) {
    panel =
      add === "view" ? (
        <AddForm key="add-view" manualId={id} kind="view" parentId={id} parentLabel={`manual "${data.manual.name}"`} />
      ) : (
        <div className="flex flex-col gap-4">
          <ManualEditor key="manual" manual={data.manual} />
          <Card>
            <CardHeader>
              <CardTitle>Possible issues</CardTitle>
              <CardDescription>
                {issues.length === 0 ? "No problems found in this manual." : `${issues.length} thing(s) to look at before agents use this manual.`}
              </CardDescription>
            </CardHeader>
            {issues.length > 0 ? (
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {issues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {issue.severity === "error" ? (
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : (
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      {issue.node ? (
                        <Link href={`/builder/${id}?node=${issue.node}`} className="underline-offset-4 hover:underline">
                          {issue.message}
                        </Link>
                      ) : (
                        issue.message
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        </div>
      );
  } else if (found.question) {
    panel = <QuestionEditor key={selected} manualId={id} question={found.question} />;
  } else if (found.section) {
    panel =
      add === "question" ? (
        <AddForm key={`${selected}-add`} manualId={id} kind="question" parentId={found.section.linkId} parentLabel={`section "${found.section.name}"`} />
      ) : (
        <SectionEditor key={selected} manualId={id} section={found.section} />
      );
  } else if (found.page) {
    const onPage = new Set(found.page.sections.map((section) => section.id));
    panel =
      add === "section" ? (
        <AddForm
          key={`${selected}-add`}
          manualId={id}
          kind="section"
          parentId={found.page.linkId}
          parentLabel={`page "${found.page.name}"`}
          existing={data.allSections.filter((section) => !onPage.has(section.id))}
        />
      ) : (
        <PageEditor key={selected} manualId={id} viewId={found.view.id} page={found.page} />
      );
  } else {
    const inView = new Set(found.view.pages.map((page) => page.id));
    panel =
      add === "page" ? (
        <AddForm
          key={`${selected}-add`}
          manualId={id}
          kind="page"
          parentId={found.view.id}
          parentLabel={`view "${found.view.name}"`}
          existing={data.allPages.filter((page) => !inView.has(page.id))}
        />
      ) : (
        <ViewEditor key={selected} manualId={id} view={found.view} />
      );
  }

  return (
    <>
      <div>
        <Link href="/builder" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="size-3.5" />
          All manuals
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{data.manual.name}</h1>
      </div>
      <FieldNameList names={data.fieldNames} />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-start">
        <aside className="rounded-lg border p-3 lg:sticky lg:top-4 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto">
          <BuilderTree data={data} selected={selected} add={add} />
        </aside>
        <div className="min-w-0">{panel}</div>
      </div>
    </>
  );
}
