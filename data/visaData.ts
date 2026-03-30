export type VisaCategory =
  | "visa-free"
  | "visa-on-arrival"
  | "evisa"
  | "visa-required"
  | "home";

// Visa types you can hold
export type HeldVisaType = "us" | "schengen" | "uk" | "canada" | "australia";

export interface VisaBenefit {
  category: VisaCategory; // what category this upgrades to
  days?: number;
  notes?: string;
}

export interface CountryVisa {
  name: string;
  code: string; // ISO 3166-1 alpha-3
  category: VisaCategory; // base category (Indian passport only)
  days?: number;
  notes?: string;
  applyAt?: string;
  restrictions?: string;
  usVisaBenefit?: boolean; // legacy compat — will be derived from visaBenefits
  visaBenefits?: Partial<Record<HeldVisaType, VisaBenefit>>; // benefits from holding other visas
  lastVerified?: string; // ISO date when this entry was last verified, e.g. "2026-03"
}

// Metadata for each visa type you can add
export interface VisaTypeInfo {
  id: HeldVisaType;
  label: string;
  flag: string;
  description: string;
  color: string;
}

export const availableVisas: VisaTypeInfo[] = [
  { id: "us", label: "US Visa", flag: "🇺🇸", description: "B1/B2 Visitor Visa", color: "#f4a261" },
  { id: "schengen", label: "Schengen Visa", flag: "🇪🇺", description: "Type C Short-Stay", color: "#2a9d8f" },
  { id: "uk", label: "UK Visa", flag: "🇬🇧", description: "Standard Visitor", color: "#e9c46a" },
  { id: "canada", label: "Canada Visa", flag: "🇨🇦", description: "Temporary Resident", color: "#e76f51" },
  { id: "australia", label: "Australia Visa", flag: "🇦🇺", description: "Visitor (subclass 600)", color: "#7ec8c0" },
];

// Comprehensive data for Indian passport holders WITH a valid US visa (B1/B2 stamp)
// Sources: Henley Passport Index, IATA Timatic, various embassy websites
// Last updated: March 2026

