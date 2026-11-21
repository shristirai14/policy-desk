import type { BuilderData, Issue } from "@/lib/ua/builder-types";
import { fieldsInCondition } from "@/lib/ua/condition-text";
import { getWidget } from "@/lib/ua/widgets/registry";

const SYSTEM_FIELDS = new Set(
  ["usertype", "suffix", "QuoteNumber", "ManualID", "UWQuoteCode", "UWStatusCode", "AgentCode", "NumberOfRisks", "ValidRating", "TotalPremium"].map(
    (name) => name.toLowerCase(),
  ),
);

const CONDITION_KEYS = ["QuestionConditional", "RequiredCondition", "ReadOnlyCondition", "ChangePageConditionals", "ChangeViewConditionals"];

export function findIssues(data: BuilderData): Issue[] {
  const issues: Issue[] = [];
  const known = new Set(data.fieldNames.map((name) => name.toLowerCase()));
  const seenQuestions = new Set<number>();

  const checkConditions = (label: string, node: string, expressions: Array<string | undefined>) => {
    for (const expression of expressions) {
      for (const name of fieldsInCondition(expression)) {
        const lower = name.toLowerCase();
        if (!known.has(lower) && !SYSTEM_FIELDS.has(lower)) {
          issues.push({ severity: "warning", message: `${label} has a condition on "${name}", which no question collects.`, node });
        }
      }
    }
  };

  if (data.views.length === 0) issues.push({ severity: "error", message: "This manual has no view, so quotes cannot be created from it.", node: "manual" });

  for (const view of data.views) {
    if (view.pages.length === 0) issues.push({ severity: "error", message: `View "${view.name}" has no pages.`, node: `view:${view.id}` });
    const entryFields = new Map<string, string>();

    for (const page of view.pages) {
      const pageNode = `page:${page.linkId}`;
      if (page.sections.length === 0) issues.push({ severity: "warning", message: `Page "${page.name}" has no sections.`, node: pageNode });
      checkConditions(`Page "${page.name}"`, pageNode, [page.disableCode, ...CONDITION_KEYS.map((key) => page.props[key])]);

      for (const section of page.sections) {
        const sectionNode = `section:${section.linkId}`;
        if (section.questions.length === 0) {
          issues.push({ severity: "warning", message: `Section "${section.name}" on page "${page.name}" has no questions.`, node: sectionNode });
        }
        checkConditions(`Section "${section.name}"`, sectionNode, [section.disableCode, section.props.QuestionConditional]);

        for (const question of section.questions) {
          const node = `question:${question.id}`;
          const label = `Question "${question.text || question.fieldName || question.type}"`;
          const widget = getWidget(question.type);
          if (widget?.entry && question.fieldName) {
            const key = question.fieldName.toLowerCase();
            const first = entryFields.get(key);
            if (first && first !== page.name) {
              issues.push({
                severity: "warning",
                message: `Field "${question.fieldName}" is asked on both "${first}" and "${page.name}" in view "${view.name}".`,
                node,
              });
            } else {
              entryFields.set(key, page.name);
            }
          }
          if (seenQuestions.has(question.id)) continue;
          seenQuestions.add(question.id);

          if (!widget) issues.push({ severity: "error", message: `${label} uses the unknown type "${question.type}".`, node });
          if (widget?.entry && !question.fieldName) issues.push({ severity: "error", message: `${label} has no field name, so its answer is not saved.`, node });
          if (widget?.hasChoices && question.choices.length === 0) issues.push({ severity: "error", message: `${label} is a dropdown with no choices.`, node });
          if (widget?.code === "SetValue" && !question.fieldName) issues.push({ severity: "error", message: `${label} sets a value but names no field.`, node });
          checkConditions(label, node, [question.disableCode, ...CONDITION_KEYS.map((key) => question.props[key])]);
        }
      }
    }
  }
  return issues;
}
