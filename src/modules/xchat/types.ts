import { ObjectId } from "mongodb";

export type PersonaCollectionVerification = {
  status: "verified" | "missing" | "error" | "skipped";
  checkedAt: Date;
  message?: string;
  resolvedCollectionName?: string;
};

export type PersonaConfig = {
  _id?: ObjectId;
  name: string;
  nameNormalized: string;
  systemPrompt: string;
  overridePrompt: string;
  xaiCollection?: {
    collectionId?: string;
    collectionName?: string;
  };
  xaiCollectionVerification?: PersonaCollectionVerification;
  model: string;
  temperature: number;
  enableRag: boolean;
  defaultScope: string;
  createdAt: Date;
  updatedAt: Date;
};

export type RagSourceFile = {
  _id?: ObjectId;
  userId?: ObjectId;
  tenantId?: ObjectId;
  userEmail?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  scope: string;
  xaiFileId?: string;
  xaiUploadStatus: "uploaded" | "failed" | "skipped";
  xaiUploadError?: string;
  contentPreview: string;
  createdAt: Date;
};

export type RagChunk = {
  _id?: ObjectId;
  fileId: ObjectId;
  userId?: ObjectId;
  tenantId?: ObjectId;
  scope: string;
  chunkIndex: number;
  text: string;
  tokenEstimate: number;
  createdAt: Date;
};

export type XChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type XChatSessionLog = {
  _id?: ObjectId;
  userId?: ObjectId;
  tenantId?: ObjectId;
  userEmail?: string;
  requestedBy?: string;
  personaId?: ObjectId;
  message: string;
  response: string;
  contextChunkIds: ObjectId[];
  model: string;
  createdAt: Date;
};
