import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { INSURER_NAME, pdfSafe } from "@/lib/documents/render";

export type SignatureInfo = {
  documentTitle: string;
  signerName: string;
  signerEmail: string;
  signatureText: string;
  initialsText: string;
  authorizedAt: Date;
  signedAt: Date;
  ipAddress: string;
  reference: string;
};

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stamp(date: Date) {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export async function stampSignature(unsigned: Uint8Array, info: SignatureInfo) {
  const doc = await PDFDocument.load(unsigned);
  const script = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.39, 0.45, 0.55);

  const marker = (doc.getKeywords() ?? "").split(/\s+/).find((keyword) => keyword.startsWith("sig:"));
  if (marker) {
    const [, pageIndex, x, y] = marker.split(":").map(Number);
    const page = doc.getPage(pageIndex);
    page.drawText(pdfSafe(info.signatureText), { x, y: y + 16, size: 20, font: script, color: rgb(0.1, 0.2, 0.55) });
    page.drawText(pdfSafe(`Signed electronically by ${info.signerName}`), { x, y: y + 4, size: 7, font: regular, color: muted });
    page.drawText(pdfSafe(`${stamp(info.signedAt)}  IP ${info.ipAddress}`), { x, y: y - 5, size: 7, font: regular, color: muted });
  }

  const page = doc.addPage([595, 842]);
  let y = 780;
  const line = (label: string, value: string) => {
    page.drawText(pdfSafe(label), { x: 50, y, size: 10, font: regular, color: muted });
    page.drawText(pdfSafe(value), { x: 220, y, size: 10, font: regular, color: ink });
    y -= 18;
  };
  page.drawText("Electronic signature record", { x: 50, y, size: 16, font: bold, color: ink });
  y -= 30;
  line("Document", info.documentTitle);
  line("Reference", info.reference);
  line("Issued by", INSURER_NAME);
  y -= 8;
  line("Signer", info.signerName);
  line("Email", info.signerEmail);
  line("Signature adopted", info.signatureText);
  line("Initials adopted", info.initialsText);
  y -= 8;
  line("Identity check", "One-time code sent to the signer's email");
  line("Code verified", stamp(info.authorizedAt));
  line("Document signed", stamp(info.signedAt));
  line("IP address", info.ipAddress);
  y -= 8;
  line("SHA-256 before signing", sha256(unsigned).slice(0, 48));
  page.drawText(sha256(unsigned).slice(48), { x: 220, y: y + 6, size: 10, font: regular, color: ink });
  y -= 24;
  page.drawText("Demonstration signature. It is not an Aadhaar eSign or a digital signature certificate.", { x: 50, y, size: 8, font: regular, color: muted });

  doc.setKeywords(["signed"]);
  return new Uint8Array(await doc.save());
}
