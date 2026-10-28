export declare const BLOB_WILDCARD_HOST: "*.public.blob.vercel-storage.com";
export declare function blobStoreIdFromToken(token: string | undefined | null): string | null;
export declare function ownBlobHost(token: string | undefined | null): string | null;
export declare function imageHostForBuild(token: string | undefined | null, warn?: (message: string) => void): string;
