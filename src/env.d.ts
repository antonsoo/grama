/// <reference types="vite/client" />
declare const __GRAMA_EDITION__: string;
declare const __ASSET_HASHES__: Record<string, string>;
declare module "virtual:grama-sources" {
  const manifest: {
    note: string;
    editions: {
      id: string;
      title: string;
      author?: string;
      editors?: string;
      date: number;
      container?: string;
      series?: string;
      publisher: string;
      scan: string;
      pdf: string;
      pdfSha256: string;
    }[];
    pages: {
      file: string;
      edition: string;
      printed: number | string;
      pdfPage: number;
      caption: string;
      sha256: string;
      bytes: number;
    }[];
  };
  export default manifest;
}
