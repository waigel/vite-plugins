"use client";

import { useRouter as useRouter_ } from "@hiogawa/react-server/client";
import React from "react";

export function useSearchParams() {
  const search = useRouter_((s) => s.location.search);
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export function usePathname() {
  return useRouter_((s) => s.location.pathname);
}

/** @todo */
export function useParams() {}

/** @todo */
export function useSelectedLayoutSegments() {}

export function useRouter() {
  const history = useRouter_((s) => s.history);
  return history;
}

export type * from "./navigation.react-server";