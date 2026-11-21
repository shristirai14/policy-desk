import type { Metadata } from "next";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Verify sign-in" };
export const instant = false;

export default async function TwoFactorPage({ searchParams }: PageProps<"/two-factor">) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";
  const methods = typeof params.methods === "string" ? params.methods.split(",") : [];
  return <TwoFactorForm next={next} hasTotp={methods.includes("totp")} />;
}
