import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocumentBlock } from "@/lib/documents/templates";
import { evaluateCondition, type ConditionContext } from "@/lib/ua/conditions";
import { riskCount } from "@/lib/ua/engine";
import { makeContext } from "@/lib/ua/packet";
import type { Packet } from "@/lib/ua/types";

export const INSURER_NAME = "PolicyDesk General Insurance (Demonstration)";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.39, 0.45, 0.55);
const RULE = rgb(0.85, 0.88, 0.92);

const NUMBER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type PremiumLine = { risk: number; description: string; amount: number };

export type RenderInput = {
  title: string;
  blocks: DocumentBlock[];
  packet: Packet;
  premium: PremiumLine[];
  total: number;
};

export function money(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rs ${NUMBER.format(amount)}` : "";
}

export function longDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : value;
}

export function pdfSafe(text: string) {
  return text
    .replace(/₹/g, "Rs ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function fill(template: string, ctx: ConditionContext) {
  const filled = template.replace(/\{\{\s*([\w]+)(?:\|(\w+))?\s*\}\}/g, (_, name: string, filter?: string) => {
    let value = ctx.get(name);
    if (value === "" && ctx.suffix) value = ctx.get(`${name}_${ctx.suffix}`);
    if (value === "") return "";
    if (filter === "date") return longDate(value);
    if (filter === "money") return money(value);
    return value;
  });
  return filled.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}

function isBlank(text: string) {
  return text.replace(/[%,\s]|cc/g, "") === "";
}

class Writer {
  page!: PDFPage;
  y = 0;
  signature: { page: number; x: number; y: number } | null = null;

  constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly title: string,
    readonly reference: string,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page.drawText(pdfSafe(INSURER_NAME), { x: MARGIN, y: PAGE_HEIGHT - 40, size: 9, font: this.bold, color: MUTED });
    const ref = pdfSafe(this.reference);
    this.page.drawText(ref, { x: PAGE_WIDTH - MARGIN - this.regular.widthOfTextAtSize(ref, 9), y: PAGE_HEIGHT - 40, size: 9, font: this.regular, color: MUTED });
    this.page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 48 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 48 }, thickness: 0.5, color: RULE });
    this.page.drawText("Demonstration document. Not a contract of insurance.", { x: MARGIN, y: 30, size: 8, font: this.regular, color: MUTED });
    this.y = PAGE_HEIGHT - 72;
  }

  ensure(height: number) {
    if (this.y - height < 50) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of pdfSafe(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(candidate, size) > width) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, options: { size?: number; bold?: boolean; color?: typeof INK; x?: number; width?: number; gap?: number } = {}) {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.regular;
    const x = options.x ?? MARGIN;
    for (const line of this.wrap(text, font, size, options.width ?? WIDTH - (x - MARGIN))) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: options.color ?? INK });
      this.y -= size + 4;
    }
    this.y -= options.gap ?? 0;
  }

  row(label: string, value: string, options: { bold?: boolean; right?: boolean } = {}) {
    const size = 10;
    const labelWidth = 170;
    const valueFont = options.bold ? this.bold : this.regular;
    const valueLines = this.wrap(value, valueFont, size, WIDTH - labelWidth);
    const labelLines = this.wrap(label, options.bold ? this.bold : this.regular, size, labelWidth - 10);
    const count = Math.max(valueLines.length, labelLines.length);
    this.ensure(count * (size + 4) + 4);
    for (let index = 0; index < count; index += 1) {
      const y = this.y - size - index * (size + 4);
      if (labelLines[index]) this.page.drawText(labelLines[index], { x: MARGIN, y, size, font: options.bold ? this.bold : this.regular, color: options.bold ? INK : MUTED });
      const line = valueLines[index];
      if (line) {
        const x = options.right ? PAGE_WIDTH - MARGIN - valueFont.widthOfTextAtSize(line, size) : MARGIN + labelWidth;
        this.page.drawText(line, { x, y, size, font: valueFont, color: INK });
      }
    }
    this.y -= count * (size + 4) + 3;
  }

  rule() {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color: RULE });
    this.y -= 6;
  }

  signatureBlock(label: string) {
    this.ensure(110);
    this.y -= 10;
    this.text(label, { size: 9, color: MUTED });
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - 56, width: 240, height: 56, borderColor: RULE, borderWidth: 1 });
    this.signature = { page: this.doc.getPageCount() - 1, x: MARGIN + 10, y: top - 46 };
    this.y = top - 66;
  }
}

export async function renderDocument(input: RenderInput) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const packet = input.packet;
  const ctx = makeContext(packet, { userType: "internal" });
  const reference = packet.PolicyNumber ? `Policy ${packet.PolicyNumber}` : `Quote ${packet.QuoteNumber ?? ""}`;
  const writer = new Writer(doc, regular, bold, input.title, reference);
  doc.setTitle(pdfSafe(input.title));
  doc.setAuthor(INSURER_NAME);

  writer.text(input.title, { size: 16, bold: true, gap: 10 });

  for (const block of input.blocks) {
    if ("when" in block && block.when && !evaluateCondition(block.when, ctx)) continue;
    switch (block.type) {
      case "heading":
        writer.y -= 6;
        writer.text(block.text, { size: 12, bold: true, gap: 2 });
        writer.rule();
        break;
      case "paragraph":
        writer.text(fill(block.text, ctx), { gap: 6 });
        break;
      case "fields":
        for (const [label, template] of block.rows) {
          const value = fill(template, ctx);
          if (!isBlank(value)) writer.row(label, value);
        }
        writer.y -= 4;
        break;
      case "vehicles":
        for (let risk = 1; risk <= riskCount(packet); risk += 1) {
          const riskCtx = makeContext(packet, { userType: "internal", risk });
          writer.ensure(40);
          writer.text(`Vehicle ${risk}`, { bold: true, gap: 1 });
          for (const [label, template] of block.rows) {
            const value = fill(template, riskCtx);
            if (!isBlank(value)) writer.row(label, value);
          }
          writer.y -= 4;
        }
        break;
      case "premium": {
        const risks = [...new Set(input.premium.filter((line) => line.risk > 0).map((line) => line.risk))];
        for (const risk of risks) {
          writer.ensure(40);
          writer.text(`Vehicle ${risk}: ${packet[`RegistrationNumber_${risk}`] ?? ""}`, { bold: true, gap: 1 });
          for (const line of input.premium.filter((item) => item.risk === risk)) writer.row(line.description, money(line.amount), { right: true });
        }
        writer.rule();
        const net = input.premium.filter((line) => line.risk > 0).reduce((sum, line) => sum + line.amount, 0);
        writer.row("Net premium", money(net), { right: true });
        for (const line of input.premium.filter((item) => item.risk === 0)) writer.row(line.description, money(line.amount), { right: true });
        writer.row("Total premium", money(input.total), { right: true, bold: true });
        writer.y -= 4;
        break;
      }
      case "signature":
        writer.signatureBlock(block.label);
        break;
    }
  }

  if (writer.signature) doc.setKeywords([`sig:${writer.signature.page}:${writer.signature.x}:${Math.round(writer.signature.y)}`]);
  return new Uint8Array(await doc.save());
}
