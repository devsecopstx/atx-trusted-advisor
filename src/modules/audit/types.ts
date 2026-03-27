import { ObjectId } from "mongodb";

export type AuditEntityType =
  | "xpersona"
  | "access_request"
  | "core_user"
  | "deploy_note_config"
  | "xchat_session"
  | "core_scanner";

export type AuditActor = {
  userId: string;
  email?: string;
  username?: string;
};

export type AuditEvent = {
  _id?: ObjectId;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  actor: AuditActor;
  details?: Record<string, unknown>;
  createdAt: Date;
};
