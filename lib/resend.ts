/**
 * Email Service - Unified Provider
 *
 * This module provides a unified interface for sending emails using either:
 * - SMTP (for AWS SES, OCI Email, or any SMTP server)
 * - Resend (cloud email service)
 *
 * Provider selection is automatic based on environment variables:
 * - If SMTP_HOST and SMTP_PORT are set → SMTP is used
 * - Otherwise if RESEND_API_KEY is set → Resend is used
 *
 * For self-hosting, configure SMTP with:
 * - AWS SES: smtp.region.amazonaws.com:587
 * - OCI Email: smtp.email.region.oci.oraclecloud.com:587
 * - Any SMTP: host:port with optional user/password
 */

// Re-export everything from the unified provider
export {
  sendEmail,
  verifyEmailConnection,
  isEmailConfigured,
  getEmailProviderName,
} from "./email/provider";

export type { SendEmailOptions } from "./email/provider";

// Legacy export for backwards compatibility
// Some code might import `resend` directly
import { isEmailConfigured } from "./email/provider";

/**
 * @deprecated Use sendEmail() from this module instead.
 * This export is kept for backwards compatibility only.
 */
type ResendBatchResult = {
  data: { data: Array<{ id: string }> } | null;
  error: { message: string } | null;
};

export const resend = isEmailConfigured()
  ? {
      emails: { send: (_: any) => {} },
      batch: {
        send: async (_emails: any[]): Promise<ResendBatchResult> => ({
          data: null,
          error: { message: "Batch send not available with SMTP. Configure RESEND_API_KEY for batch email support." },
        }),
      },
    }
  : null;
