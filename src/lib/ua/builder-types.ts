import type { Props } from "@/lib/ua/types";

export type BChoice = { value: string; text: string; isDefault: boolean; disableCode: string };

export type BQuestion = {
  id: number;
  text: string;
  type: string;
  fieldName: string;
  required: boolean;
  riskSpecific: boolean;
  min: string;
  max: string;
  placeholder: string;
  help: string;
  disableCode: string;
  leftCols: number;
  rightCols: number;
  props: Props;
  choices: BChoice[];
};

export type BSection = {
  linkId: number;
  id: number;
  name: string;
  heading: string;
  subHeading: string;
  disableCode: string;
  props: Props;
  area: number;
  restrict: string;
  usedOn: number;
  questions: BQuestion[];
};

export type BPage = {
  linkId: number;
  id: number;
  name: string;
  heading: string;
  subHeading: string;
  disableCode: string;
  props: Props;
  buttonText: string;
  milestone: boolean;
  restrict: string;
  usedIn: number;
  sections: BSection[];
};

export type BView = {
  id: number;
  name: string;
  userClassList: string;
  quoteCodeList: string;
  props: Props;
  pages: BPage[];
};

export type BManual = {
  id: number;
  name: string;
  policyTypeCode: string;
  status: string;
  startDate: string;
  endDate: string;
  maxRisks: number;
  notes: string;
};

export type BuilderData = {
  manual: BManual;
  views: BView[];
  allPages: Array<{ id: number; name: string }>;
  allSections: Array<{ id: number; name: string }>;
  fieldNames: string[];
};

export type NodeKind = "manual" | "view" | "page" | "section" | "question";

export type Issue = { severity: "error" | "warning"; message: string; node?: string };
