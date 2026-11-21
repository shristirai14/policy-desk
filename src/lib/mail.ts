import nodemailer, { type Transporter } from "nodemailer";

export const APP_NAME = "PolicyDesk";

const globalForMail = globalThis as unknown as {
  mailTransport?: Transporter;
};

function getTransport() {
  if (globalForMail.mailTransport) return globalForMail.mailTransport;
  const host = process.env.SMTP_HOST;
  const transport = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });
  globalForMail.mailTransport = transport;
  return transport;
}

type Mail = {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  code?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderHtml(mail: Mail) {
  const paragraphs = mail.lines
    .map((line) => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:22px">${escapeHtml(line)}</p>`)
    .join("");
  const code = mail.code
    ? `<p style="margin:16px 0;font-size:28px;letter-spacing:6px;font-weight:700;color:#0f172a">${escapeHtml(mail.code)}</p>`
    : "";
  const action = mail.action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(mail.action.url)}" style="background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:15px;display:inline-block">${escapeHtml(mail.action.label)}</a></p><p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:20px;word-break:break-all">${escapeHtml(mail.action.url)}</p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px"><p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#0f172a">${APP_NAME}</p><h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${escapeHtml(mail.heading)}</h1>${paragraphs}${code}${action}</div>`;
}

function renderText(mail: Mail) {
  return [
    mail.heading,
    "",
    ...mail.lines,
    ...(mail.code ? ["", mail.code] : []),
    ...(mail.action ? ["", `${mail.action.label}: ${mail.action.url}`] : []),
  ].join("\n");
}

export async function sendMail(mail: Mail) {
  const from = process.env.MAIL_FROM ?? `${APP_NAME} <no-reply@policydesk.local>`;
  const text = renderText(mail);
  await getTransport().sendMail({
    from,
    to: mail.to,
    subject: mail.subject,
    text,
    html: renderHtml(mail),
    attachments: mail.attachments?.map((file) => ({ ...file, contentType: "application/pdf" })),
  });
  if (!process.env.SMTP_HOST) {
    console.log(`\n[mail] SMTP_HOST is not set, printing instead of sending\nTo: ${mail.to}\nSubject: ${mail.subject}\n${text}\n${mail.attachments?.length ? `Attachments: ${mail.attachments.map((file) => file.filename).join(", ")}\n` : ""}`);
  }
}
