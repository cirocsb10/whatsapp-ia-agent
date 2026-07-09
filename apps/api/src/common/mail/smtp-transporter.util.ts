import * as nodemailer from "nodemailer";

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null;
  fromEmail: string;
  fromName: string | null;
}

export function buildTransporter(config: SmtpTransportConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username ? { user: config.username, pass: config.password ?? "" } : undefined,
  });
}

export function formatFrom(fromName: string | null, fromEmail: string): string {
  return fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
}
