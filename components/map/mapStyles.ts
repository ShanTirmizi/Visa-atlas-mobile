// MapLibre tile style URLs.
//
// Exported as constants so the Atlas tab's <VisaMap> and the root-layout
// <MapPrewarm> use byte-identical URLs — that's what makes MapLibre's
// native tile cache treat the prewarm fetch and the real fetch as the
// same resource.
export const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
