import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { APP_NAME, sendMail } from "@/lib/mail";
import { ac, roles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  appName: APP_NAME,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60 * 24,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: `Set your ${APP_NAME} password`,
        heading: "Set your password",
        lines: [
          `Hello ${user.name},`,
          "Use the button below to choose a password for your account. The link works once and expires in 24 hours.",
          "If you did not expect this email you can ignore it.",
        ],
        action: { label: "Set password", url },
      });
    },
  },
  user: {
    additionalFields: {
      agentId: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/two-factor/*": { window: 60, max: 10 },
    },
  },
  plugins: [
    admin({ ac, roles, defaultRole: "agent", adminRoles: ["admin"] }),
    twoFactor({
      issuer: APP_NAME,
      otpOptions: {
        period: 5,
        sendOTP: async ({ user, otp }) => {
          await sendMail({
            to: user.email,
            subject: `${otp} is your ${APP_NAME} sign-in code`,
            heading: "Your sign-in code",
            lines: ["Enter this code to finish signing in. It expires in 5 minutes."],
            code: otp,
          });
        },
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
