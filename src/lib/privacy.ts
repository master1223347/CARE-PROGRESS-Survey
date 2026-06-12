const riskyPatterns = [
  /\b\d{12}\b/,
  /\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/,
  /\b[A-Z]{2,5}[-\s]?\d{4,}\b/i,
  /\b(?:mrn|uhid|aadhaar|aadhar|phone|mobile|patient|name)\b/i,
  /@/,
];

export function hasIdentifierRisk(value: string) {
  const compact = value.trim();
  if (!compact) return false;
  return riskyPatterns.some((pattern) => pattern.test(compact));
}

export function identifierRiskMessage(value: string) {
  return hasIdentifierRisk(value)
    ? "This looks like it may contain a patient identifier. Replace it with an L001-style loop code."
    : "";
}
