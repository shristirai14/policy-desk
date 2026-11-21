import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Props, UAView } from "@/lib/ua/types";

function asProps(value: unknown): Props {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const props: Props = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) props[key] = String(item);
  }
  return props;
}

export const loadView = cache(async (viewId: number): Promise<UAView | null> => {
  const view = await prisma.manualView.findUnique({
    where: { id: viewId },
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
                      questions: {
                        orderBy: { questionOrder: "asc" },
                        include: { choices: { orderBy: { sortOrder: "asc" } } },
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
  if (!view) return null;

  return {
    id: view.id,
    manualId: view.manualId,
    name: view.name,
    props: asProps(view.properties),
    pages: view.viewPages.map((viewPage) => ({
      id: viewPage.page.id,
      name: viewPage.page.name,
      heading: viewPage.page.heading ?? "",
      subHeading: viewPage.page.subHeading ?? "",
      props: { ...asProps(viewPage.page.properties), ...asProps(viewPage.properties) },
      disableCode: viewPage.page.disableCode,
      restrict: viewPage.restrict,
      order: viewPage.pageOrder,
      milestone: viewPage.progressMilestone,
      buttonText: viewPage.buttonText || viewPage.page.name,
      sections: viewPage.page.pageSections.map((pageSection) => ({
        id: pageSection.section.id,
        name: pageSection.section.name,
        heading: pageSection.section.heading ?? "",
        subHeading: pageSection.section.subHeading ?? "",
        props: { ...asProps(pageSection.section.properties), ...asProps(pageSection.properties) },
        disableCode: pageSection.section.disableCode,
        restrict: pageSection.restrict,
        area: pageSection.areaNum,
        questions: pageSection.section.questions.map((question) => ({
          id: question.id,
          text: question.questionText ?? "",
          type: question.questionTypeCode,
          fieldName: question.fieldName ?? "",
          riskSpecific: question.riskSpecific,
          required: question.required,
          min: question.minValue === null ? null : Number(question.minValue),
          max: question.maxValue === null ? null : Number(question.maxValue),
          placeholder: question.placeholder ?? "",
          help: question.userHelp ?? "",
          disableCode: question.disableCode,
          leftCols: question.leftCols,
          rightCols: question.rightCols,
          props: asProps(question.properties),
          choices: question.choices.map((choice) => ({
            value: choice.choiceValue,
            text: choice.choiceText,
            isDefault: choice.isDefault,
            disableCode: choice.disableCode,
          })),
        })),
      })),
    })),
  };
});
