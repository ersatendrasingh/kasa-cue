"use client";

import { AudioLines, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { GoogleMark } from "@/components/auth/google-mark";
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

type SignupFormProps = {
  googleEnabled?: boolean;
};

export function SignupForm({ googleEnabled = false }: SignupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/signup", {
        body: JSON.stringify({ email, name, password }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not create account.");
        setIsPending(false);
        return;
      }

      const result = await signIn("credentials", {
        callbackUrl: "/dashboard",
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login?callbackUrl=/dashboard");
        return;
      }

      router.push(result?.url ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Could not create account. Please try again.");
      setIsPending(false);
    }
  }

  function handleGoogleSignIn() {
    setError("");
    setIsPending(true);
    void signIn("google", { callbackUrl: "/dashboard" }).catch(() => {
      setError("Could not open Google sign in. Please try again.");
      setIsPending(false);
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#d9f99d_0,transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#eef2ff_45%,#fefce8_100%)] px-4 py-8 text-slate-950">
      <Card className="w-full max-w-md rounded-lg border-slate-200/90 bg-white/95 shadow-xl shadow-slate-200/60">
        <CardHeader className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
            <AudioLines className="size-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Create your Kasa Cue account</CardTitle>
            <CardDescription className="mt-2">
              Start with a user workspace for live calls, interviews, and saved
              reference context.
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
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
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
                autoComplete="new-password"
                minLength={8}
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
                <UserPlus className="size-4" />
              )}
              Create account
            </Button>
          </form>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link className="font-semibold text-slate-950" href="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      {isPending ? (
        <LoadingOverlay
          description="Creating your secure Kasa Cue workspace."
          label="Setting up your account"
        />
      ) : null}
    </main>
  );
}
