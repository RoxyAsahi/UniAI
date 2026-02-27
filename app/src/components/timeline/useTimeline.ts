import { useCallback, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Message } from "@/api/types.tsx";
import {
  setActiveMessageIndex,
  setStarredIndices,
  addStarredIndex,
  removeStarredIndex,
  useActiveMessageIndex,
  useStarredIndices,
} from "@/store/timeline";
import {
  starMessage as apiStar,
  unstarMessage as apiUnstar,
  getStarredMessages,
} from "@/api/star";

export function useTimeline(conversationId: number, messages: Message[]) {
  const dispatch = useDispatch();
  const activeIndex = useActiveMessageIndex();
  const starredIndices = useStarredIndices();

  // Load starred messages on mount
  useEffect(() => {
    if (conversationId <= 0) return;
    getStarredMessages(conversationId).then((starred) => {
      dispatch(setStarredIndices(starred.map((s) => s.message_index)));
    });
  }, [conversationId, dispatch]);

  const scrollToMessage = useCallback(
    (index: number) => {
      const el = document.querySelector(`[data-message-index="${index}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      dispatch(setActiveMessageIndex(index));
    },
    [dispatch],
  );

  // j/k keyboard navigation (skip when input focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA"].includes(tag)) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === "j") {
        scrollToMessage(Math.min(activeIndex + 1, messages.length - 1));
      } else if (e.key === "k") {
        scrollToMessage(Math.max(activeIndex - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, messages.length, scrollToMessage]);

  // IntersectionObserver to auto-update activeIndex
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = entry.target.getAttribute("data-message-index");
            if (idx !== null) {
              dispatch(setActiveMessageIndex(parseInt(idx, 10)));
            }
          }
        });
      },
      { threshold: 0.5 },
    );
    document
      .querySelectorAll("[data-message-index]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [messages.length, dispatch]);

  const toggleStar = useCallback(
    async (index: number) => {
      const isStarred = starredIndices.includes(index);
      if (isStarred) {
        const ok = await apiUnstar(conversationId, index);
        if (ok) dispatch(removeStarredIndex(index));
      } else {
        const ok = await apiStar(conversationId, index);
        if (ok) dispatch(addStarredIndex(index));
      }
    },
    [conversationId, starredIndices, dispatch],
  );

  return { activeIndex, starredIndices, scrollToMessage, toggleStar };
}
