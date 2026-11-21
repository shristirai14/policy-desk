import { loadSigning } from "@/lib/esign";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: RouteContext<"/esign/[token]/pdf/[docId]">) {
  const { token, docId } = await context.params;
  const signing = await loadSigning(token);
  const documentId = Number(docId);
  const allowed =
    signing &&
    signing.statusCode !== "N" &&
    (signing.statusCode === "C" || signing.quote.statusCode === "B") &&
    signing.signatures.some((signature) => signature.document.id === documentId);
  if (!allowed) return new Response("Not found", { status: 404 });

  const document = await prisma.esignDocument.findUnique({ where: { id: documentId }, select: { signedPdf: true, unsignedPdf: true, title: true } });
  const bytes = document?.signedPdf ?? document?.unsignedPdf;
  if (!document || !bytes) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${document.title.replace(/[^A-Za-z0-9]+/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