export const visaData: CountryVisa[] = [
  // HOME
  { name: "India", code: "IND", category: "visa-free", notes: "Indian passport holder home-country access." },

  // ===== VISA-FREE =====
  {
    name: "Bhutan",
    code: "BTN",
    category: "visa-free",
    notes: "No visa required. Permit issued on arrival. Sustainable Development Fee applies.",
  },
  {
    name: "Nepal",
    code: "NPL",
    category: "visa-free",
    notes: "No visa required for Indian citizens. Unlimited stay.",
  },
  {
    name: "Serbia",
    code: "SRB",
    category: "visa-free",
    days: 30,
    notes: "Visa-free for up to 30 days within a 12-month period.",
  },
  {
    name: "Mauritius",
    code: "MUS",
    category: "visa-free",
    days: 90,
    notes: "Free visa on arrival. Must have return ticket and hotel booking.",
  },
  {
    name: "Indonesia",
    code: "IDN",
    category: "visa-free",
    days: 30,
    notes: "Visa-free for tourism at designated ports. Can be extended once for another 30 days.",
  },
  {
    name: "Tunisia",
    code: "TUN",
    category: "visa-free",
    days: 90,
    notes: "Visa-free entry for up to 90 days.",
  },
  {
    name: "Barbados",
    code: "BRB",
    category: "visa-free",
    days: 90,
    notes: "No visa required for stays up to 90 days.",
  },
  {
    name: "Dominica",
    code: "DMA",
    category: "visa-free",
    days: 21,
    notes: "Visa-free for up to 21 days.",
  },
  {
    name: "Grenada",
    code: "GRD",
    category: "visa-free",
    days: 90,
    notes: "No visa required for stays up to 90 days.",
  },
  {
    name: "Haiti",
    code: "HTI",
    category: "visa-free",
    days: 90,
    notes: "Visa-free for up to 3 months. Travel advisory in effect.",
  },
  {
    name: "Jamaica",
    code: "JAM",
    category: "visa-free",
    days: 30,
    notes: "No visa needed for stays up to 30 days for tourism.",
  },
  {
    name: "Saint Kitts and Nevis",
    code: "KNA",
    category: "visa-free",
    days: 90,
    notes: "Visa-free entry for tourism.",
  },
  {
    name: "Saint Vincent and the Grenadines",
    code: "VCT",
    category: "visa-free",
    days: 30,
    notes: "No visa required for up to 30 days.",
  },
  {
    name: "Trinidad and Tobago",
    code: "TTO",
    category: "visa-free",
    days: 90,
    notes: "Visa-free for up to 90 days.",
  },
  {
    name: "Fiji",
    code: "FJI",
    category: "visa-free",
    days: 120,
    notes: "Visa-free for 4 months. Extension possible.",
  },
  {
    name: "Micronesia",
    code: "FSM",
    category: "visa-free",
    days: 30,
    notes: "Visa-free entry.",
  },
  {
    name: "Vanuatu",
    code: "VUT",
    category: "visa-free",
    days: 30,
    notes: "Visa-free for 30 days.",
  },
  {
    name: "El Salvador",
    code: "SLV",
    category: "visa-free",
    days: 90,
    notes: "No visa needed for stays up to 90 days.",
  },
  {
    name: "Qatar",
    code: "QAT",
    category: "visa-free",
    days: 30,
    notes: "Visa waiver for 30 days. Can be extended for another 30 days.",
  },
  {
    name: "Hong Kong",
    code: "HKG",
    category: "visa-free",
    days: 14,
    notes: "Visa-free for up to 14 days for tourism.",
  },
  {
    name: "Macao",
    code: "MAC",
    category: "visa-free",
    days: 30,
    notes: "Visa-free for up to 30 days.",
  },

  // ===== VISA ON ARRIVAL =====
  {
    name: "Thailand",
    code: "THA",
    category: "visa-free",
    days: 60,
    notes: "Visa-free for 60 days (updated late 2024). Must have passport valid 6 months, return ticket, and accommodation proof.",
    lastVerified: "2026-03",
  },
  {
    name: "Cambodia",
    code: "KHM",
    category: "visa-on-arrival",
    days: 30,
    notes: "Tourist visa on arrival. Fee: $30. Need 1 passport photo.",
  },
  {
    name: "Laos",
    code: "LAO",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at international airports and select border crossings. Fee: $30–$42.",
  },
  {
    name: "Maldives",
    code: "MDV",
    category: "visa-on-arrival",
    days: 30,
    notes: "Free visa on arrival for 30 days. Must have hotel booking and return ticket.",
  },
  {
    name: "Seychelles",
    code: "SYC",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visitor permit issued on arrival. Free. Must show hotel booking and return ticket.",
  },
  {
    name: "Madagascar",
    code: "MDG",
    category: "visa-on-arrival",
    days: 90,
    notes: "Visa on arrival. Fee: ~€35 for 30 days, €40 for 60 days.",
  },
  {
    name: "Jordan",
    code: "JOR",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at Queen Alia International Airport. Fee: 40 JOD. Jordan Pass recommended.",
  },
  {
    name: "Bolivia",
    code: "BOL",
    category: "visa-on-arrival",
    days: 90,
    notes: "Tourist visa on arrival at major airports. Fee: $52.",
  },
  {
    name: "Ethiopia",
    code: "ETH",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at Addis Ababa Bole Airport only. Fee: $52 (30 days) / $72 (90 days).",
  },
  {
    name: "Tanzania",
    code: "TZA",
    category: "visa-on-arrival",
    days: 90,
    notes: "Visa on arrival. Fee: $50. Single entry.",
  },
  {
    name: "Kenya",
    code: "KEN",
    category: "visa-on-arrival",
    days: 90,
    notes: "Electronic Travel Authorization (eTA) required before travel. Fee: ~$30.",
  },
  {
    name: "Rwanda",
    code: "RWA",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival. Fee: $50. Also available as East Africa Tourist Visa.",
  },
  {
    name: "Uganda",
    code: "UGA",
    category: "visa-on-arrival",
    days: 90,
    notes: "Visa on arrival at Entebbe. Fee: $50 single entry.",
  },
  {
    name: "Mozambique",
    code: "MOZ",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at major entry points. Fee: $50.",
  },
  {
    name: "Somalia",
    code: "SOM",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival. Check latest travel advisory before visiting.",
    restrictions: "Extremely high security risk. Travel strongly discouraged.",
  },
  {
    name: "Togo",
    code: "TGO",
    category: "visa-on-arrival",
    days: 7,
    notes: "Visa on arrival at Lomé airport. Fee: ~10,000 CFA (~$17). Extendable.",
  },
  {
    name: "Comoros",
    code: "COM",
    category: "visa-on-arrival",
    days: 45,
    notes: "Visa on arrival. Fee: ~€30.",
  },
  {
    name: "Guinea-Bissau",
    code: "GNB",
    category: "visa-on-arrival",
    days: 90,
    notes: "Visa on arrival at Bissau airport.",
  },
  {
    name: "Mauritania",
    code: "MRT",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at Nouakchott airport. Fee: ~€55.",
  },
  {
    name: "Sierra Leone",
    code: "SLE",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival. Fee: $80.",
  },
  {
    name: "Timor-Leste",
    code: "TLS",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at Dili airport. Fee: $30.",
  },
  {
    name: "Palau",
    code: "PLW",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival. Free for 30 days. Pristine Palau Pledge required.",
  },
  {
    name: "Tuvalu",
    code: "TUV",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival. Free.",
  },
  {
    name: "Marshall Islands",
    code: "MHL",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa issued on arrival.",
  },
  {
    name: "Samoa",
    code: "WSM",
    category: "visa-on-arrival",
    days: 60,
    notes: "Entry permit on arrival. Free for 60 days.",
  },

  // ===== COUNTRIES UNLOCKABLE BY HELD VISAS =====
  // Base category = what Indian passport gets WITHOUT any other visa
  // The visaBenefitsMap handles upgrades when you hold US/Schengen/UK etc.
  { name: "Mexico", code: "MEX", category: "visa-required", notes: "Visa required for Indian passport. With a valid US visa, you get visa-free entry up to 180 days.", lastVerified: "2026-03" },
  { name: "Panama", code: "PAN", category: "visa-required", notes: "Visa required. Unlocked with US visa." },
  { name: "Costa Rica", code: "CRI", category: "visa-required", notes: "Visa required. Unlocked with US visa (must have been used once)." },
  { name: "Colombia", code: "COL", category: "visa-required", notes: "Visa required for Indian passport. With a valid US visa (B1/B2 or multiple-entry), you get visa-free entry up to 90 days.", lastVerified: "2026-03" },
  { name: "Georgia", code: "GEO", category: "visa-required", notes: "Visa required. Unlocked with US or Schengen visa." },
  { name: "Albania", code: "ALB", category: "visa-required", notes: "Visa required. Unlocked with US or Schengen visa." },
  { name: "North Macedonia", code: "MKD", category: "visa-required", notes: "Visa required. Unlocked with US or Schengen visa." },
  { name: "Philippines", code: "PHL", category: "visa-free", days: 14, notes: "Visa-free for 14 days (since June 2025). Passport must be valid 6 months. Need return ticket, hotel booking, proof of funds. Non-extendable.", lastVerified: "2026-03" },
  { name: "Turkey", code: "TUR", category: "visa-required", notes: "Visa required. eVisa available with US/Schengen/UK visa.", applyAt: "https://www.evisa.gov.tr" },
  { name: "South Korea", code: "KOR", category: "visa-required", notes: "Visa required. Transit tourism available with US visa.", restrictions: "Must be transiting — direct India-Korea flights may not qualify. Check K-ETA requirements." },
  { name: "Taiwan", code: "TWN", category: "visa-required", notes: "Visa required. Unlocked with US visa (used at least once)." },
  { name: "Oman", code: "OMN", category: "visa-required", notes: "Visa required. Visa on arrival with US/UK/Schengen visa." },
  { name: "Belize", code: "BLZ", category: "visa-required", notes: "Visa required. Unlocked with US visa." },
  { name: "Honduras", code: "HND", category: "visa-required", notes: "Visa required. Unlocked with US visa." },
  { name: "Guatemala", code: "GTM", category: "visa-required", notes: "Visa required. Unlocked with US visa." },
  { name: "Nicaragua", code: "NIC", category: "visa-required", notes: "Visa required. Unlocked with US visa. Tourist card fee: $10." },
  { name: "Dominican Republic", code: "DOM", category: "visa-required", notes: "Visa required. Tourist card on arrival." },
  { name: "Peru", code: "PER", category: "visa-required", notes: "Visa required. Unlocked with US visa (6+ months validity)." },
  { name: "Bosnia and Herzegovina", code: "BIH", category: "visa-required", notes: "Visa required. Unlocked with US/Schengen/UK visa." },
  { name: "Montenegro", code: "MNE", category: "visa-required", notes: "Visa required. Unlocked with US or Schengen visa." },
  { name: "Kosovo", code: "XKX", category: "visa-required", notes: "Visa required. Unlocked with US or Schengen visa." },
  {
    name: "United Arab Emirates",
    code: "ARE",
    category: "visa-on-arrival",
    days: 14,
    notes: "14-day visa on arrival. Can be extended. Also available as 30-day eVisa.",
  },
  {
    name: "Singapore",
    code: "SGP",
    category: "evisa",
    days: 30,
    notes: "eVisa required. US visa holders may get faster processing. Apply via Singapore's ICA website.",
    applyAt: "https://www.ica.gov.sg",
  },

  // ===== eVISA =====
  {
    name: "Sri Lanka",
    code: "LKA",
    category: "evisa",
    days: 30,
    notes: "Electronic Travel Authorization (ETA). Fee: $50. Extendable to 90 days.",
    applyAt: "https://www.srilankaeta.gov.lk",
  },
  {
    name: "Myanmar",
    code: "MMR",
    category: "evisa",
    days: 28,
    notes: "eVisa for tourism. Fee: $50. Takes 3 business days.",
    applyAt: "https://evisa.moip.gov.mm",
  },
  {
    name: "Vietnam",
    code: "VNM",
    category: "evisa",
    days: 90,
    notes: "eVisa for 90 days single/multiple entry. Fee: $25.",
    applyAt: "https://evisa.xuatnhapcanh.gov.vn",
  },
  {
    name: "Malaysia",
    code: "MYS",
    category: "evisa",
    days: 30,
    notes: "eNTRI (electronic travel registration) or eVisa. eNTRI free for 15 days; eVisa for 30 days.",
    applyAt: "https://www.windowmalaysia.my",
  },
  {
    name: "Azerbaijan",
    code: "AZE",
    category: "evisa",
    days: 30,
    notes: "ASAN eVisa. Fee: $26. Processed in 3 hours.",
    applyAt: "https://evisa.gov.az",
  },
  {
    name: "Armenia",
    code: "ARM",
    category: "evisa",
    days: 120,
    notes: "eVisa for up to 120 days. Fee: $6 (21 day) / $31 (120 day).",
    applyAt: "https://evisa.mfa.am",
  },
  {
    name: "Bahrain",
    code: "BHR",
    category: "evisa",
    days: 14,
    notes: "eVisa. Fee: 29 BHD (~$77). Also available on arrival.",
    applyAt: "https://www.evisa.gov.bh",
  },
  {
    name: "Egypt",
    code: "EGY",
    category: "evisa",
    days: 30,
    notes: "eVisa for tourism. Fee: $25 (single entry) / $60 (multiple entry).",
    applyAt: "https://visa2egypt.gov.eg",
  },
  {
    name: "Morocco",
    code: "MAR",
    category: "evisa",
    days: 30,
    notes: "eVisa available. Apply online before travel.",
    applyAt: "https://www.acces-maroc.ma",
  },
  {
    name: "Uzbekistan",
    code: "UZB",
    category: "evisa",
    days: 30,
    notes: "eVisa. Fee: $20. Processed in 2 business days.",
    applyAt: "https://e-visa.gov.uz",
  },
  {
    name: "Kyrgyzstan",
    code: "KGZ",
    category: "evisa",
    days: 30,
    notes: "eVisa. Fee: $45-$70 depending on processing time.",
    applyAt: "https://www.evisa.e-gov.kg",
  },
  {
    name: "Tajikistan",
    code: "TJK",
    category: "evisa",
    days: 45,
    notes: "eVisa. Fee: $50 (+$20 for GBAO permit). Also visa on arrival at Dushanbe.",
    applyAt: "https://www.evisa.tj",
  },
  {
    name: "Australia",
    code: "AUS",
    category: "evisa",
    days: 90,
    notes: "Visitor visa (subclass 600). Apply online. Processing: 1–4 weeks. Fee: AUD $195.",
    applyAt: "https://immi.homeaffairs.gov.au",
  },
  {
    name: "New Zealand",
    code: "NZL",
    category: "evisa",
    days: 90,
    notes: "Visitor visa. Apply online. Processing: ~20 working days. Fee: NZD $211.",
    applyAt: "https://www.immigration.govt.nz",
  },
  {
    name: "Russia",
    code: "RUS",
    category: "evisa",
    days: 16,
    notes: "eVisa for 16 days. Fee: $40. Available for most entry points.",
    applyAt: "https://electronic-visa.kdmid.ru",
  },
  {
    name: "Ivory Coast",
    code: "CIV",
    category: "evisa",
    days: 90,
    notes: "eVisa required. Apply online.",
    applyAt: "https://snedai.com",
  },
  {
    name: "Djibouti",
    code: "DJI",
    category: "evisa",
    days: 31,
    notes: "eVisa. Fee: ~$23.",
    applyAt: "https://www.evisa.gouv.dj",
  },
  {
    name: "Gabon",
    code: "GAB",
    category: "evisa",
    days: 90,
    notes: "eVisa. Apply at least 72 hours before travel.",
    applyAt: "https://evisa.dgdi.ga",
  },
  {
    name: "Lesotho",
    code: "LSO",
    category: "evisa",
    days: 14,
    notes: "eVisa or visa on arrival. Fee: ~$50.",
  },
  {
    name: "Malawi",
    code: "MWI",
    category: "evisa",
    days: 30,
    notes: "eVisa. Fee: $50.",
    applyAt: "https://www.evisa.gov.mw",
  },
  {
    name: "South Africa",
    code: "ZAF",
    category: "evisa",
    days: 30,
    notes: "eVisa pilot available. Processing may take 5–10 days.",
    applyAt: "https://www.dha.gov.za",
  },
  {
    name: "Saudi Arabia",
    code: "SAU",
    category: "evisa",
    days: 90,
    notes: "Tourist eVisa. Fee: SAR 440 (~$117). Multiple entry, valid 1 year.",
    applyAt: "https://visa.visitsaudi.com",
  },
  {
    name: "Kuwait",
    code: "KWT",
    category: "evisa",
    days: 30,
    notes: "eVisa available. Fee: ~3 KWD. Also available on arrival.",
    applyAt: "https://evisa.moi.gov.kw",
  },
  {
    name: "Papua New Guinea",
    code: "PNG",
    category: "evisa",
    days: 60,
    notes: "eVisa. Fee: 100 PGK. Apply online.",
    applyAt: "https://evisa.ica.gov.pg",
  },
  {
    name: "Zimbabwe",
    code: "ZWE",
    category: "evisa",
    days: 30,
    notes: "eVisa or visa on arrival. Fee: $30 (single entry).",
    applyAt: "https://www.evisa.gov.zw",
  },
  {
    name: "Zambia",
    code: "ZMB",
    category: "evisa",
    days: 90,
    notes: "eVisa. Fee: $50 (single entry). KAZA UniVisa available with Zimbabwe.",
    applyAt: "https://www.zambiaimmigration.gov.zm",
  },
  {
    name: "Benin",
    code: "BEN",
    category: "evisa",
    days: 30,
    notes: "eVisa. Fee: ~€52.",
    applyAt: "https://evisa.gouv.bj",
  },
  {
    name: "Cameroon",
    code: "CMR",
    category: "evisa",
    days: 90,
    notes: "eVisa. Apply online.",
    applyAt: "https://www.ecamervisa.cm",
  },
  {
    name: "Burkina Faso",
    code: "BFA",
    category: "evisa",
    days: 30,
    notes: "eVisa available.",
    applyAt: "https://visaburkina.bf",
  },

  // ===== VISA REQUIRED (Major countries) =====
  {
    name: "United States",
    code: "USA",
    category: "visa-required",
    notes: "B1/B2 visa required. Unlocked when you hold a US visa.",
    applyAt: "https://ceac.state.gov/ceac",
  },
  {
    name: "United Kingdom",
    code: "GBR",
    category: "visa-free",
    notes: "Visa-free (home base with Leave to Remain).",
  },
  {
    name: "Canada",
    code: "CAN",
    category: "visa-required",
    notes: "Temporary Resident Visa required. Fee: CAD $100. Processing: 4–8 weeks.",
    applyAt: "https://www.canada.ca/en/immigration-refugees-citizenship",
    restrictions: "Biometrics required. Apply online via IRCC.",
  },
  {
    name: "Germany",
    code: "DEU",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80. Apply through VFS Global.",
    applyAt: "https://india.diplo.de",
    restrictions: "Valid for all 27 Schengen countries. Must apply at country of main destination.",
  },
  {
    name: "France",
    code: "FRA",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80. Apply through VFS Global.",
    applyAt: "https://france-visas.gouv.fr",
    restrictions: "Up to 90 days in any 180-day period across Schengen area.",
  },
  {
    name: "Italy",
    code: "ITA",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://vistoperitalia.esteri.it",
    restrictions: "Apply at Italian Embassy/VFS Global center.",
  },
  {
    name: "Spain",
    code: "ESP",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.exteriores.gob.es",
  },
  {
    name: "Netherlands",
    code: "NLD",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.netherlandsworldwide.nl",
  },
  {
    name: "Switzerland",
    code: "CHE",
    category: "visa-required",
    notes: "Schengen visa required. Fee: CHF 80.",
    applyAt: "https://www.eda.admin.ch",
  },
  {
    name: "Japan",
    code: "JPN",
    category: "visa-required",
    notes: "Tourist visa required. Free of charge. Processing: 4–5 working days.",
    applyAt: "https://www.in.emb-japan.go.jp",
    restrictions: "Apply through Japanese Embassy. No fee but must apply in person.",
  },
  {
    name: "China",
    code: "CHN",
    category: "visa-required",
    notes: "Tourist visa (L-visa) required. Fee: varies. Apply at Chinese Visa Application Center.",
    applyAt: "https://www.visaforchina.cn",
    restrictions: "144-hour transit visa exemption at select cities.",
  },
  {
    name: "Brazil",
    code: "BRA",
    category: "visa-required",
    notes: "Tourist visa required. Fee: ~$80. Apply at Brazilian Consulate.",
    applyAt: "https://formulario-mre.serpro.gov.br",
  },
  {
    name: "Argentina",
    code: "ARG",
    category: "visa-required",
    notes: "Tourist visa required. Apply at Argentine Consulate in India.",
    applyAt: "https://www.argentina.gob.ar",
  },
  {
    name: "Chile",
    code: "CHL",
    category: "visa-required",
    notes: "Tourist visa required. Apply at Chilean Consulate.",
    applyAt: "https://www.chile.gob.cl",
  },
  {
    name: "Sweden",
    code: "SWE",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.migrationsverket.se",
  },
  {
    name: "Norway",
    code: "NOR",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.udi.no",
  },
  {
    name: "Denmark",
    code: "DNK",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.nyidanmark.dk",
  },
  {
    name: "Finland",
    code: "FIN",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://um.fi",
  },
  {
    name: "Portugal",
    code: "PRT",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.vistos.mne.gov.pt",
  },
  {
    name: "Greece",
    code: "GRC",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.mfa.gr",
  },
  {
    name: "Austria",
    code: "AUT",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.bmeia.gv.at",
  },
  {
    name: "Belgium",
    code: "BEL",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://dofi.ibz.be",
  },
  {
    name: "Poland",
    code: "POL",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.gov.pl",
  },
  {
    name: "Czech Republic",
    code: "CZE",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://www.mzv.cz",
  },
  {
    name: "Hungary",
    code: "HUN",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80.",
    applyAt: "https://konzuliszolgalat.kormany.hu",
  },
  {
    name: "Croatia",
    code: "HRV",
    category: "visa-required",
    notes: "Schengen visa required (Croatia joined Schengen in 2023). Fee: €80.",
    applyAt: "https://mvep.gov.hr",
  },
  {
    name: "Romania",
    code: "ROU",
    category: "visa-required",
    notes: "National visa or Schengen visa accepted. Fee: €80.",
    applyAt: "https://www.mae.ro",
  },
  {
    name: "Bulgaria",
    code: "BGR",
    category: "visa-required",
    notes: "National visa or Schengen visa accepted. Fee: €80.",
    applyAt: "https://www.mfa.bg",
  },
  {
    name: "Ireland",
    code: "IRL",
    category: "visa-required",
    notes: "Short stay visa required. Fee: €60 (single) / €100 (multi). Not part of Schengen.",
    applyAt: "https://www.irishimmigration.ie",
  },
  {
    name: "Iceland",
    code: "ISL",
    category: "visa-required",
    notes: "Schengen visa required. Fee: €80. Apply through Danish Embassy.",
    applyAt: "https://www.government.is",
  },
  {
    name: "Israel",
    code: "ISR",
    category: "visa-required",
    notes: "Tourist visa required. Apply at Israeli Embassy in India.",
    applyAt: "https://embassies.gov.il",
  },
  {
    name: "Pakistan",
    code: "PAK",
    category: "visa-required",
    notes: "Visa required. Apply through Pakistan High Commission. Limited issuance.",
    applyAt: "https://visa.nadra.gov.pk",
    restrictions: "Political tensions may affect processing. Group pilgrim visas available for religious sites.",
  },
  {
    name: "Bangladesh",
    code: "BGD",
    category: "visa-on-arrival",
    days: 30,
    notes: "Visa on arrival at Dhaka airport. Fee: varies by nationality.",
  },
  {
    name: "Nigeria",
    code: "NGA",
    category: "visa-required",
    notes: "Visa required. Apply at Nigerian High Commission.",
    applyAt: "https://portal.immigration.gov.ng",
  },
  {
    name: "Ghana",
    code: "GHA",
    category: "visa-required",
    notes: "Visa required. Apply at Ghanaian High Commission in India.",
    applyAt: "https://www.ghanaimmigration.org",
  },
  {
    name: "Ecuador",
    code: "ECU",
    category: "visa-free",
    days: 90,
    notes: "Visa-free for 90 days for Indian passport holders.",
  },
  {
    name: "Cuba",
    code: "CUB",
    category: "visa-required",
    notes: "Tourist card (tarjeta de turista) required. Available from Cuban Embassy or airlines.",
    applyAt: "Cuban Embassy in New Delhi",
  },

  // ===== ADDITIONAL COUNTRIES (filling map gaps) =====
  // Europe
  { name: "Estonia", code: "EST", category: "visa-required", notes: "Schengen visa required. Fee: €80." },
  { name: "Latvia", code: "LVA", category: "visa-required", notes: "Schengen visa required. Fee: €80." },
  { name: "Lithuania", code: "LTU", category: "visa-required", notes: "Schengen visa required. Fee: €80." },
  { name: "Luxembourg", code: "LUX", category: "visa-required", notes: "Schengen visa required. Fee: €80." },
  { name: "Slovakia", code: "SVK", category: "visa-required", notes: "Schengen visa required. Fee: €80." },
  { name: "Slovenia", code: "SVN", category: "visa-required", notes: "Schengen visa required. Fee: €80." },
  { name: "Moldova", code: "MDA", category: "visa-required", notes: "Visa required. Apply at Moldovan Embassy." },
  { name: "Ukraine", code: "UKR", category: "visa-required", notes: "Visa required. Travel advisory in effect due to conflict.", restrictions: "Active conflict zone. Travel strongly discouraged." },
  { name: "Belarus", code: "BLR", category: "visa-required", notes: "Visa required. Apply at Belarusian Embassy." },
  { name: "Cyprus", code: "CYP", category: "visa-required", notes: "Visa required. Schengen visa holders may enter." },

  // Central Asia
  { name: "Kazakhstan", code: "KAZ", category: "visa-required", notes: "Visa required. eVisa available for some purposes." },
  { name: "Mongolia", code: "MNG", category: "visa-required", notes: "Visa required. Apply at Mongolian Embassy." },
  { name: "Turkmenistan", code: "TKM", category: "visa-required", notes: "Visa required. One of the hardest visas to obtain. Letter of invitation needed." },

  // Middle East
  { name: "Iraq", code: "IRQ", category: "visa-required", notes: "Visa required. Apply at Iraqi Embassy.", restrictions: "High security risk in many regions." },
  { name: "Iran", code: "IRN", category: "visa-on-arrival", days: 30, notes: "Visa on arrival at major airports for Indian passport holders. Fee: ~€75." },
  { name: "Syria", code: "SYR", category: "visa-required", notes: "Visa required. Embassy largely non-functional due to conflict.", restrictions: "Active conflict zone. Travel strongly discouraged." },
  { name: "Lebanon", code: "LBN", category: "visa-required", notes: "Visa required. Apply at Lebanese Embassy." },
  { name: "Yemen", code: "YEM", category: "visa-required", notes: "Visa required.", restrictions: "Active conflict zone. Travel strongly discouraged." },

  // Africa
  { name: "Algeria", code: "DZA", category: "visa-required", notes: "Visa required. Apply at Algerian Embassy in New Delhi." },
  { name: "Libya", code: "LBY", category: "visa-required", notes: "Visa required.", restrictions: "Highly unstable. Travel strongly discouraged." },
  { name: "Sudan", code: "SDN", category: "visa-required", notes: "Visa required. Apply at Sudanese Embassy.", restrictions: "Ongoing conflict. Travel discouraged." },
  { name: "South Sudan", code: "SSD", category: "visa-required", notes: "Visa required.", restrictions: "Extremely unstable. Travel strongly discouraged." },
  { name: "Chad", code: "TCD", category: "visa-required", notes: "Visa required. Apply at Chadian Embassy." },
  { name: "Niger", code: "NER", category: "visa-required", notes: "Visa required. Apply at Niger Embassy." },
  { name: "Mali", code: "MLI", category: "visa-required", notes: "Visa required.", restrictions: "Security concerns in northern regions." },
  { name: "Senegal", code: "SEN", category: "visa-required", notes: "Visa required. eVisa may be available." },
  { name: "Gambia", code: "GMB", category: "visa-required", notes: "Visa required." },
  { name: "Guinea", code: "GIN", category: "visa-required", notes: "Visa required. Apply at Guinean Embassy." },
  { name: "Eritrea", code: "ERI", category: "visa-required", notes: "Visa required. One of the hardest to obtain." },
  { name: "Central African Republic", code: "CAF", category: "visa-required", notes: "Visa required.", restrictions: "Extremely unstable. Travel strongly discouraged." },
  { name: "Equatorial Guinea", code: "GNQ", category: "visa-required", notes: "Visa required." },
  { name: "Republic of the Congo", code: "COG", category: "visa-required", notes: "Visa required. Apply at Congolese Embassy." },
  { name: "DR Congo", code: "COD", category: "visa-required", notes: "Visa required.", restrictions: "Security concerns in eastern regions." },
  { name: "Burundi", code: "BDI", category: "visa-required", notes: "Visa required. Visa on arrival sometimes available." },
  { name: "Namibia", code: "NAM", category: "visa-required", notes: "Visa required. Apply at Namibian Embassy." },
  { name: "Botswana", code: "BWA", category: "visa-required", notes: "Visa required. Apply at Botswanan High Commission." },
  { name: "Eswatini", code: "SWZ", category: "visa-required", notes: "Visa required." },
  { name: "Liberia", code: "LBR", category: "visa-required", notes: "Visa required." },
  { name: "Angola", code: "AGO", category: "evisa", days: 30, notes: "eVisa available. Fee: $120. Apply online.", applyAt: "https://www.smevisa.gov.ao" },

  // South America
  { name: "Venezuela", code: "VEN", category: "visa-required", notes: "Visa required. Apply at Venezuelan Embassy.", restrictions: "Political instability. Travel discouraged." },
  { name: "Paraguay", code: "PRY", category: "visa-required", notes: "Visa required. Apply at Paraguayan Consulate." },
  { name: "Uruguay", code: "URY", category: "visa-required", notes: "Visa required. Apply at Uruguayan Embassy." },
  { name: "Suriname", code: "SUR", category: "visa-required", notes: "Visa required. Tourist card available." },
  { name: "Guyana", code: "GUY", category: "visa-required", notes: "Visa required. Apply at Guyanese Embassy." },

  // East Asia
  { name: "North Korea", code: "PRK", category: "visa-required", notes: "Visa required. Only organized tours permitted.", restrictions: "Extremely restricted access. Government-controlled tours only." },
];

