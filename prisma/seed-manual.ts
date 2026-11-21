import { prisma } from "@/lib/prisma";
import { PRIVATE_CAR_BANDS, PRIVATE_CAR_FACTORS, PRIVATE_CAR_STEPS } from "@/lib/rating/private-car-program";

import { PRIVATE_CAR_TEMPLATES } from "@/lib/documents/templates";

const SEED_VERSION = "seed:v3";

type QuestionSeed = {
  text?: string;
  type: string;
  field?: string;
  required?: boolean;
  risk?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  help?: string;
  left?: number;
  right?: number;
  props?: Record<string, string>;
  choices?: Array<[value: string, text: string, isDefault?: boolean]>;
};

type SectionSeed = { name: string; heading?: string; subHeading?: string; area?: number; props?: Record<string, string>; questions: QuestionSeed[] };

type PageSeed = { name: string; heading: string; subHeading?: string; buttonText: string; props?: Record<string, string>; sections: SectionSeed[] };

const STATES: Array<[string, string]> = [
  ["DL", "Delhi"],
  ["GJ", "Gujarat"],
  ["KA", "Karnataka"],
  ["MH", "Maharashtra"],
  ["RJ", "Rajasthan"],
  ["TN", "Tamil Nadu"],
  ["TS", "Telangana"],
  ["UP", "Uttar Pradesh"],
  ["WB", "West Bengal"],
];

