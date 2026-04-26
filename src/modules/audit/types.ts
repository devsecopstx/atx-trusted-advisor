import { ObjectId } from "mongodb";

export type AuditEntityType =
  | "xpersona"
  | "access_request"
  | "core_user"
  | "tenant"
  | "deploy_note_config"
  | "admin_delivery_channel"
  | "admin_portfolio"
  | "xchat_session"
  | "core_scanner"
  | "system";

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
