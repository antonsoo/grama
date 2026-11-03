declare const CONFIG: {
  edition: string;
  cache: string;
  base: string;
  assets: Record<string, { sha256: string; bytes: number; type: string }>;
};
declare const verifiedFetch: typeof import("./core/verified-fetch.js").verifiedFetch;
