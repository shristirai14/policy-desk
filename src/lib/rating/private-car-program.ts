import type { RateBandDef, RateFactorDef, RateStepDef } from "@/lib/rating/engine";

const ALWAYS = "1900-01-01";
const PACKAGE = "CoverType,=,PACKAGE";

type StepSeed = [order: number, field: string, mode: string, params: string, options?: Partial<Omit<RateStepDef, "rateOrder" | "fieldName" | "rateMode" | "rateParameters">>];

const STEPS: StepSeed[] = [
  [10, "VehicleAgeMonths", "MonthsDifference", "RegistrationDate,EffectiveDate", { description: "Vehicle age in months" }],
  [20, "VehicleAgeYears", "Divide", "VehicleAgeMonths,12"],
  [21, "VehicleAgeYears", "Floor", "VehicleAgeYears", { description: "Vehicle age in completed years" }],
  [25, "AgeGuard", "RateError", "'Vehicles older than 15 years cannot be quoted here.'", { rateConditions: "VehicleAgeYears,>=,15" }],
  [30, "Depreciation", "StepRate", "VehicleAgeMonths", { rateApplyTo: "DepreciationPct", description: "Depreciation percent for the vehicle age" }],
  [40, "IDVFactor", "Subtract", "100,DepreciationPct"],
  [41, "IDVFactor", "Divide", "IDVFactor,100"],
  [50, "IDV", "Multiply,0", "ExShowroomPrice,IDVFactor", { description: "Insured declared value" }],
  [51, "IDV", "AssignField", "IDV"],
  [55, "IDVGuard", "RateError", "'The insured declared value is too low to quote.'", { rateConditions: "IDV,<,20000" }],
  [60, "CCBand", "StepRate", "CubicCapacity", { description: "Cubic capacity band" }],
  [61, "AgeBand", "StepRate", "VehicleAgeMonths", { description: "Vehicle age band" }],

  [100, "ODRate", "LookupRate", "RTOZone,CCBand,AgeBand", { rateConditions: PACKAGE, description: "Own damage rate (percent of IDV)" }],
  [110, "ODBasic", "Multiply,0", "IDV,ODRate,0.01", { rateConditions: PACKAGE }],
  [120, "ODBasic", "AddToBase,0", "ODBasic", { rateConditions: PACKAGE, coverageCode: "OD", description: "Basic own damage premium" }],

  [130, "AntiTheftDisc", "Multiply,0", "ODBasic,0.025", { rateConditions: `${PACKAGE};AntiTheft,=,Y` }],
  [131, "AntiTheftCap", "LookupRate", "'ANTITHEFT'", { rateConditions: `${PACKAGE};AntiTheft,=,Y` }],
  [132, "AntiTheftDisc", "Minimum", "AntiTheftDisc,AntiTheftCap", { rateConditions: `${PACKAGE};AntiTheft,=,Y` }],
  [133, "AntiTheftDisc", "Multiply", "AntiTheftDisc,-1", { rateConditions: `${PACKAGE};AntiTheft,=,Y` }],
  [134, "AntiTheftDisc", "AddToBase,0", "AntiTheftDisc", { rateConditions: `${PACKAGE};AntiTheft,=,Y`, coverageCode: "OD", description: "Anti-theft device discount" }],

  [140, "VolDedPct", "LookupRate", "VoluntaryDeductible", { rateConditions: `${PACKAGE};VoluntaryDeductible,>,0` }],
  [141, "VolDedCap", "LookupRate", "VoluntaryDeductible", { rateConditions: `${PACKAGE};VoluntaryDeductible,>,0` }],
  [142, "VolDedDisc", "Multiply,0", "ODBasic,VolDedPct,0.01", { rateConditions: `${PACKAGE};VoluntaryDeductible,>,0` }],
  [143, "VolDedDisc", "Minimum", "VolDedDisc,VolDedCap", { rateConditions: `${PACKAGE};VoluntaryDeductible,>,0` }],
  [144, "VolDedDisc", "Multiply", "VolDedDisc,-1", { rateConditions: `${PACKAGE};VoluntaryDeductible,>,0` }],
  [145, "VolDedDisc", "AddToBase,0", "VolDedDisc", { rateConditions: `${PACKAGE};VoluntaryDeductible,>,0`, coverageCode: "OD", description: "Voluntary deductible discount" }],

  [150, "ODNet", "Add", "ODBasic,AntiTheftDisc,VolDedDisc", { rateConditions: PACKAGE }],
  [160, "NCBDisc", "Multiply,0", "ODNet,NCBPercent,-0.01", { rateConditions: `${PACKAGE};NCBPercent,>,0` }],
  [161, "NCBDisc", "AddToBase,0", "NCBDisc", { rateConditions: `${PACKAGE};NCBPercent,>,0`, coverageCode: "OD", description: "No Claim Bonus" }],

  [200, "ZeroDepRate", "LookupRate", "AgeBand", { rateConditions: `${PACKAGE};ZeroDep,=,Y` }],
  [201, "ZeroDepPremium", "Multiply,0", "IDV,ZeroDepRate,0.01", { rateConditions: `${PACKAGE};ZeroDep,=,Y` }],
  [202, "ZeroDepPremium", "AddToBase,0", "ZeroDepPremium", { rateConditions: `${PACKAGE};ZeroDep,=,Y`, coverageCode: "ADDON", description: "Zero depreciation" }],
  [210, "AddOnRate", "LookupRate", "'ENGINE'", { rateApplyTo: "EngineRate", rateConditions: `${PACKAGE};EngineProtect,=,Y` }],
  [211, "EnginePremium", "Multiply,0", "IDV,EngineRate,0.01", { rateConditions: `${PACKAGE};EngineProtect,=,Y` }],
  [212, "EnginePremium", "AddToBase,0", "EnginePremium", { rateConditions: `${PACKAGE};EngineProtect,=,Y`, coverageCode: "ADDON", description: "Engine protection" }],
  [220, "AddOnFlat", "LookupRate", "'RSA'", { rateApplyTo: "RSAPremium", rateConditions: `${PACKAGE};RoadsideAssistance,=,Y` }],
  [221, "RSAPremium", "AddToBase,0", "RSAPremium", { rateConditions: `${PACKAGE};RoadsideAssistance,=,Y`, coverageCode: "ADDON", description: "Roadside assistance" }],
  [230, "AddOnRate", "LookupRate", "'RTI'", { rateApplyTo: "RTIRate", rateConditions: `${PACKAGE};ReturnToInvoice,=,Y;VehicleAgeYears,<,3` }],
  [231, "RTIPremium", "Multiply,0", "IDV,RTIRate,0.01", { rateConditions: `${PACKAGE};ReturnToInvoice,=,Y;VehicleAgeYears,<,3` }],
  [232, "RTIPremium", "AddToBase,0", "RTIPremium", { rateConditions: `${PACKAGE};ReturnToInvoice,=,Y;VehicleAgeYears,<,3`, coverageCode: "ADDON", description: "Return to invoice" }],

  [300, "TPRate", "LookupRate", "CCBand", { description: "Third party premium for the cubic capacity band" }],
  [301, "TPPremium", "AddToBase,0", "TPRate", { coverageCode: "TP", description: "Third party liability" }],
  [310, "PARate", "LookupRate", "'OWNERDRIVER'", { rateApplyTo: "PAOwnerPremium", rateConditions: "PAOwnerDriver,=,Y;ProposerType,=,IND;!Risk,=,1" }],
  [311, "PAOwnerPremium", "AddToBase,0", "PAOwnerPremium", { rateConditions: "PAOwnerDriver,=,Y;ProposerType,=,IND;!Risk,=,1", coverageCode: "PA", description: "Personal accident cover for owner-driver" }],
  [320, "PARate", "LookupRate", "'PASSENGER'", { rateApplyTo: "PassengerRate", rateConditions: "PAPassengers,>,0" }],
  [321, "PAPassengerPremium", "Multiply,0", "PAPassengers,PassengerRate,0.01,SeatingCapacity", { rateConditions: "PAPassengers,>,0" }],
  [322, "PAPassengerPremium", "AddToBase,0", "PAPassengerPremium", { rateConditions: "PAPassengers,>,0", coverageCode: "PA", description: "Personal accident cover for passengers" }],
  [330, "PARate", "LookupRate", "'PAIDDRIVER'", { rateApplyTo: "PaidDriverPremium", rateConditions: "PaidDriver,=,Y" }],
  [331, "PaidDriverPremium", "AddToBase,0", "PaidDriverPremium", { rateConditions: "PaidDriver,=,Y", coverageCode: "TP", description: "Legal liability to paid driver" }],
  [390, "RiskPremium", "AssignField", "!BasePremium", { description: "Premium for this vehicle before tax" }],

  [900, "NetPremium", "AssignField", "!TotalPremium", { scope: "POLICY", description: "Net premium before tax" }],
  [910, "TaxRate", "LookupRate", "'GST'", { scope: "POLICY", rateApplyTo: "GSTRate" }],
  [911, "GST", "AddTax,0", "GSTRate", { scope: "POLICY", coverageCode: "TAX", description: "GST" }],
];

