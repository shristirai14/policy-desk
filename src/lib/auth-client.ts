import { adminClient, inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";
import { ac, roles } from "@/lib/permissions";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    adminClient({ ac, roles }),
    twoFactorClient(),
  ],
});
