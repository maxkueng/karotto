import apiRevision from './api-revision.json';

export const API_REVISION: number = apiRevision.revision;

export const API_OPENAPI_SHA256: string = apiRevision.openapiSha256;

export const API_REVISION_HEADER = 'x-karotto-api-revision';

/** What a server that predates the revision header serves. */
export const BASELINE_API_REVISION = 1;
