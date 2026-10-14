export interface LiveMediaJournal {
  startedAt: string;
  origin: string;
  projectId: string;
  branch: string;
  nonce: string;
  clientId: string;
  slug: string;
  permalink: string;
  code?: string | undefined;
  token?: { access_token: string; refresh_token: string } | undefined;
  created?: boolean | undefined;
  uploads: {
    url: string;
    filename: string;
    mimeType: string;
    uploadedFile: string;
  }[];
  pendingUploads: { filename: string; prefix: string }[];
  plannedProperties?: Record<string, unknown[]> | undefined;
  sourceWasAbsent?: boolean | undefined;
  createCommit?: string | undefined;
  originalSourceSha256?: string | undefined;
  outgoingContentHash?: string | undefined;
  cleanup?: boolean | undefined;
  sourceAbsent?: boolean | undefined;
  revocationIntent?: boolean | undefined;
  grantRevoked?: boolean | undefined;
  removedBlobs?: string[] | undefined;
  failure?: { phase: string; message: string } | undefined;
}