export const PRIVATE_CAR_STEPS: RateStepDef[] = STEPS.map(([rateOrder, fieldName, rateMode, rateParameters, options]) => ({
  rateOrder,
  fieldName,
  rateMode,
  rateParameters,
  description: "",
  rateConditions: "",
  rateApplyTo: "",
  scope: "RISK",
  coverageCode: "",
  startDate: "",
  endDate: "",
  ...options,
}));

function factor(fieldName: string, keys: string[], numericValue: number): RateFactorDef {
  return { fieldName, keys, effectiveDate: ALWAYS, numericValue, stringValue: null };
}

function band(fieldName: string, upTo: number, numericValue: number): RateBandDef {
  return { fieldName, keys: [], effectiveDate: ALWAYS, upTo, numericValue };
}

const OD_RATES: Record<string, number[][]> = {
  A: [
    [3.127, 3.283, 3.362],
    [3.283, 3.447, 3.529],
    [3.44, 3.612, 3.698],
  ],
  B: [
    [3.039, 3.191, 3.267],
    [3.191, 3.351, 3.43],
    [3.343, 3.51, 3.594],
  ],
};

export const PRIVATE_CAR_FACTORS: RateFactorDef[] = [
  ...Object.entries(OD_RATES).flatMap(([zone, byCc]) =>
    byCc.flatMap((byAge, ccIndex) => byAge.map((rate, ageIndex) => factor("ODRate", [zone, String(ccIndex + 1), String(ageIndex + 1)], rate))),
  ),
  factor("AntiTheftCap", ["ANTITHEFT"], 500),
  factor("VolDedPct", ["2500"], 20),
  factor("VolDedPct", ["5000"], 25),
  factor("VolDedPct", ["7500"], 30),
  factor("VolDedPct", ["15000"], 35),
  factor("VolDedCap", ["2500"], 750),
  factor("VolDedCap", ["5000"], 1500),
  factor("VolDedCap", ["7500"], 2000),
  factor("VolDedCap", ["15000"], 2500),
  factor("ZeroDepRate", ["1"], 0.4),
  factor("ZeroDepRate", ["2"], 0.65),
  factor("ZeroDepRate", ["3"], 0.9),
  factor("AddOnRate", ["ENGINE"], 0.15),
  factor("AddOnRate", ["RTI"], 0.3),
  factor("AddOnFlat", ["RSA"], 199),
  factor("TPRate", ["1"], 2094),
  factor("TPRate", ["2"], 3416),
  factor("TPRate", ["3"], 7897),
  factor("PARate", ["OWNERDRIVER"], 375),
  factor("PARate", ["PASSENGER"], 0.05),
  factor("PARate", ["PAIDDRIVER"], 50),
  factor("TaxRate", ["GST"], 18),
];

export const PRIVATE_CAR_BANDS: RateBandDef[] = [
  band("Depreciation", 6, 5),
  band("Depreciation", 12, 15),
  band("Depreciation", 24, 20),
  band("Depreciation", 36, 30),
  band("Depreciation", 48, 40),
  band("Depreciation", 60, 50),
  band("Depreciation", 120, 60),
  band("Depreciation", 9999, 70),
  band("CCBand", 1000, 1),
  band("CCBand", 1500, 2),
  band("CCBand", 99999, 3),
  band("AgeBand", 60, 1),
  band("AgeBand", 120, 2),
  band("AgeBand", 9999, 3),
];
