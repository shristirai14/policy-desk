import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set password" };
export const instant = false;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invalid = typeof params.error === "string" || !token;
  return <ResetPasswordForm token={token} invalid={invalid} />;
}
