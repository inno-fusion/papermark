// ============================================
// PDF TO IMAGE
// ============================================
export type PdfToImagePayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  versionNumber?: number;
};

// ============================================
// FILE CONVERSION (Office, CAD, Keynote)
// ============================================
export type FileConversionPayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  conversionType: "office" | "cad" | "keynote";
};

// ============================================
// VIDEO OPTIMIZATION
// ============================================
export type VideoOptimizationPayload = {
  videoUrl: string;
  teamId: string;
  docId: string;
  documentVersionId: string;
  fileSize: number;
};

// ============================================
// EXPORT VISITS
// ============================================
export type ExportVisitsPayload = {
  type: "document" | "dataroom" | "dataroom-group";
  teamId: string;
  resourceId: string;
  groupId?: string;
  userId: string;
  exportId: string;
};

// ============================================
// SCHEDULED EMAILS
// ============================================
export type ScheduledEmailPayload = {
  emailType:
    | "dataroom-trial-info"
    | "dataroom-trial-24h"
    | "dataroom-trial-expired"
    | "upgrade-checkin";
  to: string;
  name?: string;
  teamId?: string;
  useCase?: string;
};

// ============================================
// NOTIFICATIONS
// ============================================
export type DataroomNotificationPayload = {
  dataroomId: string;
  dataroomDocumentId: string;
  senderUserId: string;
  teamId: string;
};

export type ConversationNotificationPayload = {
  dataroomId: string;
  messageId: string;
  conversationId: string;
  teamId: string;
  senderUserId: string;
  notificationType: "viewer" | "team-member";
};

// ============================================
// BILLING
// ============================================
export type PauseResumeNotificationPayload = {
  teamId: string;
};

export type AutomaticUnpausePayload = {
  teamId: string;
};

// ============================================
// WEBHOOK DELIVERY
// ============================================
export type WebhookDeliveryPayload = {
  webhookId: string; // Webhook pId for tracking
  webhookUrl: string; // URL to deliver to
  webhookSecret: string; // Secret for signature
  eventId: string; // Event ID (evt_xxx)
  event: string; // Event type (e.g. "link.viewed")
  payload: Record<string, unknown>; // The actual webhook payload
};

// ============================================
// COMMON
// ============================================
export type JobTags = string[];

export type DelayedJobOptions = {
  delay?: number; // milliseconds
  jobId?: string;
  tags?: JobTags;
};
