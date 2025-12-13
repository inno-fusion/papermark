import { JSXElementConstructor, ReactElement } from "react";

import { render, toPlainText } from "@react-email/render";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { log, nanoid } from "@/lib/utils";

// ===========================================
// EMAIL PROVIDER CONFIGURATION
// ===========================================

type EmailProvider = "smtp" | "resend" | "none";

interface EmailConfig {
  provider: EmailProvider;
  from: {
    default: string;
    marketing?: string;
    system?: string;
    verify?: string;
  };
}

/**
 * Check if email is configured
 * Returns true only if SMTP or Resend is configured
 */
export function isEmailConfigured(): boolean {
  // Check SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return true;
  }
  // Check Resend
  if (process.env.RESEND_API_KEY) {
    return true;
  }
  return false;
}

// Determine which provider to use based on environment variables
function getEmailProvider(): EmailProvider {
  // SMTP takes priority if configured
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return "smtp";
  }
  // Fall back to Resend if API key is set
  if (process.env.RESEND_API_KEY) {
    return "resend";
  }
  // No email provider configured
  return "none";
}

// Get email configuration
function getEmailConfig(): EmailConfig {
  const defaultFrom =
    process.env.EMAIL_FROM || "Papermark <noreply@papermark.io>";

  return {
    provider: getEmailProvider(),
    from: {
      default: defaultFrom,
      marketing: process.env.EMAIL_FROM_MARKETING || defaultFrom,
      system: process.env.EMAIL_FROM_SYSTEM || defaultFrom,
      verify: process.env.EMAIL_FROM_VERIFY || defaultFrom,
    },
  };
}

export function getEmailProviderName(): string {
  const config = getEmailConfig();
  return config.provider === "none" ? "NOT CONFIGURED" : config.provider.toUpperCase();
}

// ===========================================
// SMTP TRANSPORT (nodemailer)
// ===========================================

let smtpTransport: Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getSmtpTransport(): Transporter<SMTPTransport.SentMessageInfo> | null {
  if (smtpTransport) {
    return smtpTransport;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host) {
    return null;
  }

  const secure = port === 465; // true for 465, false for other ports

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      user && pass
        ? {
            user,
            pass,
          }
        : undefined,
    // TLS options for services like OCI that require TLS
    tls: {
      // Do not fail on invalid certs (useful for some enterprise setups)
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  });

  return smtpTransport;
}

// ===========================================
// RESEND TRANSPORT
// ===========================================

let resendClient: any = null;

async function getResendClient() {
  if (resendClient) {
    return resendClient;
  }

  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  // Dynamic import to avoid loading Resend if not needed
  const { Resend } = await import("resend");
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// ===========================================
// UNIFIED SEND EMAIL FUNCTION
// ===========================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement<any, string | JSXElementConstructor<any>>;
  from?: string;
  marketing?: boolean;
  system?: boolean;
  verify?: boolean;
  test?: boolean;
  cc?: string | string[];
  replyTo?: string;
  scheduledAt?: string;
  unsubscribeUrl?: string;
}

// Track if we've logged the "not configured" warning to avoid spam
let hasLoggedNotConfigured = false;

export async function sendEmail(options: SendEmailOptions): Promise<any> {
  const config = getEmailConfig();

  // Gracefully handle when email is not configured
  if (config.provider === "none") {
    if (!hasLoggedNotConfigured) {
      console.warn(
        "[Email] Email not configured. Set SMTP_HOST/SMTP_PORT or RESEND_API_KEY to enable email sending.",
      );
      hasLoggedNotConfigured = true;
    }
    // Return a mock success response
    return { id: `skipped-${nanoid()}`, skipped: true };
  }

  const {
    to,
    subject,
    react,
    from,
    marketing,
    system,
    verify,
    test,
    cc,
    replyTo,
    scheduledAt,
    unsubscribeUrl,
  } = options;

  // Determine the from address
  const fromAddress =
    from ??
    (marketing
      ? config.from.marketing
      : system
        ? config.from.system
        : verify
          ? config.from.verify
          : config.from.default);

  // Render email to HTML and plain text
  const html = await render(react);
  const plainText = toPlainText(html);

  // Use test address in development
  const recipient = test ? process.env.EMAIL_TEST_ADDRESS || to : to;

  // Route to appropriate provider
  if (config.provider === "smtp") {
    return sendViaSMTP({
      to: recipient,
      from: fromAddress!,
      subject,
      html,
      text: plainText,
      cc,
      replyTo,
      unsubscribeUrl,
    });
  } else {
    return sendViaResend({
      to: recipient,
      from: fromAddress!,
      subject,
      react,
      html,
      text: plainText,
      cc,
      replyTo,
      scheduledAt,
      unsubscribeUrl,
    });
  }
}