const PAGES: PageSeed[] = [
  {
    name: "Proposer",
    heading: "Proposer details",
    subHeading: "The person or company the policy will be issued to.",
    buttonText: "Proposer",
    sections: [
      {
        name: "Proposer identity",
        heading: "Who is being insured",
        questions: [
          {
            text: "Proposer type",
            type: "Select",
            field: "ProposerType",
            required: true,
            choices: [
              ["IND", "Individual", true],
              ["CORP", "Company"],
            ],
          },
          {
            text: "Title",
            type: "Select",
            field: "Title",
            props: { QuestionConditional: "ProposerType,=,IND", RequiredCondition: "ProposerType,=,IND" },
            choices: [
              ["MR", "Mr"],
              ["MS", "Ms"],
              ["MRS", "Mrs"],
              ["DR", "Dr"],
            ],
          },
          { text: "First name", type: "Input", field: "FirstName", required: true, props: { MaxLength: "50", QuestionConditional: "ProposerType,=,IND" } },
          { text: "Last name", type: "Input", field: "LastName", required: true, props: { MaxLength: "50", QuestionConditional: "ProposerType,=,IND" } },
          {
            text: "Date of birth",
            type: "Date",
            field: "DateOfBirth",
            required: true,
            props: { MaxDate: "TODAY", QuestionConditional: "ProposerType,=,IND" },
          },
          { text: "Company name", type: "Input", field: "ApplicantName", required: true, props: { MaxLength: "100", QuestionConditional: "ProposerType,=,CORP" } },
          {
            text: "GSTIN",
            type: "Input",
            field: "GSTIN",
            help: "15 characters, for example 27AAPFU0939F1ZV.",
            props: {
              QuestionConditional: "ProposerType,=,CORP",
              Uppercase: "Y",
              MaxLength: "15",
              Pattern: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$",
              PatternMessage: "GSTIN is not in the expected format.",
            },
          },
        ],
      },
      {
        name: "Proposer contact",
        heading: "Contact",
        subHeading: "Policy documents and the e-sign link are sent here.",
        questions: [
          { text: "Mobile number", type: "Phone", field: "Mobile", required: true, placeholder: "10-digit mobile" },
          { text: "Email", type: "EmailWidget", field: "Email", required: true },
          { text: "Address line 1", type: "Input", field: "Address1", required: true, props: { MaxLength: "100" } },
          { text: "Address line 2", type: "Input", field: "Address2", props: { MaxLength: "100" } },
          { text: "City", type: "Input", field: "City", required: true, props: { MaxLength: "50" } },
          { text: "State", type: "Select", field: "State", required: true, choices: STATES.map(([value, text]) => [value, text]) },
          {
            text: "PIN code",
            type: "Input",
            field: "Pincode",
            required: true,
            props: { MaxLength: "6", Pattern: "^[1-9][0-9]{5}$", PatternMessage: "PIN code must be 6 digits." },
          },
        ],
      },
    ],
  },
  {
    name: "Vehicles",
    heading: "Vehicles",
    subHeading: "Add each vehicle to be covered under this policy.",
    buttonText: "Vehicles",
    sections: [
      {
        name: "Vehicle list",
        heading: "Vehicles on this quote",
        questions: [
          {
            type: "DetailSelection",
            props: { ItemLabel: "Vehicle", SummaryFields: "RegistrationNumber,Make,Model,VariantName", MinItems: "1" },
          },
        ],
      },
      {
        name: "Vehicle details",
        heading: "Vehicle {{suffix}}",
        subHeading: "Details as shown on the registration certificate.",
        questions: [
          {
            text: "Registration number",
            type: "Input",
            field: "RegistrationNumber",
            risk: true,
            required: true,
            help: "For example MH12AB1234.",
            props: {
              Uppercase: "Y",
              MaxLength: "11",
              Pattern: "^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$",
              PatternMessage: "Enter the registration number without spaces, for example MH12AB1234.",
            },
          },
          {
            text: "Where is it registered?",
            type: "Select",
            field: "RTOZone",
            risk: true,
            required: true,
            choices: [
              ["A", "Ahmedabad, Bengaluru, Chennai, Hyderabad, Kolkata, Mumbai, New Delhi or Pune"],
              ["B", "Anywhere else in India"],
            ],
          },
          { text: "Make, model and variant", type: "VehicleWidget", field: "Variant", risk: true, required: true },
          {
            text: "Date of first registration",
            type: "Date",
            field: "RegistrationDate",
            risk: true,
            required: true,
            props: { MaxDate: "TODAY" },
          },
          {
            text: "Is an approved anti-theft device fitted?",
            type: "YesNo",
            field: "AntiTheft",
            risk: true,
            required: true,
            props: { DefaultValue: "N" },
          },
        ],
      },
    ],
  },
  {
    name: "Policy",
    heading: "Policy details",
    subHeading: "Cover period and the previous policy, if there is one.",
    buttonText: "Policy",
    sections: [
      {
        name: "Policy period",
        heading: "Cover",
        questions: [
          {
            text: "Policy type",
            type: "Select",
            field: "CoverType",
            required: true,
            choices: [
              ["PACKAGE", "Package (own damage and third party)", true],
              ["TP", "Third party only"],
            ],
          },
          {
            text: "Policy start date",
            type: "Date",
            field: "EffectiveDate",
            required: true,
            help: "Cover runs for one year from this date.",
            props: { DefaultValue: "TODAY", MinDate: "TODAY" },
          },
          {
            text: "Is the vehicle financed?",
            type: "YesNo",
            field: "Financed",
            required: true,
            props: { DefaultValue: "N" },
          },
          {
            text: "Financier name",
            type: "Input",
            field: "FinancierName",
            props: { QuestionConditional: "Financed,=,Y", RequiredCondition: "Financed,=,Y", MaxLength: "100" },
          },
        ],
      },
      {
        name: "Previous policy",
        heading: "Previous policy",
        questions: [
          {
            text: "Was the vehicle insured before?",
            type: "YesNo",
            field: "PreviousInsurance",
            required: true,
            props: { DefaultValue: "N" },
          },
          {
            text: "Previous insurer",
            type: "Input",
            field: "PreviousInsurer",
            props: { QuestionConditional: "PreviousInsurance,=,Y", RequiredCondition: "PreviousInsurance,=,Y", MaxLength: "100" },
          },
          {
            text: "Previous policy expiry date",
            type: "Date",
            field: "PreviousPolicyExpiry",
            props: { QuestionConditional: "PreviousInsurance,=,Y", RequiredCondition: "PreviousInsurance,=,Y" },
          },
          {
            text: "Any claim in the previous policy year?",
            type: "YesNo",
            field: "ClaimInPreviousYear",
            props: { QuestionConditional: "PreviousInsurance,=,Y", RequiredCondition: "PreviousInsurance,=,Y" },
          },
          {
            text: "No Claim Bonus on the previous policy",
            type: "Select",
            field: "NCBPercent",
            help: "Shown on the previous policy schedule.",
            props: {
              QuestionConditional: "(PreviousInsurance,=,Y;ClaimInPreviousYear,=,N;CoverType,=,PACKAGE;AND)",
              RequiredCondition: "(PreviousInsurance,=,Y;ClaimInPreviousYear,=,N;CoverType,=,PACKAGE;AND)",
            },
            choices: [
              ["0", "0%"],
              ["20", "20%"],
              ["25", "25%"],
              ["35", "35%"],
              ["45", "45%"],
              ["50", "50%"],
            ],
          },
          {
            type: "SetValue",
            field: "NCBPercent",
            props: { Value: "0", QuestionConditional: "PreviousInsurance,=,N;ClaimInPreviousYear,=,Y;CoverType,=,TP;OR" },
          },
        ],
      },
    ],
  },
  {
    name: "Coverages",
    heading: "Coverages and add-ons",
    subHeading: "Optional covers change the premium.",
    buttonText: "Coverages",
    sections: [
      {
        name: "Add-on covers",
        heading: "Add-on covers",
        props: { QuestionConditional: "CoverType,=,PACKAGE" },
        questions: [
          { text: "Zero depreciation", type: "YesNo", field: "ZeroDep", required: true, props: { DefaultValue: "N" } },
          { text: "Engine protection", type: "YesNo", field: "EngineProtect", required: true, props: { DefaultValue: "N" } },
          { text: "Roadside assistance", type: "YesNo", field: "RoadsideAssistance", required: true, props: { DefaultValue: "N" } },
          { text: "Return to invoice", type: "YesNo", field: "ReturnToInvoice", required: true, props: { DefaultValue: "N" } },
          {
            text: "Voluntary deductible",
            type: "Select",
            field: "VoluntaryDeductible",
            required: true,
            choices: [
              ["0", "None", true],
              ["2500", "Rs 2,500"],
              ["5000", "Rs 5,000"],
              ["7500", "Rs 7,500"],
              ["15000", "Rs 15,000"],
            ],
          },
        ],
      },
      {
        name: "Personal accident",
        heading: "Personal accident and legal liability",
        questions: [
          {
            text: "Personal accident cover for owner-driver",
            type: "YesNo",
            field: "PAOwnerDriver",
            required: true,
            help: "Mandatory unless the owner already holds a Rs 15 lakh PA cover.",
            props: { DefaultValue: "Y", QuestionConditional: "ProposerType,=,IND" },
          },
          {
            text: "PA cover for unnamed passengers (sum insured per person)",
            type: "Select",
            field: "PAPassengers",
            required: true,
            choices: [
              ["0", "None", true],
              ["100000", "Rs 1,00,000"],
              ["200000", "Rs 2,00,000"],
            ],
          },
          { text: "Legal liability to paid driver", type: "YesNo", field: "PaidDriver", required: true, props: { DefaultValue: "N" } },
        ],
      },
    ],
  },
  {
    name: "Quote",
    heading: "Quote",
    subHeading: "The premium is calculated when this page opens.",
    buttonText: "Quote",
    props: { DefaultLayout: "TwoArea", AdditionalAction: "RATE", NextButtonText: "Proceed to payment" },
    sections: [
      {
        name: "Premium breakup",
        heading: "Premium breakup",
        area: 1,
        questions: [{ type: "RatingTotals", props: { ShowFlowLink: "Y" } }],
      },
      {
        name: "Quote summary",
        heading: "Summary",
        area: 2,
        questions: [
          { text: "Name", type: "Text", field: "FirstName", left: 5, right: 7, props: { QuestionConditional: "ProposerType,=,IND" } },
          { text: "Surname", type: "Text", field: "LastName", left: 5, right: 7, props: { QuestionConditional: "ProposerType,=,IND" } },
          { text: "Company", type: "Text", field: "ApplicantName", left: 5, right: 7, props: { QuestionConditional: "ProposerType,=,CORP" } },
          { text: "Mobile", type: "Text", field: "Mobile", left: 5, right: 7 },
          { text: "Policy start date", type: "Text", field: "EffectiveDate", left: 5, right: 7, props: { Format: "Date" } },
          { text: "Policy type", type: "Text", field: "CoverType", left: 5, right: 7 },
          { text: "No Claim Bonus %", type: "Text", field: "NCBPercent", left: 5, right: 7, props: { QuestionConditional: "NCBPercent,>,0" } },
          { text: "Vehicles", type: "Text", field: "NumberOfRisks", left: 5, right: 7 },
        ],
      },
      {
        name: "Quote actions",
        heading: "Next steps",
        area: 2,
        questions: [
          {
            text: "Changed an answer on an earlier page?",
            type: "ButtonWidget",
            props: { ButtonText: "Recalculate", Actions: "RATE", Variant: "outline" },
          },
          {
            text: "Save this quote and return to the list.",
            type: "ButtonWidget",
            props: { ButtonText: "Save and exit", Actions: "EXIT", Variant: "outline" },
          },
          {
            text: "Discard this quote.",
            type: "ButtonWidget",
            props: {
              ButtonText: "Delete quote",
              Actions: "EXITANDDELETE",
              Variant: "destructive",
              Confirm: "Delete this quote? This cannot be undone.",
            },
          },
        ],
      },
    ],
  },
  {
    name: "Payment",
    heading: "Payment",
    subHeading: "Collect the premium before the documents are sent for signing.",
    buttonText: "Payment",
    props: { NextButtonText: "Continue to e-sign" },
    sections: [
      {
        name: "Payment details",
        heading: "Pay the premium",
        questions: [{ type: "PaymentWidget", field: "PaymentMethod", text: "Payment method", required: true, left: 0, right: 12 }],
      },
    ],
  },
  {
    name: "E-Sign",
    heading: "E-sign and policy issue",
    subHeading: "The insured signs online. The policy is issued when the last document is signed.",
    buttonText: "E-sign",
    sections: [
      {
        name: "E-sign status",
        heading: "Documents",
        questions: [{ type: "eSignStatus" }],
      },
    ],
  },
];

