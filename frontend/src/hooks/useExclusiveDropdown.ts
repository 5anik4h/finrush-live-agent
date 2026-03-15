/**
 * Hook para manejar dropdowns mutuamente excluyentes
 * Solo un dropdown puede estar abierto a la vez
 *
 * Uso:
 * const { openId, setOpen, closeAll } = useExclusiveDropdown();
 *
 * <DropdownMenu open={openId === 'menu1'} onOpenChange={(isOpen) => setOpen(isOpen ? 'menu1' : null)}>
 */

import { useState, useCallback } from 'react';

export function useExclusiveDropdown() {
  const [openId, setOpenId] = useState<string | null>(null);

  const setOpen = useCallback((id: string | null) => {
    setOpenId(id);
  }, []);

  const closeAll = useCallback(() => {
    setOpenId(null);
  }, []);

  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return { openId, setOpen, closeAll, toggle };
}
