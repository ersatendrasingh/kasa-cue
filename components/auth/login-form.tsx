"use client";

import { AudioLines, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { GoogleMark } from "@/components/auth/google-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

type LoginFormProps = {
  callbackUrl?: string;
  googleEnabled?: boolean;
};

export function LoginForm({
  callbackUrl = "/dashboard",
  googleEnabled = false,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: safeCallbackUrl,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        setIsPending(false);
        return;
      }

      router.push(result?.url ?? safeCallbackUrl);
      router.refresh();
    } catch {
      setError("Could not sign in. Please try again.");
      setIsPending(false);
    }
  }

  function handleGoogleSignIn() {
    setError("");
    setIsPending(true);
    void signIn("google", { callbackUrl: safeCallbackUrl }).catch(() => {
      setError("Could not open Google sign in. Please try again.");
      setIsPending(false);
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#d9f99d_0,transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#eef2ff_45%,#fefce8_100%)] px-4 py-8 text-slate-950">
      <Card className="w-full max-w-md rounded-lg border-slate-200/90 bg-white/95 shadow-xl shadow-slate-200/60">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
              <AudioLines className="size-5" />
            </div>
            <Badge className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
              <ShieldCheck className="size-3.5" />
              Protected
            </Badge>
          </div>
          <div>
            <CardTitle className="text-2xl">Sign in to Kasa Cue</CardTitle>
            <CardDescription className="mt-2">
              Login required before accessing the communication workspace.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {googleEnabled ? (
            <Button
              className="h-10 w-full gap-2 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
              disabled={isPending}
              onClick={handleGoogleSignIn}
              type="button"
              variant="outline"
            >
              <GoogleMark className="size-4" />
              Continue with Google
            </Button>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <Button
              className="h-10 w-full gap-2 bg-slate-950 text-white hover:bg-slate-800"
              disabled={isPending}
              type="submit"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              Sign in
            </Button>
          </form>
          <p className="text-center text-sm text-slate-600">
            New to Kasa Cue?{" "}
            <Link className="font-semibold text-slate-950" href="/signup">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
      {isPending ? (
        <LoadingOverlay
          description="Opening your dashboard securely."
          label="Signing you in"
        />
      ) : null}
    </main>
  );
}

function getSafeCallbackUrl(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
