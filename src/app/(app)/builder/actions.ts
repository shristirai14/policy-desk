"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getWidget } from "@/lib/ua/widgets/registry";

export type BuilderResult = { ok: true; message: string; node?: string; manualId?: number } | { ok: false; message: string };

const stringMap = z.record(z.string(), z.string().max(4000));

const str = (value: string | undefined) => (value ?? "").trim();
const orNull = (value: string | undefined) => str(value) || null;
const yes = (value: string | undefined) => ["y", "yes", "true"].includes(str(value).toLowerCase());

function numberOrNull(value: string | undefined) {
  const text = str(value);
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOr(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Math.round(Number(str(value)));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function cleanProps(props: Record<string, string>) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (str(value) !== "") cleaned[key] = str(value);
  }
  return cleaned;
}

function dateOrNull(value: string | undefined) {
  const text = str(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function cleanupOrphans(manualId: number) {
  await prisma.manualPage.deleteMany({ where: { manualId, viewPages: { none: {} } } });
  await prisma.manualSection.deleteMany({ where: { manualId, pageSections: { none: {} } } });
}

function done(manualId: number, message: string, node?: string): BuilderResult {
  revalidatePath(`/builder/${manualId}`);
  revalidatePath("/builder");
  return { ok: true, message, node };
}

const createManualSchema = z.object({
  name: z.string().trim().min(3, "Give the manual a name of at least 3 characters.").max(80),
  policyTypeCode: z.enum(["PVTCAR", "TWOWHEELER"]),
  viewName: z.string().trim().min(1).max(50),
  pageNames: z.array(z.string().trim().min(1).max(50)).min(1, "Add at least one page.").max(12),
});

export async function createManualAction(input: z.input<typeof createManualSchema>): Promise<BuilderResult> {
  await requireRole("admin");
  const parsed = createManualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, policyTypeCode, viewName, pageNames } = parsed.data;
  if (await prisma.manual.findFirst({ where: { name } })) return { ok: false, message: "A manual with this name already exists." };

  const manual = await prisma.manual.create({
    data: {
      name,
      policyTypeCode,
      startDate: new Date(),
      status: "D",
      views: {
        create: { name: viewName, properties: { NextButtonText: "Save and next", PreviousButtonText: "Previous" } },
      },
    },
    include: { views: true },
  });
  let order = 0;
  for (const pageName of pageNames) {
    order += 10;
    const page = await prisma.manualPage.create({ data: { manualId: manual.id, name: pageName, heading: pageName } });
    await prisma.manualViewPage.create({ data: { viewId: manual.views[0].id, pageId: page.id, pageOrder: order, buttonText: pageName } });
    const section = await prisma.manualSection.create({ data: { manualId: manual.id, name: `${pageName} details`, heading: pageName } });
    await prisma.manualPageSection.create({ data: { pageId: page.id, sectionId: section.id, sectionOrder: 10 } });
  }
  revalidatePath("/builder");
  return { ok: true, message: "Manual created as a draft.", manualId: manual.id };
}

export async function copyManualAction(manualId: number): Promise<BuilderResult> {
  await requireRole("admin");
  const source = await prisma.manual.findUnique({
    where: { id: manualId },
    include: {
      views: { include: { viewPages: true } },
      pages: { include: { pageSections: true } },
      sections: { include: { questions: { include: { choices: true } } } },
      rateSteps: true,
      rateFactors: true,
      rateBands: true,
    },
  });
  if (!source) return { ok: false, message: "Manual not found." };

  let name = `${source.name} (copy)`;
  for (let attempt = 2; await prisma.manual.findFirst({ where: { name } }); attempt += 1) name = `${source.name} (copy ${attempt})`;

  const copyId = await prisma.$transaction(async (tx) => {
    const copy = await tx.manual.create({
      data: {
        name,
        policyTypeCode: source.policyTypeCode,
        startDate: source.startDate,
        endDate: source.endDate,
        status: "D",
        maxRisks: source.maxRisks,
        sourceManualId: source.id,
        notes: source.notes,
      },
    });
    const sectionMap = new Map<number, number>();
    for (const section of source.sections) {
      const created = await tx.manualSection.create({
        data: {
          manualId: copy.id,
          name: section.name,
          heading: section.heading,
          subHeading: section.subHeading,
          properties: section.properties ?? {},
          disableCode: section.disableCode,
          notes: section.notes,
        },
      });
      sectionMap.set(section.id, created.id);
      for (const question of section.questions) {
        const { id: _id, sectionId: _sectionId, choices, properties, ...rest } = question;
        void _id;
        void _sectionId;
        await tx.manualQuestion.create({
          data: {
            ...rest,
            properties: properties ?? {},
            sectionId: created.id,
            choices: {
              create: choices.map((choice) => ({
                choiceValue: choice.choiceValue,
                choiceText: choice.choiceText,
                isDefault: choice.isDefault,
                sortOrder: choice.sortOrder,
                disableCode: choice.disableCode,
              })),
            },
          },
        });
      }
    }
    const pageMap = new Map<number, number>();
    for (const page of source.pages) {
      const created = await tx.manualPage.create({
        data: {
          manualId: copy.id,
          name: page.name,
          heading: page.heading,
          subHeading: page.subHeading,
          properties: page.properties ?? {},
          disableCode: page.disableCode,
          notes: page.notes,
        },
      });
      pageMap.set(page.id, created.id);
      for (const link of page.pageSections) {
        const sectionId = sectionMap.get(link.sectionId);
        if (!sectionId) continue;
        await tx.manualPageSection.create({
          data: {
            pageId: created.id,
            sectionId,
            sectionOrder: link.sectionOrder,
            areaNum: link.areaNum,
            properties: link.properties ?? {},
            restrict: link.restrict,
          },
        });
      }
    }
    for (const view of source.views) {
      const created = await tx.manualView.create({
        data: {
          manualId: copy.id,
          name: view.name,
          userClassList: view.userClassList,
          quoteCodeList: view.quoteCodeList,
          properties: view.properties ?? {},
          navigation: view.navigation ?? {},
          notes: view.notes,
        },
      });
      for (const link of view.viewPages) {
        const pageId = pageMap.get(link.pageId);
        if (!pageId) continue;
        await tx.manualViewPage.create({
          data: {
            viewId: created.id,
            pageId,
            pageOrder: link.pageOrder,
            progressMilestone: link.progressMilestone,
            buttonText: link.buttonText,
            properties: link.properties ?? {},
            restrict: link.restrict,
          },
        });
      }
    }
    if (source.rateSteps.length > 0) {
      await tx.rateStep.createMany({ data: source.rateSteps.map(({ id: _id, ...step }) => (void _id, { ...step, manualId: copy.id })) });
    }
    if (source.rateFactors.length > 0) {
      await tx.rateFactor.createMany({ data: source.rateFactors.map(({ id: _id, ...row }) => (void _id, { ...row, manualId: copy.id })) });
    }
    if (source.rateBands.length > 0) {
      await tx.rateBand.createMany({ data: source.rateBands.map(({ id: _id, ...row }) => (void _id, { ...row, manualId: copy.id })) });
    }
    return copy.id;
  });

  revalidatePath("/builder");
  return { ok: true, message: `Copied as "${name}". Page and view IDs used in page settings were not remapped.`, manualId: copyId };
}

export async function deleteManualAction(manualId: number): Promise<BuilderResult> {
  await requireRole("admin");
  const quotes = await prisma.quote.count({ where: { manualId } });
  if (quotes > 0) return { ok: false, message: `This manual has ${quotes} quote(s) and cannot be deleted. Set its status to Retired instead.` };
  await prisma.manual.delete({ where: { id: manualId } });
  revalidatePath("/builder");
  return { ok: true, message: "Manual deleted." };
}

const saveSchema = z.object({
  manualId: z.number().int().positive(),
  kind: z.enum(["manual", "view", "page", "section", "question"]),
  id: z.number().int().positive(),
  core: stringMap,
  props: stringMap,
  choices: z
    .array(z.object({ value: z.string().trim().max(50), text: z.string().trim().max(255), isDefault: z.boolean(), disableCode: z.string().max(255) }))
    .max(300)
    .optional(),
});

export async function saveNodeAction(input: z.input<typeof saveSchema>): Promise<BuilderResult> {
  await requireRole("admin");
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some values are too long or not valid." };
  const { manualId, kind, id, core, choices } = parsed.data;
  const props = cleanProps(parsed.data.props);

  if (kind !== "question" && str(core.name) === "") return { ok: false, message: "A name is required." };

  switch (kind) {
    case "manual": {
      const startDate = dateOrNull(core.startDate);
      if (!startDate) return { ok: false, message: "A valid start date is required." };
      const endDate = dateOrNull(core.endDate);
      if (endDate && endDate <= startDate) return { ok: false, message: "The end date must be after the start date." };
      await prisma.manual.update({
        where: { id: manualId },
        data: {
          name: str(core.name),
          policyTypeCode: str(core.policyTypeCode) || "PVTCAR",
          status: ["A", "D", "R"].includes(str(core.status)) ? str(core.status) : "D",
          startDate,
          endDate,
          maxRisks: intOr(core.maxRisks, 5, 1, 20),
          notes: orNull(core.notes),
        },
      });
      break;
    }
    case "view":
      await prisma.manualView.update({
        where: { id },
        data: {
          name: str(core.name),
          userClassList: str(core.userClassList) || "ALL",
          quoteCodeList: str(core.quoteCodeList) || "A",
          properties: props,
        },
      });
      break;
    case "page": {
      const link = await prisma.manualViewPage.findUnique({ where: { id } });
      if (!link) return { ok: false, message: "This page is no longer in the view." };
      await prisma.manualPage.update({
        where: { id: link.pageId },
        data: {
          name: str(core.name),
          heading: orNull(core.heading),
          subHeading: orNull(core.subHeading),
          disableCode: orNull(core.disableCode),
          properties: props,
        },
      });
      await prisma.manualViewPage.update({
        where: { id },
        data: { buttonText: orNull(core.buttonText), progressMilestone: yes(core.milestone), restrict: orNull(core.restrict) },
      });
      break;
    }
    case "section": {
      const link = await prisma.manualPageSection.findUnique({ where: { id } });
      if (!link) return { ok: false, message: "This section is no longer on the page." };
      await prisma.manualSection.update({
        where: { id: link.sectionId },
        data: {
          name: str(core.name),
          heading: orNull(core.heading),
          subHeading: orNull(core.subHeading),
          disableCode: orNull(core.disableCode),
          properties: props,
        },
      });
      await prisma.manualPageSection.update({ where: { id }, data: { areaNum: intOr(core.area, 1, 1, 2), restrict: orNull(core.restrict) } });
      break;
    }
    case "question": {
      const widget = getWidget(str(core.type));
      if (!widget) return { ok: false, message: "Choose a question type." };
      const fieldName = str(core.fieldName);
      if (fieldName && !/^[A-Za-z][A-Za-z0-9]*$/.test(fieldName)) {
        return { ok: false, message: "Field names start with a letter and use only letters and digits." };
      }
      if (widget.entry && !fieldName) return { ok: false, message: "This question type needs a field name to store its answer." };
      const cleanedChoices = (choices ?? []).filter((choice) => choice.value !== "" || choice.text !== "");
      const values = cleanedChoices.map((choice) => choice.value);
      if (new Set(values).size !== values.length) return { ok: false, message: "Each choice needs a different value." };
      await prisma.$transaction([
        prisma.manualQuestion.update({
          where: { id },
          data: {
            questionText: orNull(core.text),
            questionTypeCode: widget.code,
            fieldName: fieldName || null,
            required: yes(core.required),
            riskSpecific: yes(core.riskSpecific),
            minValue: numberOrNull(core.min),
            maxValue: numberOrNull(core.max),
            placeholder: orNull(core.placeholder),
            userHelp: orNull(core.help),
            disableCode: orNull(core.disableCode),
            leftCols: intOr(core.leftCols, 4, 0, 12),
            rightCols: intOr(core.rightCols, 8, 1, 12),
            properties: props,
          },
        }),
        prisma.manualChoice.deleteMany({ where: { questionId: id } }),
        prisma.manualChoice.createMany({
          data: (widget.hasChoices ? cleanedChoices : []).map((choice, index) => ({
            questionId: id,
            choiceValue: choice.value,
            choiceText: choice.text || choice.value,
            isDefault: choice.isDefault,
            sortOrder: index,
            disableCode: orNull(choice.disableCode),
          })),
        }),
      ]);
      break;
    }
  }
  return done(manualId, "Saved.");
}

const addSchema = z.object({
  manualId: z.number().int().positive(),
  kind: z.enum(["view", "page", "existingPage", "section", "existingSection", "question"]),
  parentId: z.number().int().positive(),
  name: z.string().trim().max(255).optional(),
  existingId: z.number().int().positive().optional(),
  type: z.string().max(30).optional(),
  fieldName: z.string().trim().max(50).optional(),
});

async function nextOrder(values: Array<number | null>) {
  return values.reduce<number>((max, value) => Math.max(max, value ?? 0), 0) + 10;
}

export async function addNodeAction(input: z.input<typeof addSchema>): Promise<BuilderResult> {
  await requireRole("admin");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Those details are not valid." };
  const { manualId, kind, parentId, existingId } = parsed.data;
  const name = str(parsed.data.name);
  const needsName = kind === "view" || kind === "page" || kind === "section";
  if (needsName && !name) return { ok: false, message: "Enter a name." };

  switch (kind) {
    case "view": {
      const view = await prisma.manualView.create({
        data: { manualId, name, properties: { NextButtonText: "Save and next", PreviousButtonText: "Previous" } },
      });
      return done(manualId, "View added.", `view:${view.id}`);
    }
    case "page":
    case "existingPage": {
      const siblings = await prisma.manualViewPage.findMany({ where: { viewId: parentId }, select: { pageOrder: true, pageId: true } });
      let pageId = existingId;
      if (kind === "existingPage") {
        const existing = pageId ? await prisma.manualPage.findFirst({ where: { id: pageId, manualId } }) : null;
        if (!existing) return { ok: false, message: "Choose a page to add." };
        if (siblings.some((sibling) => sibling.pageId === existing.id)) return { ok: false, message: "That page is already in this view." };
      } else {
        const page = await prisma.manualPage.create({ data: { manualId, name, heading: name } });
        pageId = page.id;
      }
      const link = await prisma.manualViewPage.create({
        data: {
          viewId: parentId,
          pageId: pageId!,
          pageOrder: await nextOrder(siblings.map((sibling) => sibling.pageOrder)),
          buttonText: kind === "page" ? name : null,
        },
      });
      return done(manualId, "Page added.", `page:${link.id}`);
    }
    case "section":
    case "existingSection": {
      const parent = await prisma.manualViewPage.findUnique({ where: { id: parentId } });
      if (!parent) return { ok: false, message: "The page was not found." };
      const siblings = await prisma.manualPageSection.findMany({ where: { pageId: parent.pageId }, select: { sectionOrder: true, sectionId: true } });
      let sectionId = existingId;
      if (kind === "existingSection") {
        const existing = sectionId ? await prisma.manualSection.findFirst({ where: { id: sectionId, manualId } }) : null;
        if (!existing) return { ok: false, message: "Choose a section to add." };
        if (siblings.some((sibling) => sibling.sectionId === existing.id)) return { ok: false, message: "That section is already on this page." };
      } else {
        const section = await prisma.manualSection.create({ data: { manualId, name, heading: name } });
        sectionId = section.id;
      }
      const link = await prisma.manualPageSection.create({
        data: { pageId: parent.pageId, sectionId: sectionId!, sectionOrder: await nextOrder(siblings.map((sibling) => sibling.sectionOrder)) },
      });
      return done(manualId, "Section added.", `section:${link.id}`);
    }
    case "question": {
      const parent = await prisma.manualPageSection.findUnique({ where: { id: parentId } });
      if (!parent) return { ok: false, message: "The section was not found." };
      const widget = getWidget(str(parsed.data.type));
      if (!widget) return { ok: false, message: "Choose a question type." };
      const fieldName = str(parsed.data.fieldName);
      if (fieldName && !/^[A-Za-z][A-Za-z0-9]*$/.test(fieldName)) {
        return { ok: false, message: "Field names start with a letter and use only letters and digits." };
      }
      if (widget.entry && !fieldName) return { ok: false, message: "This question type needs a field name to store its answer." };
      const siblings = await prisma.manualQuestion.findMany({ where: { sectionId: parent.sectionId }, select: { questionOrder: true } });
      const question = await prisma.manualQuestion.create({
        data: {
          sectionId: parent.sectionId,
          questionOrder: await nextOrder(siblings.map((sibling) => sibling.questionOrder)),
          questionText: name || null,
          questionTypeCode: widget.code,
          fieldName: fieldName || null,
        },
      });
      return done(manualId, "Question added.", `question:${question.id}`);
    }
  }
}

const nodeSchema = z.object({
  manualId: z.number().int().positive(),
  kind: z.enum(["view", "page", "section", "question"]),
  id: z.number().int().positive(),
});

export async function removeNodeAction(input: z.input<typeof nodeSchema>): Promise<BuilderResult> {
  await requireRole("admin");
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That item is not valid." };
  const { manualId, kind, id } = parsed.data;

  if (kind === "view") {
    const quotes = await prisma.quote.count({ where: { viewId: id } });
    if (quotes > 0) return { ok: false, message: `${quotes} quote(s) use this view, so it cannot be deleted.` };
    await prisma.manualView.delete({ where: { id } });
  } else if (kind === "page") {
    await prisma.manualViewPage.delete({ where: { id } });
  } else if (kind === "section") {
    await prisma.manualPageSection.delete({ where: { id } });
  } else {
    await prisma.manualQuestion.delete({ where: { id } });
  }
  await cleanupOrphans(manualId);
  return done(manualId, "Removed.", "manual");
}

export async function moveNodeAction(input: z.input<typeof nodeSchema> & { direction: "up" | "down" }): Promise<BuilderResult> {
  await requireRole("admin");
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success || parsed.data.kind === "view") return { ok: false, message: "That item cannot be moved." };
  const { manualId, kind, id } = parsed.data;
  const step = input.direction === "up" ? -1 : 1;

  const reorder = async (ids: number[], write: (itemId: number, order: number) => Promise<unknown>) => {
    const index = ids.indexOf(id);
    const target = index + step;
    if (index === -1 || target < 0 || target >= ids.length) return false;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await Promise.all(ids.map((itemId, position) => write(itemId, (position + 1) * 10)));
    return true;
  };

  let moved = false;
  if (kind === "page") {
    const link = await prisma.manualViewPage.findUnique({ where: { id } });
    if (link) {
      const siblings = await prisma.manualViewPage.findMany({ where: { viewId: link.viewId }, orderBy: { pageOrder: "asc" }, select: { id: true } });
      moved = await reorder(siblings.map((sibling) => sibling.id), (itemId, pageOrder) => prisma.manualViewPage.update({ where: { id: itemId }, data: { pageOrder } }));
    }
  } else if (kind === "section") {
    const link = await prisma.manualPageSection.findUnique({ where: { id } });
    if (link) {
      const siblings = await prisma.manualPageSection.findMany({ where: { pageId: link.pageId }, orderBy: { sectionOrder: "asc" }, select: { id: true } });
      moved = await reorder(siblings.map((sibling) => sibling.id), (itemId, sectionOrder) => prisma.manualPageSection.update({ where: { id: itemId }, data: { sectionOrder } }));
    }
  } else {
    const question = await prisma.manualQuestion.findUnique({ where: { id } });
    if (question) {
      const siblings = await prisma.manualQuestion.findMany({ where: { sectionId: question.sectionId }, orderBy: { questionOrder: "asc" }, select: { id: true } });
      moved = await reorder(siblings.map((sibling) => sibling.id), (itemId, questionOrder) => prisma.manualQuestion.update({ where: { id: itemId }, data: { questionOrder } }));
    }
  }
  if (!moved) return { ok: false, message: input.direction === "up" ? "Already first." : "Already last." };
  return done(manualId, "Moved.");
}

export async function copyQuestionAction(input: { manualId: number; id: number }): Promise<BuilderResult> {
  await requireRole("admin");
  const source = await prisma.manualQuestion.findUnique({ where: { id: input.id }, include: { choices: true } });
  if (!source) return { ok: false, message: "Question not found." };
  const { id: _id, choices, properties, ...rest } = source;
  void _id;
  const baseName = source.fieldName ? `${source.fieldName}Copy` : null;
  const copy = await prisma.manualQuestion.create({
    data: {
      ...rest,
      properties: properties ?? {},
      questionOrder: source.questionOrder + 5,
      questionText: source.questionText ? `${source.questionText} (copy)` : null,
      fieldName: baseName,
      choices: {
        create: choices.map((choice) => ({
          choiceValue: choice.choiceValue,
          choiceText: choice.choiceText,
          isDefault: choice.isDefault,
          sortOrder: choice.sortOrder,
          disableCode: choice.disableCode,
        })),
      },
    },
  });
  return done(input.manualId, "Question copied. Give the copy its own field name.", `question:${copy.id}`);
}
