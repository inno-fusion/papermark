"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useState } from "react";

import { signIn } from "next-auth/react";

import Google from "@/components/shared/icons/google";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { next } = useParams as { next?: string };

  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="flex h-screen w-full justify-center">
      <div
        className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
          style={{
            clipPath:
              "polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)",
          }}
        />
      </div>
      <div className="z-10 mx-5 mt-[calc(20vh)] h-fit w-full max-w-md overflow-hidden rounded-lg border border-border bg-gray-50 dark:bg-gray-900 sm:mx-0 sm:shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 px-4 py-6 pt-8 text-center sm:px-16">
          <Link href="/">
            <img
              src="/_static/papermark-logo.svg"
              alt="Logo"
              className="h-16 w-auto"
            />
          </Link>
          <h3 className="text-2xl font-medium text-foreground">DocRoom</h3>
          <p className="text-sm text-muted-foreground">
            Share documents. Not attachments.
          </p>
        </div>
        <div className="flex flex-col space-y-4 px-4 py-8 sm:px-16">
          <Button
            onClick={() => {
              setIsLoading(true);
              signIn("google", {
                ...(next && next.length > 0 ? { callbackUrl: next } : {}),
              }).finally(() => setIsLoading(false));
            }}
            disabled={isLoading}
            className="flex w-full items-center justify-center space-x-2"
          >
            <Google className="h-5 w-5" />
            <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By clicking continue, you acknowledge that you have read and agree
            to our{" "}
            <a
              href="https://0xmetalabs.com/terms-of-use/"
              target="_blank"
              className="underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://0xmetalabs.com/privacy-policy/"
              target="_blank"
              className="underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
