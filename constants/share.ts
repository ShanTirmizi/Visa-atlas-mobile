// Public share-link base. The /t/<token> share surface lives in the
// visa-atlas web repo (Next.js), deployed via Vercel. Single source of
// truth for building share URLs in the app.
export const SHARE_BASE_URL = 'https://visa-atlas.vercel.app';
export const shareUrlForToken = (token: string) => `${SHARE_BASE_URL}/t/${token}`;
export const sharePdfUrlForToken = (token: string) => `${SHARE_BASE_URL}/t/${token}/pdf`;
