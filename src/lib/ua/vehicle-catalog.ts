export type VehicleVariant = {
  code: string;
  make: string;
  model: string;
  variant: string;
  cubicCapacity: number;
  fuelType: string;
  seatingCapacity: number;
  exShowroomPrice: number;
};

const ROWS: Array<[string, string, string, string, number, string, number, number]> = [
  ["MS-SWIFT-LXI", "Maruti Suzuki", "Swift", "LXi 1.2 Petrol", 1197, "Petrol", 5, 649000],
  ["MS-SWIFT-ZXI", "Maruti Suzuki", "Swift", "ZXi 1.2 Petrol", 1197, "Petrol", 5, 829000],
  ["MS-ALTO-VXI", "Maruti Suzuki", "Alto K10", "VXi 1.0 Petrol", 998, "Petrol", 5, 499000],
  ["MS-BREZZA-ZXI", "Maruti Suzuki", "Brezza", "ZXi 1.5 Petrol", 1462, "Petrol", 5, 1114000],
  ["HY-I20-SPORTZ", "Hyundai", "i20", "Sportz 1.2 Petrol", 1197, "Petrol", 5, 842000],
  ["HY-CRETA-SX", "Hyundai", "Creta", "SX 1.5 Diesel", 1493, "Diesel", 5, 1560000],
  ["HY-CRETA-E", "Hyundai", "Creta", "E 1.5 Petrol", 1497, "Petrol", 5, 1100000],
  ["TM-NEXON-SMART", "Tata", "Nexon", "Smart 1.2 Petrol", 1199, "Petrol", 5, 800000],
  ["TM-NEXON-FEARLESS", "Tata", "Nexon", "Fearless 1.5 Diesel", 1497, "Diesel", 5, 1330000],
  ["TM-HARRIER-ADV", "Tata", "Harrier", "Adventure 2.0 Diesel", 1956, "Diesel", 5, 1900000],
  ["MM-XUV700-AX5", "Mahindra", "XUV700", "AX5 2.0 Petrol", 1997, "Petrol", 7, 1890000],
  ["MM-SCORPION-Z4", "Mahindra", "Scorpio-N", "Z4 2.2 Diesel", 2184, "Diesel", 7, 1560000],
  ["HN-CITY-V", "Honda", "City", "V 1.5 Petrol", 1498, "Petrol", 5, 1210000],
  ["TY-INNOVA-GX", "Toyota", "Innova Crysta", "GX 2.4 Diesel", 2393, "Diesel", 7, 1999000],
  ["TY-FORTUNER-4X2", "Toyota", "Fortuner", "4x2 2.8 Diesel", 2755, "Diesel", 7, 3640000],
];

export const VEHICLE_CATALOG: VehicleVariant[] = ROWS.map(
  ([code, make, model, variant, cubicCapacity, fuelType, seatingCapacity, exShowroomPrice]) => ({
    code,
    make,
    model,
    variant,
    cubicCapacity,
    fuelType,
    seatingCapacity,
    exShowroomPrice,
  }),
);

const BY_CODE = new Map(VEHICLE_CATALOG.map((item) => [item.code, item]));

export function findVariant(code: string) {
  return BY_CODE.get(code);
}

export const VEHICLE_FIELDS = ["Make", "Model", "VariantName", "CubicCapacity", "FuelType", "SeatingCapacity", "ExShowroomPrice"];

export function vehicleFields(code: string): Record<string, string> {
  const item = findVariant(code);
  if (!item) return Object.fromEntries(VEHICLE_FIELDS.map((field) => [field, ""]));
  return {
    Make: item.make,
    Model: item.model,
    VariantName: item.variant,
    CubicCapacity: String(item.cubicCapacity),
    FuelType: item.fuelType,
    SeatingCapacity: String(item.seatingCapacity),
    ExShowroomPrice: String(item.exShowroomPrice),
  };
}
