import "server-only";
import { prisma } from "@/lib/prisma";
import type { BuilderData } from "@/lib/ua/builder-types";
import type { Props } from "@/lib/ua/types";

function asProps(value: unknown): Props {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const props: Props = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) props[key] = String(item);
  }
  return props;
}

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export async function loadBuilderManual(manualId: number): Promise<BuilderData | null> {
  const manual = await prisma.manual.findUnique({
    where: { id: manualId },
    include: {
      pages: { select: { id: true, name: true, _count: { select: { viewPages: true } } }, orderBy: { id: "asc" } },
      sections: { select: { id: true, name: true, _count: { select: { pageSections: true } } }, orderBy: { id: "asc" } },
      views: {
        orderBy: { id: "asc" },
        include: {
          viewPages: {
            orderBy: { pageOrder: "asc" },
            include: {
              page: {
                include: {
                  pageSections: {
                    orderBy: { sectionOrder: "asc" },
                    include: {
                      section: {
                        include: {
                          questions: { orderBy: { questionOrder: "asc" }, include: { choices: { orderBy: { sortOrder: "asc" } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!manual) return null;

  const pageUse = new Map(manual.pages.map((page) => [page.id, page._count.viewPages]));
  const sectionUse = new Map(manual.sections.map((section) => [section.id, section._count.pageSections]));
  const fieldNames = new Set<string>();

  const views = manual.views.map((view) => ({
    id: view.id,
    name: view.name,
    userClassList: view.userClassList,
    quoteCodeList: view.quoteCodeList,
    props: asProps(view.properties),
    pages: view.viewPages.map((viewPage) => ({
      linkId: viewPage.id,
      id: viewPage.page.id,
      name: viewPage.page.name,
      heading: viewPage.page.heading ?? "",
      subHeading: viewPage.page.subHeading ?? "",
      disableCode: viewPage.page.disableCode ?? "",
      props: asProps(viewPage.page.properties),
      buttonText: viewPage.buttonText ?? "",
      milestone: viewPage.progressMilestone,
      restrict: viewPage.restrict ?? "",
      usedIn: pageUse.get(viewPage.page.id) ?? 1,
      sections: viewPage.page.pageSections.map((pageSection) => ({
        linkId: pageSection.id,
        id: pageSection.section.id,
        name: pageSection.section.name,
        heading: pageSection.section.heading ?? "",
        subHeading: pageSection.section.subHeading ?? "",
        disableCode: pageSection.section.disableCode ?? "",
        props: asProps(pageSection.section.properties),
        area: pageSection.areaNum,
        restrict: pageSection.restrict ?? "",
        usedOn: sectionUse.get(pageSection.section.id) ?? 1,
        questions: pageSection.section.questions.map((question) => {
          if (question.fieldName) fieldNames.add(question.fieldName);
          return {
            id: question.id,
            text: question.questionText ?? "",
            type: question.questionTypeCode,
            fieldName: question.fieldName ?? "",
            required: question.required,
            riskSpecific: question.riskSpecific,
            min: question.minValue === null ? "" : question.minValue.toString(),
            max: question.maxValue === null ? "" : question.maxValue.toString(),
            placeholder: question.placeholder ?? "",
            help: question.userHelp ?? "",
            disableCode: question.disableCode ?? "",
            leftCols: question.leftCols,
            rightCols: question.rightCols,
            props: asProps(question.properties),
            choices: question.choices.map((choice) => ({
              value: choice.choiceValue,
              text: choice.choiceText,
              isDefault: choice.isDefault,
              disableCode: choice.disableCode ?? "",
            })),
          };
        }),
      })),
    })),
  }));

  return {
    manual: {
      id: manual.id,
      name: manual.name,
      policyTypeCode: manual.policyTypeCode,
      status: manual.status,
      startDate: isoDate(manual.startDate),
      endDate: isoDate(manual.endDate),
      maxRisks: manual.maxRisks,
      notes: manual.notes ?? "",
    },
    views,
    allPages: manual.pages.map((page) => ({ id: page.id, name: page.name })),
    allSections: manual.sections.map((section) => ({ id: section.id, name: section.name })),
    fieldNames: [...fieldNames].sort((a, b) => a.localeCompare(b)),
  };
}
