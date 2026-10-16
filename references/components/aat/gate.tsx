"use client";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AAT_CONFIG } from "./config";

/** Loaded only for admins, so visitors never download the tool. */
const Aat = dynamic(() => import("./aat").then((m) => m.Aat), { ssr: false });

const FLAG = `${AAT_CONFIG.storagePrefix}.admin`;
const readFlag = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } };
const noop = () => () => {};
const writeFlag = (on: boolean) => { try { if (on) localStorage.setItem(FLAG, "1"); else localStorage.removeItem(FLAG); } catch {} };

/**
 * AAT (Admin Annotation Tool) gate. Shows the floating tool to admins on every page.
 * - `isAdmin`: pass it wherever the app already knows the user (signed-in pages). No extra request.
 * - `checkAdmin`: for pages where the user is not loaded (public pages). It is called only when this
 *   browser has seen an admin before, so visitors never trigger a request.
 * Any error inside the tool is contained here and never reaches the page.
 */
export function AatGate({ isAdmin, checkAdmin }: { isAdmin?: boolean | null; checkAdmin?: () => Promise<boolean> }) {
  const known = typeof isAdmin === "boolean";
  const hinted = useSyncExternalStore(noop, readFlag, () => false);
  const [checked, setChecked] = useState(false);
  const check = useRef(checkAdmin);
  useEffect(() => { check.current = checkAdmin; });

  useEffect(() => { if (known) writeFlag(isAdmin); }, [known, isAdmin]);
  useEffect(() => {
    if (known || !hinted || !check.current) return;
    let live = true;
    check.current().then(
      (ok) => { if (live) { setChecked(ok); writeFlag(ok); } },
      () => { if (live) { setChecked(false); writeFlag(false); } },
    );
    return () => { live = false; };
  }, [known, hinted]);

  if (!(known ? isAdmin : checked)) return null;
  return <Contain><Aat /></Contain>;
}

class Contain extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("[AAT] stopped:", e); }
  render() { return this.state.failed ? null : this.props.children; }
}
