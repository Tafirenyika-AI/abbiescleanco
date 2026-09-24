"use client";

import { useCallback, useState } from "react";

/** Row multi-select for admin list tables -- one shared implementation instead of each list
 *  reinventing its own Set<string> selection state. `ids` is the current page/filtered list of
 *  selectable row ids; selection is cleared whenever the caller calls clear() (e.g. after a bulk
 *  delete succeeds), never automatically on `ids` changing, so a filter change doesn't silently
 *  drop what the admin picked. */
export function useBulkSelect(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === ids.length && ids.length > 0 ? new Set() : new Set(ids)));
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, toggleAll, clear, isAllSelected: ids.length > 0 && selected.size === ids.length };
}