// Color scheme for categories
export const categoryColors: Record<VisaCategory, string> = {
  "visa-free": "#2a9d8f",
  "visa-on-arrival": "#e9c46a",
  evisa: "#f4a261",
  "visa-required": "#e76f51",
  home: "#2a9d8f",
};

export const categoryLabels: Record<VisaCategory, string> = {
  "visa-free": "Visa Free",
  "visa-on-arrival": "Visa on Arrival",
  evisa: "eVisa",
  "visa-required": "Visa Required",
  home: "Home",
};

export const categoryDescriptions: Record<VisaCategory, string> = {
  "visa-free": "No visa needed — just show up with your passport",
  "visa-on-arrival": "Get your visa stamp at the airport on landing",
  evisa: "Apply online before you travel",
  "visa-required": "Embassy visit or application required",
  home: "Your home country",
};

// ===== VISA BENEFITS LOOKUP =====
// Maps country code -> which held visas unlock better access
// This is separate from the base data so it's easy to extend

export const visaBenefitsMap: Record<string, Partial<Record<HeldVisaType, VisaBenefit>>> = {
  // ----- US VISA BENEFITS -----
  USA: { us: { category: "visa-free", notes: "You have a valid B1/B2 visa. Good to travel!" } },
  MEX: { us: { category: "visa-free", days: 180, notes: "Visa-free with valid US visa for up to 180 days." } },
  PAN: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid US visa." } },
  CRI: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid US visa (must have been used once)." } },
  COL: { us: { category: "visa-free", days: 90, notes: "Visa-free with valid US visa (B1/B2 or multiple-entry)." } },
  GEO: { us: { category: "visa-free", days: 90, notes: "Visa-free with valid US visa or residence permit." } },
  ALB: { us: { category: "visa-free", days: 90, notes: "Visa-free with valid multi-entry US visa." } },
  MKD: { us: { category: "visa-free", days: 15, notes: "Visa-free with valid US visa." } },
  PHL: { us: { category: "visa-free", days: 30, notes: "30 days visa-free with valid US visa (also accepts Japan, Australia, Canada, Schengen, Singapore, UK visas)." } },
  TUR: { us: { category: "evisa", days: 30, notes: "eVisa available with valid US visa. Fee: $50." } },
  KOR: { us: { category: "visa-free", days: 30, notes: "Transit tourism up to 30 days with valid US visa." } },
  TWN: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid US visa (used at least once)." } },
  OMN: { us: { category: "visa-on-arrival", days: 14, notes: "Visa on arrival with valid US/UK/Schengen visa." } },
  BLZ: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid US visa." } },
  HND: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid US visa." } },
  GTM: { us: { category: "visa-free", days: 90, notes: "Visa-free with valid US visa." } },
  NIC: { us: { category: "visa-free", days: 90, notes: "Visa-free with valid US visa. Tourist card: $10." } },
  DOM: { us: { category: "visa-free", days: 30, notes: "Tourist card on arrival. No visa needed." } },
  PER: { us: { category: "visa-free", days: 183, notes: "Visa-free with valid US visa (6+ months validity)." } },
  BIH: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid multi-entry US/Schengen/UK visa." } },
  MNE: { us: { category: "visa-free", days: 30, notes: "Visa-free with valid US visa (multi-entry)." } },
  XKX: { us: { category: "visa-free", days: 15, notes: "Visa-free with valid US or Schengen multi-entry visa." } },

  // ----- SCHENGEN VISA BENEFITS -----
  // Schengen zone countries — direct access with Schengen visa
  DEU: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  FRA: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  ITA: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  ESP: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  NLD: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  CHE: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  SWE: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  NOR: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  DNK: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  FIN: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  PRT: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  GRC: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  AUT: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  BEL: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  POL: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  CZE: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  HUN: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  HRV: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone (joined 2023). 90 days in 180." } },
  ISL: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  // Countries outside Schengen that accept Schengen visa
  ROU: { schengen: { category: "visa-free", days: 90, notes: "Accepts valid Schengen visa for entry." } },
  BGR: { schengen: { category: "visa-free", days: 90, notes: "Accepts valid Schengen visa for entry." } },
  CYP: { schengen: { category: "visa-free", days: 90, notes: "Accepts valid Schengen visa for entry. Not in Schengen zone." } },

  // ----- UK VISA BENEFITS -----
  GBR: { uk: { category: "visa-free", notes: "You have a valid UK Standard Visitor Visa." } },
  IRL: { uk: { category: "visa-free", days: 90, notes: "Short Stay Visa Waiver with valid UK visa (BIVS)." } },
  // Some countries accept UK visa too
  GIB: { uk: { category: "visa-free", days: 90, notes: "Access with valid UK visa." } },

  // ----- CANADA VISA BENEFITS -----
  CAN: { canada: { category: "visa-free", notes: "You have a valid Canadian TRV." } },

  // ----- AUSTRALIA VISA BENEFITS -----
  AUS: { australia: { category: "visa-free", notes: "You have a valid Australian visitor visa." } },
  NZL: { australia: { category: "evisa", days: 90, notes: "Easier processing with Australian visa history." } },

  // Additional Schengen zone countries
  EST: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  LVA: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  LTU: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  LUX: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  SVK: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
  SVN: { schengen: { category: "visa-free", days: 90, notes: "Schengen zone. 90 days in any 180-day period." } },
};

