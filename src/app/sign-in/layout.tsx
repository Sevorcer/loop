import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sign-in page has no app shell chrome — renders standalone.
  return <>{children}</>;
}
