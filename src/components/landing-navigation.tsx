"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";

import { InlayaMark } from "~/components/inlaya-mark";
import { ModeToggle } from "~/components/mode-toggle";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

const links = [
  { href: "#meaning", label: "Why Inlaya" },
  { href: "#workflow", label: "Workflow" },
  { href: "#safety", label: "Safety" },
];

export function LandingNavigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#171713]/15 bg-[#f3efe5]/90 text-[#171713] backdrop-blur-xl dark:border-[#fffaf0]/15 dark:bg-[#11110f]/90 dark:text-[#f3efe5]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="Inlaya home">
          <InlayaMark />
          <span className="inlaya-display text-xl font-semibold tracking-[-0.04em]">
            Inlaya
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              className="transition-colors hover:text-[#f04f2f]"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ModeToggle />
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-2 text-sm font-medium transition-colors hover:text-[#f04f2f]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center bg-[#171713] px-4 text-xs font-semibold text-[#fffaf0] transition hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713] dark:hover:bg-[#f04f2f]"
            >
              Get started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/projects"
              className="inline-flex h-9 items-center gap-2 bg-[#171713] px-4 text-xs font-semibold text-[#fffaf0] transition hover:bg-[#f04f2f] dark:bg-[#fffaf0] dark:text-[#171713] dark:hover:bg-[#f04f2f]"
            >
              Projects <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </SignedIn>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ModeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center border border-[#171713]/20 bg-[#fffaf0]/50 transition hover:bg-[#fffaf0] dark:border-[#fffaf0]/20 dark:bg-white/5 dark:hover:bg-white/10"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(86vw,360px)] border-[#171713]/20 bg-[#f3efe5] p-0 text-[#171713] dark:border-[#fffaf0]/15 dark:bg-[#11110f] dark:text-[#f3efe5]"
            >
              <SheetHeader className="border-b border-[#171713]/15 p-6 text-left dark:border-[#fffaf0]/15">
                <SheetTitle className="flex items-center gap-3 text-[#171713] dark:text-[#f3efe5]">
                  <InlayaMark className="h-7 w-7" />
                  <span className="inlaya-display text-xl">Inlaya</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col p-6">
                {links.map((link, index) => (
                  <SheetClose asChild key={link.href}>
                    <a
                      href={link.href}
                      className="flex items-center justify-between border-b border-[#171713]/15 py-5 text-lg font-medium transition-colors hover:text-[#f04f2f] dark:border-[#fffaf0]/15"
                    >
                      <span>{link.label}</span>
                      <span className="font-mono text-[10px] text-[#827c70]">
                        0{index + 1}
                      </span>
                    </a>
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto border-t border-[#171713]/15 p-6 dark:border-[#fffaf0]/15">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#827c70]">
                    Appearance
                  </span>
                  <ModeToggle />
                </div>
                <SignedOut>
                  <div className="grid grid-cols-2 gap-2">
                    <SheetClose asChild>
                      <Link
                        href="/sign-in"
                        className="inline-flex h-11 items-center justify-center border border-[#171713]/20 text-sm font-semibold dark:border-[#fffaf0]/20"
                      >
                        Sign in
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        href="/sign-up"
                        className="inline-flex h-11 items-center justify-center bg-[#171713] text-sm font-semibold text-[#fffaf0] dark:bg-[#fffaf0] dark:text-[#171713]"
                      >
                        Get started
                      </Link>
                    </SheetClose>
                  </div>
                </SignedOut>
                <SignedIn>
                  <SheetClose asChild>
                    <Link
                      href="/projects"
                      className="inline-flex h-11 w-full items-center justify-center gap-2 bg-[#171713] text-sm font-semibold text-[#fffaf0] dark:bg-[#fffaf0] dark:text-[#171713]"
                    >
                      Open projects <ArrowRight className="h-4 w-4" />
                    </Link>
                  </SheetClose>
                </SignedIn>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