// Merge multiple visa benefits for countries that accept more than one
// (e.g., Bosnia accepts both US and Schengen, Oman accepts US/UK/Schengen)
const mergeBenefits = (code: string, extra: Partial<Record<HeldVisaType, VisaBenefit>>) => {
  visaBenefitsMap[code] = { ...visaBenefitsMap[code], ...extra };
};

// Countries that accept MULTIPLE visa types
mergeBenefits("BIH", { schengen: { category: "visa-free", days: 30, notes: "Visa-free with valid Schengen visa." } });
mergeBenefits("MNE", { schengen: { category: "visa-free", days: 30, notes: "Visa-free with valid Schengen visa." } });
mergeBenefits("XKX", { schengen: { category: "visa-free", days: 15, notes: "Visa-free with valid Schengen visa." } });
mergeBenefits("ALB", { schengen: { category: "visa-free", days: 90, notes: "Visa-free with valid Schengen visa." } });
mergeBenefits("MKD", { schengen: { category: "visa-free", days: 15, notes: "Visa-free with valid Schengen visa." } });
mergeBenefits("OMN", { schengen: { category: "visa-on-arrival", days: 14, notes: "Visa on arrival with Schengen visa." }, uk: { category: "visa-on-arrival", days: 14, notes: "Visa on arrival with UK visa." } });
mergeBenefits("TUR", { schengen: { category: "evisa", days: 30, notes: "eVisa available with valid Schengen visa." }, uk: { category: "evisa", days: 30, notes: "eVisa available with valid UK visa." } });
mergeBenefits("GEO", { schengen: { category: "visa-free", days: 90, notes: "Visa-free with valid Schengen visa." } });

