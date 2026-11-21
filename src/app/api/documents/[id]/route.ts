import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: RouteContext<"/api/documents/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Sign in to view this document.", { status: 401 });
  const { id } = await context.params;
  const role = isRole(session.user.role) ? session.user.role : "agent";

  const document = await prisma.esignDocument.findFirst({
    where: { id: Number(id) || 0, quote: role === "agent" ? { userId: session.user.id } : {} },
    select: { signedPdf: true, unsignedPdf: true, title: true },
  });
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
