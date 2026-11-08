import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue your arrival journey.</p>
      </div>
      <SignInForm />
      <p className="text-sm text-muted-foreground">
        New to FirstSteps?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create a student account
        </Link>
      </p>
    </div>
  );
}
