import { useState, useEffect, useCallback } from "react";

// Bookmarked jobs and events, kept in this browser only
const KEY = "bto-saved";
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

export default function useSaved() {
  const [saved, setSaved] = useState(read);

  // Keep several cards (and tabs) in sync
  useEffect(() => {
    const sync = () => setSaved(read());
    window.addEventListener("bto-saved", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bto-saved", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id) => {
    const next = read().includes(id) ? read().filter((x) => x !== id) : [...read(), id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: bookmarks just won't persist */
    }
    setSaved(next);
    window.dispatchEvent(new Event("bto-saved"));
    return next.includes(id);
  }, []);

  return { saved, isSaved: (id) => saved.includes(id), toggle };
}