// ===========================================
// SMTP SEND IMPLEMENTATION
// ===========================================

interface SmtpEmailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  cc?: string | string[];
  replyTo?: string;
  unsubscribeUrl?: string;
}

async function sendViaSMTP(options: SmtpEmailOptions): Promise<any> {
  const transport = getSmtpTransport();

  if (!transport) {
    // This shouldn't happen since we check config.provider first,
    // but handle gracefully just in case
    console.warn("[Email] SMTP transport not available");
    return { id: `skipped-${nanoid()}`, skipped: true };
  }

  const { to, from, subject, html, text, cc, replyTo, unsubscribeUrl } = options;

  try {
    const result = await transport.sendMail({
      from,
      to,
      cc,
      replyTo,
      subject,
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": nanoid(),
        ...(unsubscribeUrl ? { "List-Unsubscribe": unsubscribeUrl } : {}),
      },
    });

    console.log(`[Email] Sent via SMTP to ${to}: ${result.messageId}`);
    return { id: result.messageId };
  } catch (error) {
    log({
      message: `SMTP email error: ${error}`,
      type: "error",
      mention: true,
    });
    // Log error but don't throw - email should never break the app
    console.error(`[Email] Failed to send via SMTP to ${to}:`, error);
    return { id: `failed-${nanoid()}`, error: true };
  }
}

// ===========================================
// RESEND SEND IMPLEMENTATION
// ===========================================

interface ResendEmailOptions {
  to: string;
  from: string;
  subject: string;
  react: ReactElement<any, string | JSXElementConstructor<any>>;
  html: string;
  text: string;
  cc?: string | string[];
  replyTo?: string;
  scheduledAt?: string;
  unsubscribeUrl?: string;
}

async function sendViaResend(options: ResendEmailOptions): Promise<any> {
  const resend = await getResendClient();

  if (!resend) {
    // This shouldn't happen since we check config.provider first,
    // but handle gracefully just in case
    console.warn("[Email] Resend client not available");
    return { id: `skipped-${nanoid()}`, skipped: true };
  }

  const {
    to,
    from,
    subject,
    react,
    text,
    cc,
    replyTo,
    scheduledAt,
    unsubscribeUrl,
  } = options;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      cc,
      replyTo,
      subject,
      react,
      scheduledAt,
      text,
      headers: {
        "X-Entity-Ref-ID": nanoid(),
        ...(unsubscribeUrl ? { "List-Unsubscribe": unsubscribeUrl } : {}),
      },
    });

    if (error) {
      log({
        message: `Resend error: ${error.name} - ${error.message}`,
        type: "error",
        mention: true,
      });
      // Log error but don't throw
      console.error(`[Email] Resend error for ${to}:`, error);
      return { id: `failed-${nanoid()}`, error: true };
    }

    console.log(`[Email] Sent via Resend to ${to}: ${data?.id}`);
    return data;
  } catch (error) {
    log({
      message: `Resend email error: ${error}`,
      type: "error",
      mention: true,
    });
    // Log error but don't throw - email should never break the app
    console.error(`[Email] Failed to send via Resend to ${to}:`, error);
    return { id: `failed-${nanoid()}`, error: true };
  }
}

// ===========================================
// VERIFY CONNECTION
// ===========================================

export async function verifyEmailConnection(): Promise<boolean> {
  const config = getEmailConfig();

  if (config.provider === "none") {
    console.warn("[Email] Email not configured");
    return false;
  }

  if (config.provider === "smtp") {
    const transport = getSmtpTransport();
    if (!transport) {
      console.warn("[Email] SMTP not configured");
      return false;
    }

    try {
      await transport.verify();
      console.log("[Email] SMTP connection verified");
      return true;
    } catch (error) {
      console.error("[Email] SMTP connection failed:", error);
      return false;
    }
  } else {
    // Resend doesn't have a verify method, just check if configured
    const resend = await getResendClient();
    return !!resend;
  }
}