// Philippines accepts multiple visa types for 30-day stay
mergeBenefits("PHL", {
  schengen: { category: "visa-free", days: 30, notes: "30 days visa-free with valid Schengen visa." },
  uk: { category: "visa-free", days: 30, notes: "30 days visa-free with valid UK visa." },
  canada: { category: "visa-free", days: 30, notes: "30 days visa-free with valid Canada visa." },
  australia: { category: "visa-free", days: 30, notes: "30 days visa-free with valid Australia visa." },
});

// Helper: resolve a country's effective category given held visas
export function resolveCountry(
  country: CountryVisa,
  heldVisas: Set<HeldVisaType>
): { category: VisaCategory; days?: number; notes?: string; upgradedBy?: HeldVisaType[] } {
  const benefits = visaBenefitsMap[country.code];
  if (!benefits) {
    return { category: country.category, days: country.days, notes: country.notes };
  }

  const categoryRank: Record<VisaCategory, number> = {
    home: -1,
    "visa-free": 0,
    "visa-on-arrival": 1,
    evisa: 2,
    "visa-required": 3,
  };

  let bestCategory = country.category;
  let bestDays = country.days;
  let bestNotes = country.notes;
  const upgradedBy: HeldVisaType[] = [];

  for (const visa of heldVisas) {
    const benefit = benefits[visa];
    if (!benefit) continue;

    const benefitRank = categoryRank[benefit.category];
    const currentRank = categoryRank[bestCategory];

    // This visa provides an upgrade (or equal with more days)
    if (benefitRank < currentRank) {
      bestCategory = benefit.category;
      bestDays = benefit.days ?? bestDays;
      bestNotes = benefit.notes ?? bestNotes;
      upgradedBy.push(visa);
    } else if (benefitRank === currentRank && (benefit.days ?? 0) > (bestDays ?? 0)) {
      bestDays = benefit.days;
      bestNotes = benefit.notes ?? bestNotes;
      if (!upgradedBy.includes(visa)) upgradedBy.push(visa);
    } else if (benefitRank < categoryRank[country.category]) {
      // Still an upgrade from the base, even if not the best one
      if (!upgradedBy.includes(visa)) upgradedBy.push(visa);
    }
  }

  return { category: bestCategory, days: bestDays, notes: bestNotes, upgradedBy };
}

// Stats helper — now visa-aware
export function getStats(heldVisas?: Set<HeldVisaType>) {
  const held = heldVisas ?? new Set<HeldVisaType>(["us"]);
  const resolved = visaData.map((c) => ({ ...c, ...resolveCountry(c, held) }));

  const visaFree = resolved.filter((c) => c.category === "visa-free").length;
  const voa = resolved.filter((c) => c.category === "visa-on-arrival").length;
  const evisa = resolved.filter((c) => c.category === "evisa").length;
  const required = resolved.filter((c) => c.category === "visa-required").length;

  // Count how many countries are upgraded by any held visa
  const upgraded = visaData.filter((c) => {
    const r = resolveCountry(c, held);
    return r.upgradedBy && r.upgradedBy.length > 0 && r.category !== c.category;
  }).length;

  return { visaFree, voa, evisa, required, upgraded, total: visaData.length };
}
