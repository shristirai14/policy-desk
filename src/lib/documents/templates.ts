export type DocumentBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string; when?: string }
  | { type: "fields"; rows: Array<[label: string, value: string]>; when?: string }
  | { type: "vehicles"; rows: Array<[label: string, value: string]> }
  | { type: "premium" }
  | { type: "signature"; label: string };

export type DocumentTemplateSeed = {
  code: string;
  title: string;
  kind: string;
  condition: string;
  blocks: DocumentBlock[];
};

const PROPOSER_ROWS: Array<[string, string]> = [
  ["Name", "{{FirstName}} {{LastName}}{{ApplicantName}}"],
  ["Mobile", "{{Mobile}}"],
  ["Email", "{{Email}}"],
  ["Address", "{{Address1}} {{Address2}}, {{City}}, {{State}} {{Pincode}}"],
  ["GSTIN", "{{GSTIN}}"],
];

const VEHICLE_ROWS: Array<[string, string]> = [
  ["Registration number", "{{RegistrationNumber}}"],
  ["Make and model", "{{Make}} {{Model}} {{VariantName}}"],
  ["Cubic capacity", "{{CubicCapacity}} cc, {{FuelType}}"],
  ["Date of first registration", "{{RegistrationDate|date}}"],
  ["Insured declared value", "{{IDV|money}}"],
];

export const PRIVATE_CAR_TEMPLATES: DocumentTemplateSeed[] = [
  {
    code: "PROPOSAL",
    title: "Proposal Form",
    kind: "APPLICATION",
    condition: "",
    blocks: [
      { type: "heading", text: "Proposer" },
      { type: "fields", rows: PROPOSER_ROWS },
      { type: "heading", text: "Policy requested" },
      {
        type: "fields",
        rows: [
          ["Quote number", "{{QuoteNumber}}"],
          ["Policy start date", "{{EffectiveDate|date}}"],
          ["Previous insurer", "{{PreviousInsurer}}"],
          ["Previous policy expiry", "{{PreviousPolicyExpiry|date}}"],
          ["No Claim Bonus claimed", "{{NCBPercent}}%"],
          ["Financier", "{{FinancierName}}"],
        ],
      },
      { type: "heading", text: "Vehicles proposed for insurance" },
      { type: "vehicles", rows: VEHICLE_ROWS },
      { type: "heading", text: "Declaration" },
      {
        type: "paragraph",
        text: "I declare that the statements in this proposal are true and complete to the best of my knowledge, and that I have not withheld any information that would influence the insurer's decision to accept this risk. I agree that this proposal and declaration form the basis of the contract.",
      },
      { type: "signature", label: "Signature of the proposer" },
    ],
  },
  {
    code: "SCHEDULE",
    title: "Policy Schedule cum Certificate of Insurance",
    kind: "SCHEDULE",
    condition: "",
    blocks: [
      { type: "heading", text: "Policy" },
      {
        type: "fields",
        rows: [
          ["Policy number", "{{PolicyNumber}}"],
          ["Period of insurance", "From {{EffectiveDate|date}} to midnight of {{ExpirationDate|date}}"],
          ["Agent code", "{{AgentCode}}"],
        ],
      },
      { type: "heading", text: "Insured" },
      { type: "fields", rows: PROPOSER_ROWS },
      { type: "heading", text: "Vehicles insured" },
      { type: "vehicles", rows: VEHICLE_ROWS },
      { type: "heading", text: "Premium" },
      { type: "premium" },
      { type: "paragraph", when: "Financed,=,Y", text: "The vehicle is hypothecated to {{FinancierName}}." },
      {
        type: "paragraph",
        text: "Subject to the terms, conditions and exclusions of the policy wording. The insured is not indemnified if the vehicle is used or driven otherwise than in accordance with this schedule.",
      },
      { type: "signature", label: "Acknowledged by the insured" },
    ],
  },
  {
    code: "ZERODEP",
    title: "Zero Depreciation Add-on Wording",
    kind: "ENDORSEMENT",
    condition: "CoverType,=,PACKAGE;ZeroDep,=,Y",
    blocks: [
      { type: "fields", rows: [["Policy number", "{{PolicyNumber}}"]] },
      {
        type: "paragraph",
        text: "In consideration of the additional premium paid, the insurer will not deduct depreciation on parts replaced in a partial loss claim admitted under the own damage section of the policy, for up to two claims during the period of insurance.",
      },
      { type: "paragraph", text: "This cover does not apply to tyres, tubes and batteries beyond 50 percent of their cost, or to a total loss or theft claim." },
      { type: "signature", label: "Acknowledged by the insured" },
    ],
  },
  {
    code: "NCBDECL",
    title: "No Claim Bonus Declaration",
    kind: "DECLARATION",
    condition: "NCBPercent,>,0",
    blocks: [
      {
        type: "fields",
        rows: [
          ["Previous insurer", "{{PreviousInsurer}}"],
          ["Previous policy expiry", "{{PreviousPolicyExpiry|date}}"],
          ["No Claim Bonus claimed", "{{NCBPercent}}%"],
        ],
      },
      {
        type: "paragraph",
        text: "I declare that no claim was made or is pending under the previous policy named above, and that the No Claim Bonus claimed is the entitlement shown on that policy. I understand that if this declaration is found to be incorrect, the own damage section of this policy stands forfeited.",
      },
      { type: "signature", label: "Signature of the insured" },
    ],
  },
  {
    code: "HYPOTHECATION",
    title: "Hypothecation Endorsement",
    kind: "ENDORSEMENT",
    condition: "Financed,=,Y",
    blocks: [
      { type: "fields", rows: [["Policy number", "{{PolicyNumber}}"], ["Financier", "{{FinancierName}}"]] },
      {
        type: "paragraph",
        text: "It is noted that the vehicles insured are hypothecated to the financier named above. Any payment for loss or damage to a vehicle, other than damage made good by repair, will be made to the financier, whose receipt is a full discharge of the insurer's liability for that loss.",
      },
      { type: "signature", label: "Acknowledged by the insured" },
    ],
  },
];

export function parseBlocks(body: unknown): DocumentBlock[] {
  if (!body || typeof body !== "object") return [];
  const blocks = (body as { blocks?: unknown }).blocks;
  return Array.isArray(blocks) ? (blocks as DocumentBlock[]) : [];
}
