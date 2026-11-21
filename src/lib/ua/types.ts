export type Props = Record<string, string>;

export type Packet = Record<string, string>;

export type UAChoice = { value: string; text: string; isDefault: boolean; disableCode: string | null };

export type UAQuestion = {
  id: number;
  text: string;
  type: string;
  fieldName: string;
  riskSpecific: boolean;
  required: boolean;
  min: number | null;
  max: number | null;
  placeholder: string;
  help: string;
  disableCode: string | null;
  leftCols: number;
  rightCols: number;
  props: Props;
  choices: UAChoice[];
};

export type UASection = {
  id: number;
  name: string;
  heading: string;
  subHeading: string;
  props: Props;
  disableCode: string | null;
  restrict: string | null;
  area: number;
  questions: UAQuestion[];
};

export type UAPage = {
  id: number;
  name: string;
  heading: string;
  subHeading: string;
  props: Props;
  disableCode: string | null;
  restrict: string | null;
  order: number;
  milestone: boolean;
  buttonText: string;
  sections: UASection[];
};

export type UAView = {
  id: number;
  manualId: number;
  name: string;
  props: Props;
  pages: UAPage[];
};

export type Navigation = "next" | "prev" | "stay";

export type SubmitResult =
  | { ok: true; redirectTo: string; packet: Packet }
  | { ok: false; message: string; errors: Record<string, string> };
