// Capital city coordinates for all countries in visaData.ts
// Lat/Lng values correspond to each country's capital city
// Used by the map view to place visa category markers

export interface Coordinate {
  lat: number;
  lng: number;
}

export const countryCoordinates: Record<string, Coordinate> = {
  // ─── South Asia ───────────────────────────────────────────────────────
  IND: { lat: 28.6139, lng: 77.209 }, // New Delhi
  PAK: { lat: 33.6844, lng: 73.0479 }, // Islamabad
  BGD: { lat: 23.8103, lng: 90.4125 }, // Dhaka
  LKA: { lat: 6.9271, lng: 79.8612 }, // Sri Jayawardenepura Kotte / Colombo
  NPL: { lat: 27.7172, lng: 85.324 }, // Kathmandu
  BTN: { lat: 27.4728, lng: 89.6393 }, // Thimphu
  MDV: { lat: 4.1755, lng: 73.5093 }, // Male

  // ─── Southeast Asia ───────────────────────────────────────────────────
  IDN: { lat: -6.2088, lng: 106.8456 }, // Jakarta
  THA: { lat: 13.7563, lng: 100.5018 }, // Bangkok
  VNM: { lat: 21.0285, lng: 105.8542 }, // Hanoi
  MYS: { lat: 3.139, lng: 101.6869 }, // Kuala Lumpur
  PHL: { lat: 14.5995, lng: 120.9842 }, // Manila
  SGP: { lat: 1.3521, lng: 103.8198 }, // Singapore
  MMR: { lat: 19.7633, lng: 96.0785 }, // Naypyidaw
  KHM: { lat: 11.5564, lng: 104.9282 }, // Phnom Penh
  LAO: { lat: 17.9757, lng: 102.6331 }, // Vientiane
  TLS: { lat: -8.5569, lng: 125.5603 }, // Dili

  // ─── East Asia ────────────────────────────────────────────────────────
  CHN: { lat: 39.9042, lng: 116.4074 }, // Beijing
  JPN: { lat: 35.6762, lng: 139.6503 }, // Tokyo
  KOR: { lat: 37.5665, lng: 126.978 }, // Seoul
  PRK: { lat: 39.0392, lng: 125.7625 }, // Pyongyang
  TWN: { lat: 25.033, lng: 121.5654 }, // Taipei
  HKG: { lat: 22.3193, lng: 114.1694 }, // Hong Kong
  MAC: { lat: 22.1987, lng: 113.5439 }, // Macau
  MNG: { lat: 47.8864, lng: 106.9057 }, // Ulaanbaatar

  // ─── Central Asia ─────────────────────────────────────────────────────
  KAZ: { lat: 51.1694, lng: 71.4491 }, // Astana
  UZB: { lat: 41.2995, lng: 69.2401 }, // Tashkent
  KGZ: { lat: 42.8746, lng: 74.5698 }, // Bishkek
  TJK: { lat: 38.5598, lng: 68.774 }, // Dushanbe
  TKM: { lat: 37.9601, lng: 58.3261 }, // Ashgabat

  // ─── Middle East ──────────────────────────────────────────────────────
  ARE: { lat: 24.4539, lng: 54.3773 }, // Abu Dhabi
  SAU: { lat: 24.7136, lng: 46.6753 }, // Riyadh
  QAT: { lat: 25.2854, lng: 51.531 }, // Doha
  KWT: { lat: 29.3759, lng: 47.9774 }, // Kuwait City
  BHR: { lat: 26.0667, lng: 50.5577 }, // Manama
  OMN: { lat: 23.588, lng: 58.3829 }, // Muscat
  JOR: { lat: 31.9454, lng: 35.9284 }, // Amman
  LBN: { lat: 33.8938, lng: 35.5018 }, // Beirut
  IRQ: { lat: 33.3152, lng: 44.3661 }, // Baghdad
  IRN: { lat: 35.6892, lng: 51.389 }, // Tehran
  SYR: { lat: 33.5138, lng: 36.2765 }, // Damascus
  YEM: { lat: 15.3694, lng: 44.191 }, // Sanaa
  ISR: { lat: 31.7683, lng: 35.2137 }, // Jerusalem
  EGY: { lat: 30.0444, lng: 31.2357 }, // Cairo

  // ─── Europe ───────────────────────────────────────────────────────────
  GBR: { lat: 51.5074, lng: -0.1278 }, // London
  DEU: { lat: 52.52, lng: 13.405 }, // Berlin
  FRA: { lat: 48.8566, lng: 2.3522 }, // Paris
  ITA: { lat: 41.9028, lng: 12.4964 }, // Rome
  ESP: { lat: 40.4168, lng: -3.7038 }, // Madrid
  NLD: { lat: 52.3676, lng: 4.9041 }, // Amsterdam
  CHE: { lat: 46.9481, lng: 7.4474 }, // Bern
  AUT: { lat: 48.2082, lng: 16.3738 }, // Vienna
  BEL: { lat: 50.8503, lng: 4.3517 }, // Brussels
  PRT: { lat: 38.7223, lng: -9.1393 }, // Lisbon
  GRC: { lat: 37.9838, lng: 23.7275 }, // Athens
  POL: { lat: 52.2297, lng: 21.0122 }, // Warsaw
  CZE: { lat: 50.0755, lng: 14.4378 }, // Prague
  HUN: { lat: 47.4979, lng: 19.0402 }, // Budapest
  HRV: { lat: 45.815, lng: 15.9819 }, // Zagreb
  ROU: { lat: 44.4268, lng: 26.1025 }, // Bucharest
  BGR: { lat: 42.6977, lng: 23.3219 }, // Sofia
  SRB: { lat: 44.7866, lng: 20.4489 }, // Belgrade
  ALB: { lat: 41.3275, lng: 19.8187 }, // Tirana
  MKD: { lat: 41.9973, lng: 21.428 }, // Skopje
  BIH: { lat: 43.8563, lng: 18.4131 }, // Sarajevo
  MNE: { lat: 42.4304, lng: 19.2594 }, // Podgorica
  XKX: { lat: 42.6629, lng: 21.1655 }, // Pristina
  IRL: { lat: 53.3498, lng: -6.2603 }, // Dublin
  ISL: { lat: 64.1466, lng: -21.9426 }, // Reykjavik
  SWE: { lat: 59.3293, lng: 18.0686 }, // Stockholm
  NOR: { lat: 59.9139, lng: 10.7522 }, // Oslo
  DNK: { lat: 55.6761, lng: 12.5683 }, // Copenhagen
  FIN: { lat: 60.1699, lng: 24.9384 }, // Helsinki
  EST: { lat: 59.437, lng: 24.7536 }, // Tallinn
  LVA: { lat: 56.9496, lng: 24.1052 }, // Riga
  LTU: { lat: 54.6872, lng: 25.2797 }, // Vilnius
  LUX: { lat: 49.6117, lng: 6.13 }, // Luxembourg
  SVK: { lat: 48.1486, lng: 17.1077 }, // Bratislava
  SVN: { lat: 46.0569, lng: 14.5058 }, // Ljubljana
  MDA: { lat: 47.0105, lng: 28.8638 }, // Chisinau
  UKR: { lat: 50.4501, lng: 30.5234 }, // Kyiv
  BLR: { lat: 53.9045, lng: 27.5615 }, // Minsk
  CYP: { lat: 35.1856, lng: 33.3823 }, // Nicosia
  RUS: { lat: 55.7558, lng: 37.6173 }, // Moscow
  TUR: { lat: 39.9334, lng: 32.8597 }, // Ankara
  GEO: { lat: 41.7151, lng: 44.8271 }, // Tbilisi
  AZE: { lat: 40.4093, lng: 49.8671 }, // Baku
  ARM: { lat: 40.1792, lng: 44.4991 }, // Yerevan

  // ─── Africa ───────────────────────────────────────────────────────────
  NGA: { lat: 9.0765, lng: 7.3986 }, // Abuja
  GHA: { lat: 5.6037, lng: -0.187 }, // Accra
  KEN: { lat: -1.2921, lng: 36.8219 }, // Nairobi
  ETH: { lat: 9.0192, lng: 38.7525 }, // Addis Ababa
  TZA: { lat: -6.163, lng: 35.7516 }, // Dodoma
  UGA: { lat: 0.3476, lng: 32.5825 }, // Kampala
  RWA: { lat: -1.9403, lng: 29.8739 }, // Kigali
  MOZ: { lat: -25.9692, lng: 32.5732 }, // Maputo
  ZAF: { lat: -25.7479, lng: 28.2293 }, // Pretoria
  MAR: { lat: 34.0209, lng: -6.8416 }, // Rabat
  TUN: { lat: 36.8065, lng: 10.1815 }, // Tunis
  DZA: { lat: 36.7538, lng: 3.0588 }, // Algiers
  LBY: { lat: 32.8872, lng: 13.1913 }, // Tripoli
  SDN: { lat: 15.5007, lng: 32.5599 }, // Khartoum
  SSD: { lat: 4.8594, lng: 31.5713 }, // Juba
  SOM: { lat: 2.0469, lng: 45.3182 }, // Mogadishu
  DJI: { lat: 11.5721, lng: 43.1456 }, // Djibouti City
  ERI: { lat: 15.3229, lng: 38.9251 }, // Asmara
  MDG: { lat: -18.8792, lng: 47.5079 }, // Antananarivo
  MUS: { lat: -20.1609, lng: 57.5012 }, // Port Louis
  SYC: { lat: -4.6191, lng: 55.4513 }, // Victoria
  COM: { lat: -11.7172, lng: 43.2473 }, // Moroni
  TGO: { lat: 6.1256, lng: 1.2254 }, // Lome
  BEN: { lat: 6.4969, lng: 2.6289 }, // Porto-Novo
  BFA: { lat: 12.3714, lng: -1.5197 }, // Ouagadougou
  CIV: { lat: 6.8276, lng: -5.2893 }, // Yamoussoukro
  SEN: { lat: 14.7167, lng: -17.4677 }, // Dakar
  MLI: { lat: 12.6392, lng: -8.0029 }, // Bamako
  NER: { lat: 13.5116, lng: 2.1254 }, // Niamey
  TCD: { lat: 12.1348, lng: 15.0557 }, // N'Djamena
  CMR: { lat: 3.848, lng: 11.5021 }, // Yaounde
  CAF: { lat: 4.3947, lng: 18.5582 }, // Bangui
  COG: { lat: -4.2634, lng: 15.2429 }, // Brazzaville
  COD: { lat: -4.4419, lng: 15.2663 }, // Kinshasa
  GAB: { lat: 0.4162, lng: 9.4673 }, // Libreville
  GNQ: { lat: 3.75, lng: 8.7833 }, // Malabo
  GNB: { lat: 11.8037, lng: -15.1804 }, // Bissau
  GMB: { lat: 13.4549, lng: -16.5790 }, // Banjul
  GIN: { lat: 9.6412, lng: -13.5784 }, // Conakry
  SLE: { lat: 8.484, lng: -13.2299 }, // Freetown
  LBR: { lat: 6.2907, lng: -10.7605 }, // Monrovia
  MRT: { lat: 18.0735, lng: -15.9582 }, // Nouakchott
  BDI: { lat: -3.3731, lng: 29.3644 }, // Gitega
  MWI: { lat: -13.9626, lng: 33.7741 }, // Lilongwe
  ZMB: { lat: -15.3875, lng: 28.3228 }, // Lusaka
  ZWE: { lat: -17.8252, lng: 31.0335 }, // Harare
  BWA: { lat: -24.6282, lng: 25.9231 }, // Gaborone
  NAM: { lat: -22.5609, lng: 17.0658 }, // Windhoek
  LSO: { lat: -29.3142, lng: 27.4833 }, // Maseru
  SWZ: { lat: -26.3054, lng: 31.1367 }, // Mbabane
  AGO: { lat: -8.839, lng: 13.2894 }, // Luanda

  // ─── North America ────────────────────────────────────────────────────
  USA: { lat: 38.9072, lng: -77.0369 }, // Washington, D.C.
  CAN: { lat: 45.4215, lng: -75.6972 }, // Ottawa
  MEX: { lat: 19.4326, lng: -99.1332 }, // Mexico City

  // ─── Central America ──────────────────────────────────────────────────
  GTM: { lat: 14.6349, lng: -90.5069 }, // Guatemala City
  BLZ: { lat: 17.251, lng: -88.759 }, // Belmopan
  SLV: { lat: 13.6929, lng: -89.2182 }, // San Salvador
  HND: { lat: 14.0723, lng: -87.1921 }, // Tegucigalpa
  NIC: { lat: 12.1364, lng: -86.2514 }, // Managua
  CRI: { lat: 9.9281, lng: -84.0907 }, // San Jose
  PAN: { lat: 8.9824, lng: -79.5199 }, // Panama City

  // ─── Caribbean ────────────────────────────────────────────────────────
  CUB: { lat: 23.1136, lng: -82.3666 }, // Havana
  DOM: { lat: 18.4861, lng: -69.9312 }, // Santo Domingo
  HTI: { lat: 18.5944, lng: -72.3074 }, // Port-au-Prince
  JAM: { lat: 18.0179, lng: -76.8099 }, // Kingston
  TTO: { lat: 10.6918, lng: -61.2225 }, // Port of Spain
  BRB: { lat: 13.0969, lng: -59.6145 }, // Bridgetown
  DMA: { lat: 15.301, lng: -61.3879 }, // Roseau
  GRD: { lat: 12.0561, lng: -61.7488 }, // St. George's
  KNA: { lat: 17.3026, lng: -62.7177 }, // Basseterre
  VCT: { lat: 13.1587, lng: -61.2248 }, // Kingstown

  // ─── South America ────────────────────────────────────────────────────
  BRA: { lat: -15.7975, lng: -47.8919 }, // Brasilia
  ARG: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
  CHL: { lat: -33.4489, lng: -70.6693 }, // Santiago
  COL: { lat: 4.711, lng: -74.0721 }, // Bogota
  PER: { lat: -12.0464, lng: -77.0428 }, // Lima
  VEN: { lat: 10.4806, lng: -66.9036 }, // Caracas
  ECU: { lat: -0.1807, lng: -78.4678 }, // Quito
  BOL: { lat: -19.0196, lng: -65.2619 }, // Sucre
  PRY: { lat: -25.2637, lng: -57.5759 }, // Asuncion
  URY: { lat: -34.9011, lng: -56.1645 }, // Montevideo
  SUR: { lat: 5.852, lng: -55.2038 }, // Paramaribo
  GUY: { lat: 6.8013, lng: -58.1551 }, // Georgetown

  // ─── Oceania ──────────────────────────────────────────────────────────
  AUS: { lat: -35.2809, lng: 149.13 }, // Canberra
  NZL: { lat: -41.2865, lng: 174.7762 }, // Wellington
  FJI: { lat: -18.1416, lng: 178.4419 }, // Suva
  PNG: { lat: -6.315, lng: 143.9555 }, // Port Moresby (adjusted slightly for visibility)
  FSM: { lat: 6.9248, lng: 158.1618 }, // Palikir
  VUT: { lat: -17.7334, lng: 168.3273 }, // Port Vila
  WSM: { lat: -13.8333, lng: -171.7500 }, // Apia
  PLW: { lat: 7.5150, lng: 134.5825 }, // Ngerulmud
  TUV: { lat: -8.5211, lng: 179.1962 }, // Funafuti
  MHL: { lat: 7.1164, lng: 171.1858 }, // Majuro
};
