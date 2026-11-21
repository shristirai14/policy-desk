# ISi Mini Clone: Implementation Plan

A demo-sized clone of the ISi Unified Application (UA) for Indian motor insurance: agent login, a UA Builder that defines the quote form as data, a multi-page quote runtime driven by that data, a simple rating engine, a dummy payment page, and e-sign with dynamically selected documents.

## 1. What was reviewed

| Source | What it gave this plan |
|---|---|
| `HTDocs\IS\application\` (UA runtime) and `AIHelpFiles\reference\unified-application.md` | The Manual > View > Page > Section > Question model, the `PreProcessing_Main` action pipeline, conditional-expression grammar, widgets, layouts |
| `HTDocs\IS\TestingTools\UnifiedTool\` (UA Builder: `UA.cfm`, `UA_Manual*.cfm`, `ua_NewManual.cfm`, `UA_BuildSettings.js`, `UA_WidgetSchema.cfc`) and `ua-widget-settings-schema.md` | Builder UX: tree on the left, editor on the right, schema-driven Build Settings sidebar, add new / add existing page and section, copy and delete question, new-manual wizard |
| `HTDocs\IS\application\Widgets\` and `Widgets\types\*-types.cfm`, `*-templates.cfm` | Widget catalog and the per-widget setting schemas and setting templates |
| `HTDocs\IS\eSign\` | E-sign flow: encrypted link, authorization step, document list, sign, render PDF, completion |
| `ISRatingLocal` (local SQL Server) | Real shapes and data of `Manuals`, `ManualViews`, `ManualViewPages`, `ManualPages`, `ManualPageSections`, `ManualSections`, `ManualSectionQuestions`, `ManualQuestions`, `ManualChoices`, `RateSupport1-5`. Auto manuals 2320 and 2710 used as the reference |
| `ISDataLocal` | `WebInfo` (quote row + packet), `WebAppRatingResults`, `WebAppDisplayResults`, `EsignDocuments`, `EsignAuthorization`, `EsignSignatures`, `lkUWStatus` |
| `VBprojects\ISTransfer\RateModule.cls` via `AIHelpFiles\istransfer-rating-engine.md` | How rating really works: a manual is a step program (`RateOrder`, `RateMode`, `RateParameters`, `RateConditions`, `RateApplyTo`) interpreted over rate tables, per risk, producing result rows and a flow trace |

Findings that shape the design:

- The UA is entirely data. Manual 2320 (private passenger auto) has 4 views, 33 pages, 94 sections, 552 section questions. Its main view is: Applicant > Drivers > Vehicles > Policy > Quote (page property `AdditionalAction=Rate`) > Additional Info > Application (payment, e-sign sections). Separate views handle "ESign Submitted" and "Esign Complete - Payment Entry".
- Most used question types locally: Text, SetValue, Select, Input, hidden, Y/N, RatingTotals, ButtonWidget, DetailSelection, Date, Heading, Number, AddressWidget, Phone, NameWidget, EmailWidget, ErrorDisplay, Checkbox, EffectiveDateWidget, VIN, eSignStatus. That list is the widget scope for the clone.
- Visibility and behaviour are driven by one condition grammar (`Field,op,value;Field,op,value;AND`) stored on sections, questions and pages. ISi keeps four mirrored copies of the evaluator (CF, JS, validation service, legacy). The clone has one TypeScript evaluator shared by server and client.
- The rating engine dispatches 194 RateModes; about 8 do most of the work (`SetVariable`, `Multiply`, `LookupRate`, `AssignField`, `AddEndorsement`, `AddToBase`, `SetStructure`, `CallSub`). The clone keeps the step-program idea with about 14 modes.
- Quote data in ISi is one flat packet with suffixes (`_1` for risk 1). The clone keeps that convention in a JSON column, so conditions and rating read fields the same way.

## 2. Scope

In scope:

1. Login, forgot / reset password, two-factor. No sign-up; an admin creates agents.
2. App shell with sidebar: Dashboard, Create Quote, Search Quotes, Policies, UA Builder, Rating, Users, Account.
3. UA Builder: manuals, views, pages, sections, questions, choices, buttons, conditions, live preview.
4. Quote runtime: multi-page form rendered from the manual, save per page, validation, vehicle repeater.
5. Rating engine (India, vehicles only) with premium breakup and a flow trace.
6. Dummy payment page.
7. E-sign: public tokenized link, OTP authorization, dynamically selected documents, signed PDFs, policy issuance.

Out of scope (present in ISi, deliberately dropped): endorsements, renewals, cancellations, claims / FNOL, billing and instalments, third-party reports, bridging from a legacy system, per-client ClientCode overrides, multi-client tenancy, WDDX, public (anonymous) quoting, real payment gateway, legally binding e-sign (Aadhaar eSign / DSC).

## 3. Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, Server Actions) |
| UI | Tailwind CSS + shadcn/ui, `lucide-react` icons |
| Auth | Better Auth: email + password with `disableSignUp`, `twoFactor` plugin (TOTP, email OTP, backup codes), `admin` plugin for user creation and roles |
| Database | Neon Postgres through Prisma (pooled URL for the app, direct URL for migrations) |
| Email | Nodemailer over SMTP (Mailpit or Ethereal in development) for reset links, 2FA codes, e-sign invitations and OTPs |
| Forms | `react-hook-form` + `zod` for static screens; the quote runtime uses its own renderer |
| Builder UX | `@dnd-kit` for ordering, TanStack Table for lists |
| PDF | `@react-pdf/renderer` to generate documents, `pdf-lib` to stamp signatures and the audit page |
| Tests | Vitest for the condition evaluator and rating engine, Playwright for one end-to-end path |

## 4. Data model (Prisma)

ISi table names are in brackets. Composite `ManualID` keys become plain foreign keys; key=value property strings become JSON columns; condition strings keep the ISi grammar.

**Auth and people**

- `User`, `Session`, `Account`, `Verification`, `TwoFactor`: Better Auth tables. `User` adds `role` (`ADMIN`, `UNDERWRITER`, `AGENT`) and `agentId`.
- `Agent` [Agents]: `agentCode`, name, contact, `active`.

**Manual catalog** (the UA definition)

- `Manual` [Manuals]: `name`, `policyTypeCode` (`PVTCAR`, `TWOWHEELER`), `startDate`, `endDate`, `status`, `maxRisks`, `sourceManualId`, `notes`.
- `ManualView` [ManualViews]: `name`, `userClassList`, `quoteCodeList`, `properties` JSON, `navigation` JSON.
- `ManualPage` [ManualPages]: `name`, `heading`, `subHeading`, `properties` JSON, `disableCode`.
- `ManualViewPage` [ManualViewPages]: view-page junction with `pageOrder`, `progressMilestone`, `buttonText`, `properties`, `restrict`.
- `ManualSection` [ManualSections]: `name`, `heading`, `subHeading`, `properties` JSON, `disableCode`.
- `ManualPageSection` [ManualPageSections]: page-section junction with `sectionOrder`, `areaNum`, `properties`, `restrict`.
- `ManualQuestion` [ManualSectionQuestions merged with the entry half of ManualQuestions]: `sectionId`, `questionOrder`, `questionText`, `questionTypeCode`, `fieldName`, `fieldType`, `riskSpecific`, `required`, `minValue`, `maxValue`, `placeholder`, `userHelp`, `disableCode`, `leftCols`, `rightCols`, `properties` JSON.
- `ManualChoice` [ManualChoices]: `questionId`, `choiceValue`, `choiceText`, `isDefault`, `sortOrder`, `disableCode`.

Pages and sections stay reusable through the junction tables, as in ISi (the "Header" section appears on every page of manual 2320).

**Rating**

- `RateStep` [ManualQuestions with ManualPage = 2]: `manualId`, `rateOrder`, `fieldName`, `description`, `rateMode`, `rateParameters`, `rateConditions`, `rateApplyTo`, `scope` (`RISK` or `POLICY`), `coverageCode`, `displayOrder`, `startDate`, `endDate`.
- `RateFactor` [RateSupport1, 3, 5 collapsed]: `manualId`, `fieldName`, `key1..key5` (default `x`), `effectiveDate`, `numericValue`, `stringValue`.
- `RateBand` [RateSupport2]: `manualId`, `fieldName`, `key1..key3`, `effectiveDate`, `upTo`, `numericValue`.

**Quotes and policies**

- `Quote` [WebInfo]: `quoteNumber`, `manualId`, `viewId`, `currentPageId`, `furthestPageOrder`, `quoteCode` (`A` = new business), `statusCode`, `statusDate`, `agentId`, `userId`, `effectiveDate`, searchable applicant columns (name, mobile, email, registration number), `data` JSON (the packet), `ratingValid`, `totalPremium`.
- `QuoteRatingResult` [WebAppRatingResults]: `quoteId`, `seq`, `risk`, `fieldName`, `description`, `coverageCode`, `premiumAmount`, `runningBase`, `adjustBase`.
- `QuoteRateFlow` [WebappFlow]: `quoteId`, `seq`, `risk`, `rateOrder`, `fieldName`, `rateMode`, `flowValue`, `flowInfo`, `flowPremium`.
- `Payment`: `quoteId`, `amount`, `method`, `status`, `reference`, `paidAt`.
- `Policy`: `policyNumber`, `quoteId`, `effectiveDate`, `expirationDate`, `totalPremium`, `status`, `snapshot` JSON.

Status codes follow `lkUWStatus`: `P` in progress, `S` submitted, `B` in e-sign, `A` approved (policy issued), `D` denied, `X` deleted.

**E-sign and documents**

- `DocumentTemplate`: `manualId`, `code`, `title`, `kind`, `condition`, `body` (structured template with `{{FieldName}}` placeholders and repeat blocks per vehicle), `signerRoles`, `sortOrder`.
- `EsignAuthorization` [EsignAuthorization]: `id` (unguessable token), `quoteId`, `signerRole`, `contactName`, `contactEmail`, `otpHash`, `signatureText`, `initialsText`, `statusCode`, timestamps, `ipAddress`.
- `EsignDocument` [EsignDocuments]: `quoteId`, `templateId`, `title`, `statusCode`, `unsignedPdf`, `signedPdf`, `sha256`.
- `EsignSignature` [EsignSignatures]: `documentId`, `authorizationId`, `documentRole`, `statusCode`, `signedAt`, `ipAddress`.

## 5. Architecture

```
src/
  app/
    (auth)/login, forgot-password, reset-password, two-factor
    (app)/dashboard, quotes/new, quotes, quotes/[id]/[[...page]], policies, policies/[id]
    (app)/builder, builder/[manualId], rating/[manualId], users, account
    esign/[token]                 public, no session
    api/auth/[...all]             Better Auth handler
  lib/
    auth.ts, auth-client.ts, mail.ts, prisma.ts
    ua/conditions.ts              the one condition evaluator
    ua/packet.ts                  getValue / setValue with risk suffix probing
    ua/pipeline.ts                the PreProcessing_Main equivalent
    ua/widgets/                   registry, per-widget schema and component
    rating/engine.ts, modes.ts, lookup.ts
    documents/select.ts, render.tsx, sign.ts
  components/ua/                  PageRenderer, SectionRenderer, QuestionRow, layouts
