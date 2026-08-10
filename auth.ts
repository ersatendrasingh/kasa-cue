import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

export type AppRole = "admin" | "user";

type OAuthUserInput = {
  email: string;
  image?: null | string;
  name?: null | string;
};

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").toLowerCase();
      const password = String(credentials?.password ?? "");
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user?.passwordHash || !password) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toLowerCase() as AppRole,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      allowDangerousEmailAccountLinking: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    "kasa-cue-local-dev-secret-change-before-production",
  pages: {
    error: "/login",
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = String(user.email ?? profile?.email ?? "")
        .trim()
        .toLowerCase();

      if (!email) {
        return false;
      }

      try {
        await syncOAuthUser({
          email,
          image: user.image,
          name: user.name,
        });
      } catch (error) {
        console.error("Google sign-in user sync failed", error);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }

      if (token.email && (Boolean(user) || !token.sub || !token.role)) {
        try {
          const email = token.email.toLowerCase();
          const dbUser =
            (await prisma.user.findUnique({
              where: {
                email,
              },
              select: {
                id: true,
                role: true,
              },
            })) ??
            (await syncOAuthUser({
              email,
              image: typeof token.picture === "string" ? token.picture : null,
              name: typeof token.name === "string" ? token.name : null,
            }));

          token.sub = dbUser.id;
          token.role = dbUser.role.toLowerCase() as AppRole;
        } catch (error) {
          console.error("JWT user lookup failed", error);
          token.role = token.role ?? "user";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "user";
      }

      return session;
    },
  },
});

async function syncOAuthUser({ email, image, name }: OAuthUserInput) {
  return prisma.user.upsert({
    where: { email },
    update: {
      emailVerified: new Date(),
      image,
      name,
    },
    create: {
      email,
      emailVerified: new Date(),
      image,
      name,
      passwordHash: "",
      role: "user",
    },
    select: {
      id: true,
      role: true,
    },
  });
}
