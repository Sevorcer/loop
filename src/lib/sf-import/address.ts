const STREET_SUFFIXES: Record<string, string> = {
  street: "st",
  avenue: "ave",
  boulevard: "blvd",
  drive: "dr",
  road: "rd",
  lane: "ln",
  court: "ct",
  place: "pl",
  terrace: "ter",
  circle: "cir",
  highway: "hwy",
  parkway: "pkwy",
  trail: "trl",
  alley: "aly",
  square: "sq",
  plaza: "plz",
  point: "pt",
  ridge: "rdg",
  crossing: "xing",
  crescent: "cres",
};

const DIRECTIONS: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

/** Compare streets without caring about case, punctuation, or St vs Street. */
export function normalizeStreet(street: string): string {
  const cleaned = street
    .toLowerCase()
    .replace(/[#.,]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  return cleaned
    .split(" ")
    .map((part) => STREET_SUFFIXES[part] ?? DIRECTIONS[part] ?? part)
    .join(" ");
}

/** First five digits, so 98101-1234 matches 98101. */
export function normalizeZip(zip: string): string {
  const digits = zip.replace(/\D/g, "");
  return digits.slice(0, 5);
}

/**
 * Key used to attach a job to a saved location.
 * The unit (street line 2) is not part of the key. Service Fusion locations have no id.
 * When the zip is missing, the city keeps two different towns from collapsing together.
 */
export function addressMatchKey(street: string, zip: string, city = ""): string | null {
  const streetKey = normalizeStreet(street);
  if (!streetKey) return null;
  const zipKey = normalizeZip(zip);
  if (zipKey) return `${streetKey}|${zipKey}`;
  const cityKey = city
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${streetKey}|${cityKey}`;
}

export function normalizeState(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const named = STATE_NAMES[trimmed.toLowerCase().replace(/\s+/g, " ")];
  if (named) return named;
  return trimmed.slice(0, 32);
}
