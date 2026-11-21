export type SettingControl = "text" | "number" | "yesno" | "bool" | "date" | "select" | "condition" | "actions" | "longtext";

export type SettingDef = {
  key: string;
  label: string;
  control: SettingControl;
  options?: string[];
  optionLabels?: Record<string, string>;
  help?: string;
  wide?: boolean;
};

export type WidgetGroup = "Entry" | "Display" | "Behaviour" | "Compound";

export type WidgetDef = {
  code: string;
  label: string;
  group: WidgetGroup;
  entry: boolean;
  hasChoices?: boolean;
  settings: SettingDef[];
};

export const COMMON_SETTINGS: SettingDef[] = [
  { key: "QuestionConditional", label: "Show when", control: "condition", help: "Leave empty to always show." },
  { key: "LeftClass", label: "Label CSS classes", control: "text" },
  { key: "RightClass", label: "Value CSS classes", control: "text" },
];

export const ENTRY_SETTINGS: SettingDef[] = [
  { key: "DefaultValue", label: "Default value", control: "text", help: "TODAY gives the current date." },
  { key: "RequiredCondition", label: "Required when", control: "condition" },
  { key: "ReadOnly", label: "Read only", control: "yesno" },
  { key: "ReadOnlyCondition", label: "Read only when", control: "condition" },
];

const WIDGETS: WidgetDef[] = [
  {
    code: "Input",
    label: "Text input",
    group: "Entry",
    entry: true,
    settings: [
      { key: "MaxLength", label: "Maximum length", control: "number" },
      { key: "Uppercase", label: "Force upper case", control: "yesno" },
      { key: "Pattern", label: "Must match (regular expression)", control: "text" },
      { key: "PatternMessage", label: "Message when it does not match", control: "text" },
    ],
  },
  {
    code: "Number",
    label: "Number",
    group: "Entry",
    entry: true,
    settings: [
      { key: "Decimals", label: "Decimal places", control: "number" },
      { key: "Prefix", label: "Prefix", control: "text", help: "For example a currency symbol." },
    ],
  },
  { code: "Select", label: "Dropdown", group: "Entry", entry: true, hasChoices: true, settings: [] },
  {
    code: "YesNo",
    label: "Yes / No",
    group: "Entry",
    entry: true,
    settings: [
      { key: "YesText", label: "Text for Yes", control: "text" },
      { key: "NoText", label: "Text for No", control: "text" },
    ],
  },
  {
    code: "Date",
    label: "Date",
    group: "Entry",
    entry: true,
    settings: [
      { key: "MinDate", label: "Earliest date", control: "text", help: "A date, TODAY, or a field name." },
      { key: "MaxDate", label: "Latest date", control: "text", help: "A date, TODAY, or a field name." },
    ],
  },
  {
    code: "Checkbox",
    label: "Checkbox",
    group: "Entry",
    entry: true,
    settings: [
      { key: "CheckedValue", label: "Value when ticked", control: "text" },
      { key: "MustBeChecked", label: "Must be ticked to continue", control: "yesno" },
    ],
  },
  { code: "Phone", label: "Mobile number", group: "Entry", entry: true, settings: [] },
  { code: "EmailWidget", label: "Email address", group: "Entry", entry: true, settings: [] },
  {
    code: "Text",
    label: "Display text",
    group: "Display",
    entry: false,
    settings: [{ key: "Format", label: "Format", control: "select", options: ["Plain", "Date", "Currency", "Choice"] }],
  },
  {
    code: "Heading",
    label: "Heading",
    group: "Display",
    entry: false,
    settings: [{ key: "Level", label: "Size", control: "select", options: ["Large", "Small"] }],
  },
  {
    code: "VehicleWidget",
    label: "Vehicle make, model and variant",
    group: "Compound",
    entry: true,
    settings: [],
  },
  {
    code: "DetailSelection",
    label: "Vehicle list (add, edit, delete)",
    group: "Compound",
    entry: false,
    settings: [
      { key: "ItemLabel", label: "What one item is called", control: "text", help: "For example Vehicle." },
      { key: "SummaryFields", label: "Fields shown for each item", control: "text", help: "Field names separated by commas.", wide: true },
      { key: "MinItems", label: "Minimum number of items", control: "number" },
    ],
  },
  {
    code: "PaymentWidget",
    label: "Payment (demonstration)",
    group: "Compound",
    entry: true,
    settings: [],
  },
  {
    code: "eSignStatus",
    label: "E-sign start and status",
    group: "Compound",
    entry: false,
    settings: [],
  },
  {
    code: "RatingTotals",
    label: "Premium breakup",
    group: "Compound",
    entry: false,
    settings: [{ key: "ShowFlowLink", label: "Show the rating trace link to administrators", control: "yesno" }],
  },
  { code: "hidden", label: "Hidden field", group: "Behaviour", entry: false, settings: [] },
  {
    code: "SetValue",
    label: "Set a value",
    group: "Behaviour",
    entry: false,
    settings: [{ key: "Value", label: "Value to store", control: "text", help: "Use {{Field}} to copy another field." }],
  },
  {
    code: "ButtonWidget",
    label: "Button",
    group: "Behaviour",
    entry: false,
    settings: [
      { key: "ButtonText", label: "Button text", control: "text" },
      { key: "Actions", label: "Actions to run", control: "actions" },
      { key: "Navigate", label: "After running", control: "select", options: ["stay", "next", "prev"] },
      { key: "Variant", label: "Style", control: "select", options: ["default", "outline", "destructive"] },
      { key: "Confirm", label: "Ask for confirmation with this text", control: "text" },
    ],
  },
];

