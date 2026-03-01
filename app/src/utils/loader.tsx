import React from "react";
import {
  closeSpinnerType,
  openSpinnerType,
  spinnerEvent,
} from "@/events/spinner.ts";
import { generateListNumber } from "@/utils/base.ts";

const lazyReloadKey = "__coai_lazy_reload__";
const lazyReloadCooldownMs = 15 * 1000;

type LazyReloadState = {
  path: string;
  timestamp: number;
};

function canAutoReload(error: unknown): boolean {
  const message = String((error as Error)?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("chunkloaderror") ||
    message.includes("loading chunk")
  );
}

function getReloadState(): LazyReloadState | null {
  const raw = sessionStorage.getItem(lazyReloadKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LazyReloadState;
    if (!parsed.path || !parsed.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shouldReloadCurrentPath(): boolean {
  const state = getReloadState();
  if (!state) return true;

  const now = Date.now();
  const samePath = state.path === window.location.pathname;
  const inCooldown = now - state.timestamp < lazyReloadCooldownMs;

  return !(samePath && inCooldown);
}

export function lazyFactor<T extends React.ComponentType<any>>(
  factor: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  /**
   * Lazy load factor
   * @see https://reactjs.org/docs/code-splitting.html#reactlazy
   *
   * @example
   * lazyFactor(() => import("./factor.tsx"));
   */

  return React.lazy(() => {
    return new Promise((resolve, reject) => {
      const task = generateListNumber(6);
      const id = setTimeout(
        () =>
          spinnerEvent.emit({
            id: task,
            type: openSpinnerType,
          }),
        1000,
      );

      factor()
        .then((module) => {
          clearTimeout(id);
          spinnerEvent.emit({
            id: task,
            type: closeSpinnerType,
          });
          resolve(module);
        })
        .catch((error) => {
          clearTimeout(id);
          spinnerEvent.emit({
            id: task,
            type: closeSpinnerType,
          });

          if (
            canAutoReload(error) &&
            shouldReloadCurrentPath()
          ) {
            sessionStorage.setItem(
              lazyReloadKey,
              JSON.stringify({
                path: window.location.pathname,
                timestamp: Date.now(),
              }),
            );

            const url = new URL(window.location.href);
            url.searchParams.set("_lazy_reload", Date.now().toString());
            window.location.replace(url.toString());
            return;
          }

          console.warn(`[factor] cannot load factor: ${error}`);
          reject(error);
        });
    });
  });
}
