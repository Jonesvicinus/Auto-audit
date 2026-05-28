"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

// Soft fade + slight upward slide on route change.
// Honors prefers-reduced-motion via the global CSS rule in globals.css plus
// a media-query check here for the framer values.
function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0, y: -4 }}
        transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
