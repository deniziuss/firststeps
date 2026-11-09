import { AuthFrame } from "@/components/auth-frame";

// Pages opened from account emails (verify email, reset password). They work signed in or out,
// because the single-use token in the link is the authorisation.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
