import type { DeliveryAddress } from "@/lib/firebase-types";

export const emptyDeliveryAddress: DeliveryAddress = {
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  references: "",
};

type AddressLine = {
  label: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeDeliveryAddress(
  value: unknown
): DeliveryAddress | null {
  if (!isRecord(value)) return null;

  const address: DeliveryAddress = {
    street: readString(value.street),
    exteriorNumber: readString(value.exteriorNumber, 40),
    interiorNumber: readString(value.interiorNumber, 40),
    neighborhood: readString(value.neighborhood),
    city: readString(value.city),
    state: readString(value.state),
    zipCode: readString(value.zipCode, 5),
    references: readString(value.references, 300),
  };

  const hasAnyValue = Object.values(address).some(Boolean);
  return hasAnyValue ? address : null;
}

export function isValidZipCode(zipCode: string) {
  return /^\d{5}$/.test(zipCode.trim());
}

export function getDeliveryAddressValidationMessage(
  address: DeliveryAddress
) {
  if (!address.street.trim()) return "Agrega la calle.";
  if (!address.exteriorNumber.trim()) {
    return "Agrega el número exterior.";
  }
  if (!address.neighborhood.trim()) return "Agrega la colonia.";
  if (!address.city.trim()) {
    return "Agrega el municipio o ciudad.";
  }
  if (!address.state.trim()) return "Agrega el estado.";
  if (!isValidZipCode(address.zipCode)) {
    return "Agrega un código postal válido.";
  }

  return "";
}

export function getDeliveryAddressLines(
  address: DeliveryAddress | null | undefined,
  options: {
    numberLabel?: string;
    interiorLabel?: string;
    cityLabel?: string;
    zipLabel?: string;
  } = {}
): AddressLine[] {
  if (!address) return [];

  const numberLabel = options.numberLabel ?? "Número exterior";
  const interiorLabel = options.interiorLabel ?? "Interior";
  const cityLabel = options.cityLabel ?? "Municipio / Ciudad";
  const zipLabel = options.zipLabel ?? "Código postal";
  const lines: AddressLine[] = [
    { label: "Calle", value: address.street },
    { label: numberLabel, value: address.exteriorNumber },
    { label: interiorLabel, value: address.interiorNumber ?? "" },
    { label: "Colonia", value: address.neighborhood },
    { label: cityLabel, value: address.city },
    { label: "Estado", value: address.state },
    { label: zipLabel, value: address.zipCode },
    { label: "Referencias", value: address.references ?? "" },
  ];

  return lines.filter((line) => line.value.trim());
}

export function formatDeliveryAddressText(
  address: DeliveryAddress | null | undefined,
  options: {
    numberLabel?: string;
    interiorLabel?: string;
    cityLabel?: string;
    zipLabel?: string;
  } = {}
) {
  return getDeliveryAddressLines(address, options)
    .map((line) => `${line.label}: ${line.value}`)
    .join("\n");
}