prisma/schema.prisma, prisma/seed.ts
```

### 5.1 Condition evaluator (`lib/ua/conditions.ts`)

Supports the ISi grammar subset: `left,operator,right` rules joined by `;` with a trailing `AND` / `OR` (AND by default), one level of `()` grouping, operators `= <> > >= < <= in, not in, contains, between, starts with`, right-side `BLANK`, `TODAY`, `'literal'`, and field references. Left-side reserved names: `usertype`, `suffix`. Field lookup probes `name`, then `name_<risk>`. Pure function, imported by both the server pipeline and the client renderer for live show / hide and required checks.

### 5.2 Quote pipeline (`lib/ua/pipeline.ts`)

A single server action, `submitPage({ quoteId, lastPageId, values, actions })`, mirrors the stages of `PreProcessing_Main.cfm` that matter:

1. Load quote, manual, view; check the user may access the quote (agents see their own).
2. Merge posted values into the packet; run `SetValue` questions of the page.
3. Queue actions: the leaving page's `PostAdditionalAction`, the posted button actions, then the target page's `AdditionalAction`.
4. Page-change validation: required, min / max, type, and conditional rules. On error, stay on the page and return field errors; strip `RATE`, `BIND`, `ESIGN`.
5. Resolve the target page (next / previous / milestone jump; `ChangePage` and `ChangeView` with their conditionals).
6. Run actions: `RATE` (rating engine), `PAY` (create payment), `ESIGN` (start e-sign, status `B`), `BIND` (issue policy, status `A`), `EXIT`, `EXITANDDELETE`.
7. Save, then redirect to the resolved view / page.

Supported page properties: `AdditionalAction`, `PostAdditionalAction`, `SetValue`, `OnLastPage`, `DefaultLayout` (`OneArea`, `TwoArea`), `TargetViewID`, `TargetPageID`, `ChangePageConditionals`, button text overrides. Rating is marked invalid whenever a rated field changes.

### 5.3 Widgets

Each widget is a folder with a React component and a settings schema (the equivalent of `Widgets/types/<widget>-types.cfm`); the builder's Build Settings sidebar is generated from the schema, so adding a widget never touches builder code.

| Group | Widgets |
|---|---|
| Entry | Input, Number, Select, YesNo, Date, Checkbox, Phone, EmailWidget, NameWidget, AddressWidget (PIN code fills city and state), EffectiveDateWidget, hidden |
| Display | Text, Heading, ErrorDisplay, RatingTotals, DisplayTable |
| Behaviour | SetValue, ButtonWidget (text, style, actions to append, submit, confirm dialog) |
| Compound | DetailSelection (vehicle list with add / edit / delete, summary rows), VehicleWidget (registration number, make > model > variant cascade, replaces ISi's VIN widget), PaymentWidget, DocumentWidget, eSignStatus |

Common settings on every question: `QuestionConditional`, `ReadOnly`, `ReadOnlyCondition`, `Required`, `RequiredCondition`, `DefaultValue`, `LeftClass`, `RightClass`, column widths.

### 5.4 UA Builder

- Manual list with "New manual" wizard (name, policy type, default view, number of starter pages), as `ua_NewManual.cfm` does, plus "Copy manual".
- Workspace: collapsible tree (View > Page > Section > Question) with drag-to-reorder, "Add new page", "Add existing page", "Add new section", "Add existing section", "Add question", copy, delete with usage warning for shared pages and sections.
- Editor panel per node type: core columns on the left, Build Settings sidebar on the right (schema-driven controls, a visual condition builder that writes the grammar string, setting templates such as "required email" or "Yes / No as radio").
- Choices editor for Select questions (value, text, default, order, disable condition).
- Button builder: pick action(s) from the catalog (`RATE`, `PAY`, `ESIGN`, `BIND`, `EXIT`, `ChangePage`, `ChangeView`), set text, style and confirmation.
- Preview: opens the selected page in the real renderer against a scratch packet.
- Search across the manual by field name, text or type; "possible issues" check (duplicate field names, conditions referencing unknown fields, pages not in any view).

### 5.5 Rating engine (India, vehicles only)

Engine shape follows `RateModule.WebappRate`: for each vehicle, run the manual's steps in `rateOrder`; a step runs when its condition passes; values resolve from variables, then the packet (with `_<risk>` suffix); premium is accumulated per coverage; policy-scope steps run once after the last vehicle. Rounding is the second item of the mode (`Multiply,2`), half away from zero. A step that fails its condition leaves no flow row. Every executed step writes a `QuoteRateFlow` row so a premium can be explained on screen.

Modes: `SetVariable`, `AssignField`, `Add`, `Subtract`, `Multiply`, `Divide`, `Maximum`, `Minimum`, `LookupRate` (RateFactor numeric), `LookupString`, `StepRate` (RateBand), `AddToBase`, `AddTax`, `RateError`.

Seed manual "Private Car Package Policy" (a second seed for two-wheelers reuses the same steps with different rate rows):

| Stage | Calculation | Rate table |
|---|---|---|
| Vehicle age | months between registration date and effective date | - |
| IDV | ex-showroom price x (1 - depreciation) | `Depreciation` band by age: 5, 15, 20, 30, 40, 50 percent |
| Own damage | IDV x OD rate | `ODRate` by RTO zone (A / B), cubic capacity band, age band |
| Discounts on OD | No Claim Bonus, voluntary deductible, anti-theft | `NCB` 0 / 20 / 25 / 35 / 45 / 50 percent; `VolDed`; `AntiTheft` |
| Add-ons | zero depreciation (percent of IDV by age), engine protect, roadside assistance (flat), return to invoice | `AddOnRate` |
| Third party | flat premium by cubic capacity | `TPRate` |
| Personal accident | owner-driver cover, unnamed passengers, paid driver legal liability | `PARate` |
| Policy | net premium, GST 18 percent, total | `TaxRate` |
| Guards | `RateError` when vehicle age is above 15 years, IDV is outside limits, or NCB is claimed with a claim in the prior year | - |

All rates are rows, not code. Seed values will be taken from the published India Motor Tariff and the current third-party premium notification and must be checked before the demo is shown as anything more than illustrative.

Rating UI (admin): step grid with inline edit, rate table editor with CSV import, and "Test rate" which runs a saved quote and shows the flow trace.

### 5.6 Payment (dummy)

A `PaymentWidget` on the payment page shows the premium breakup and offers UPI, card and net banking tabs with fake inputs. "Pay" calls the `PAY` action: creates a `Payment` with a generated reference and a simulated success (a test value forces a failure path), emails a receipt, and moves on. No real card data is stored.

### 5.7 E-sign and dynamic documents

1. The `ESIGN` action selects documents: every `DocumentTemplate` of the manual whose `condition` passes against the packet. Seed set: Proposal Form (always), Policy Schedule cum Certificate of Insurance (always), Zero Depreciation Add-on Wording (`ZeroDep,=,Y`), NCB Declaration (`NCBPercent,>,0`), Hypothecation Endorsement (`Financed,=,Y`).
2. Each template is merged with the packet and rating results and rendered to PDF; rows are created in `EsignDocument`, one `EsignAuthorization` per signer (insured; optionally agent), status `B`.
3. The insured receives an email link to `/esign/[token]` (no login, as ISi's encrypted URLs). Steps mirror `eSign/actions`: authorization (consent, email OTP, adopt typed signature and initials) > document list with status > view and sign each > completion.
4. On signing, `pdf-lib` stamps the signature, name, timestamp and IP, appends an audit page, and stores the signed PDF and its SHA-256.
5. When all signatures are complete: `Policy` is created, quote status becomes `A`, and signed documents are emailed and listed on the policy screen. The agent can cancel an e-sign in progress (`RESETESIGN`: back to `P`).

Default page flow of the seeded view, in the order requested: Proposer > Vehicles > Coverages > Quote (rate) > Payment > E-Sign > Confirmation. Because the flow is data, the order can be changed in the builder.

## 6. Phases

| # | Phase | Deliverable | Done when |
|---|---|---|---|
| 0 | Foundation | Next.js app, Tailwind, shadcn, Prisma schema, Neon, env handling, lint, seed script | `prisma migrate` runs against Neon; app boots |
| 1 | Auth | Login, forgot / reset password, 2FA setup and challenge, route protection, role guard, Users screen (admin creates agents, sends set-password email) | An agent can log in with 2FA; `/sign-up` does not exist; reset email arrives in Mailpit |
| 2 | App shell | Sidebar layout, dashboard counts, Search Quotes, Policies list, account page | Navigation works for each role |
| 3 | UA core | Condition evaluator, packet helpers, widget registry, page renderer, pipeline with save / validate / navigate | A hand-seeded manual renders and saves across pages; evaluator unit tests pass |
| 4 | UA Builder | Manual wizard, tree, editors, Build Settings sidebar, choices, buttons, preview | The seeded manual can be rebuilt from an empty manual using only the builder |
| 5 | Quote flow | Create Quote (pick product), vehicle repeater, progress bar, resume, quote search | A quote can be created, left and resumed |
| 6 | Rating | Engine, modes, seed rates, quote page with breakup, flow viewer, rating admin | Unit tests reproduce hand-calculated premiums for 5 sample vehicles |
| 7 | Payment | Payment page, receipt email | Paid quote moves to e-sign |
| 8 | E-sign | Templates, document selection, PDF generation, public signing flow, policy issuance | Changing an answer changes the document set; signed PDFs open with the audit page |
| 9 | Hardening | Access checks on every action, rate limits on login / OTP / e-sign, audit log, Playwright happy path, deploy | End-to-end test passes on the deployed build |

Phases 3 and 6 are the risk: both are engines, so they get unit tests before any UI is built on them.

## 7. Decisions to confirm

| Decision | Default taken in this plan |
|---|---|
| Products | Private car and two-wheeler; no commercial vehicles |
| Properties storage | JSON columns rather than ISi's `key=value` strings; condition strings keep the ISi grammar |
| Step order | Rate > Payment > E-sign (ISi's own manual 2320 does e-sign before payment) |
| Signers | Insured only; agent signature optional per template |
| PDF storage | Bytes in Postgres (no extra storage service) |
| SMTP | Mailpit locally; any SMTP account for the deployed demo |
| Hosting | Vercel + Neon |
