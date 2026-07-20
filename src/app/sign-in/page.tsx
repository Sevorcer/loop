import { Suspense } from "react";
import { SignInScreen } from "@/features/auth";

/**
 * Sign-in page — public route, no auth required.
 *
 * `SignInScreen` uses `useSearchParams()` to read the `?next=` redirect
 * param, which requires a Suspense boundary in Next.js App Router.
 */
export default function SignInPage() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