const ALIASES: Record<string, string> = {
  "y/n": "yesno",
  "n/y": "yesno",
  email: "emailwidget",
  button: "buttonwidget",
  none: "hidden",
};

const BY_CODE = new Map(WIDGETS.map((widget) => [widget.code.toLowerCase(), widget]));

export function normalizeType(code: string) {
  const lower = code.trim().toLowerCase();
  return ALIASES[lower] ?? lower;
}

export function getWidget(code: string) {
  return BY_CODE.get(normalizeType(code));
}

export function isEntryType(code: string) {
  return getWidget(code)?.entry ?? false;
}

export function listWidgets() {
  return WIDGETS;
}

export const RISK_COUNT_FIELD = "NumberOfRisks";

export const ACTION_CATALOG = ["RATE", "PAY", "ESIGN", "RESETESIGN", "RESENDESIGN", "BIND", "EXIT", "EXITANDDELETE", "ChangePage", "ChangeView"];

export const VIEW_SETTINGS: SettingDef[] = [
  { key: "NextButtonText", label: "Next button text", control: "text" },
  { key: "PreviousButtonText", label: "Previous button text", control: "text" },
];

export const PAGE_SETTINGS: SettingDef[] = [
  { key: "DefaultLayout", label: "Layout", control: "select", options: ["OneArea", "TwoArea"], optionLabels: { OneArea: "One column", TwoArea: "Main column and side column" } },
  { key: "NextButtonText", label: "Next button text", control: "text" },
  { key: "HideNextButton", label: "Hide the Next button", control: "yesno" },
  { key: "HidePreviousButton", label: "Hide the Previous button", control: "yesno" },
  { key: "AdditionalAction", label: "Actions to run when this page opens", control: "actions", wide: true },
  { key: "PostAdditionalAction", label: "Actions to run when leaving this page", control: "actions", wide: true },
  { key: "SetValue", label: "Values to set when this page opens", control: "text", help: "Field|Value pairs separated by commas, for example Stage|Quote,Visited|Y.", wide: true },
  { key: "TargetPageID", label: "ChangePage: go to page ID", control: "number" },
  { key: "ChangePageConditionals", label: "ChangePage: only when", control: "condition", wide: true },
  { key: "TargetViewID", label: "ChangeView: go to view ID", control: "number" },
  { key: "ChangeViewConditionals", label: "ChangeView: only when", control: "condition", wide: true },
];

export const SECTION_SETTINGS: SettingDef[] = [
  { key: "QuestionConditional", label: "Show when", control: "condition", help: "Leave empty to always show.", wide: true },
  { key: "SectionClass", label: "CSS classes", control: "text" },
];

export function settingsForQuestion(typeCode: string): SettingDef[] {
  const widget = getWidget(typeCode);
  if (!widget) return COMMON_SETTINGS;
  return [...(widget.entry ? ENTRY_SETTINGS : []), ...widget.settings, ...COMMON_SETTINGS];
}