export async function seedPrivateCarManual() {
  const name = "Private Car Package Policy";
  const existing = await prisma.manual.findFirst({ where: { name } });
  if (existing && (existing.notes === null || existing.notes === "seed:v2")) {
    await prisma.quote.deleteMany({ where: { manualId: existing.id } });
    await prisma.manual.delete({ where: { id: existing.id } });
  } else if (existing) {
    return;
  }

  const manual = await prisma.manual.create({
    data: { name, policyTypeCode: "PVTCAR", startDate: new Date("2020-01-01"), maxRisks: 3, notes: SEED_VERSION },
  });
  await prisma.rateStep.createMany({
    data: PRIVATE_CAR_STEPS.map((step) => ({
      manualId: manual.id,
      rateOrder: step.rateOrder,
      fieldName: step.fieldName,
      description: step.description || null,
      rateMode: step.rateMode,
      rateParameters: step.rateParameters || null,
      rateConditions: step.rateConditions || null,
      rateApplyTo: step.rateApplyTo || null,
      scope: step.scope,
      coverageCode: step.coverageCode || null,
    })),
  });
  await prisma.documentTemplate.createMany({
    data: PRIVATE_CAR_TEMPLATES.map((template, index) => ({
      manualId: manual.id,
      code: template.code,
      title: template.title,
      kind: template.kind,
      condition: template.condition || null,
      body: { blocks: template.blocks },
      sortOrder: (index + 1) * 10,
    })),
  });
  await prisma.rateFactor.createMany({
    data: PRIVATE_CAR_FACTORS.map((row) => ({
      manualId: manual.id,
      fieldName: row.fieldName,
      key1: row.keys[0] ?? "x",
      key2: row.keys[1] ?? "x",
      key3: row.keys[2] ?? "x",
      effectiveDate: new Date(row.effectiveDate),
      numericValue: row.numericValue,
      stringValue: row.stringValue,
    })),
  });
  await prisma.rateBand.createMany({
    data: PRIVATE_CAR_BANDS.map((row) => ({
      manualId: manual.id,
      fieldName: row.fieldName,
      effectiveDate: new Date(row.effectiveDate),
      upTo: row.upTo,
      numericValue: row.numericValue,
    })),
  });
  const view = await prisma.manualView.create({
    data: {
      manualId: manual.id,
      name: "New Business",
      userClassList: "ALL",
      quoteCodeList: "A",
      properties: { NextButtonText: "Save and next", PreviousButtonText: "Previous" },
    },
  });

  let pageOrder = 0;
  for (const pageSeed of PAGES) {
    pageOrder += 10;
    const page = await prisma.manualPage.create({
      data: {
        manualId: manual.id,
        name: pageSeed.name,
        heading: pageSeed.heading,
        subHeading: pageSeed.subHeading,
        properties: pageSeed.props ?? {},
      },
    });
    await prisma.manualViewPage.create({
      data: { viewId: view.id, pageId: page.id, pageOrder, buttonText: pageSeed.buttonText },
    });

    let sectionOrder = 0;
    for (const sectionSeed of pageSeed.sections) {
      sectionOrder += 10;
      const section = await prisma.manualSection.create({
        data: {
          manualId: manual.id,
          name: sectionSeed.name,
          heading: sectionSeed.heading,
          subHeading: sectionSeed.subHeading,
          properties: sectionSeed.props ?? {},
        },
      });
      await prisma.manualPageSection.create({
        data: { pageId: page.id, sectionId: section.id, sectionOrder, areaNum: sectionSeed.area ?? 1 },
      });

      let questionOrder = 0;
      for (const questionSeed of sectionSeed.questions) {
        questionOrder += 10;
        await prisma.manualQuestion.create({
          data: {
            sectionId: section.id,
            questionOrder,
            questionText: questionSeed.text,
            questionTypeCode: questionSeed.type,
            fieldName: questionSeed.field,
            required: questionSeed.required ?? false,
            riskSpecific: questionSeed.risk ?? false,
            minValue: questionSeed.min,
            maxValue: questionSeed.max,
            placeholder: questionSeed.placeholder,
            userHelp: questionSeed.help,
            leftCols: questionSeed.left ?? 4,
            rightCols: questionSeed.right ?? 8,
            properties: questionSeed.props ?? {},
            choices: questionSeed.choices
              ? {
                  create: questionSeed.choices.map(([choiceValue, choiceText, isDefault], index) => ({
                    choiceValue,
                    choiceText,
                    isDefault: isDefault ?? false,
                    sortOrder: index,
                  })),
                }
              : undefined,
          },
        });
      }
    }
  }
}
