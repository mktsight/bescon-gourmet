import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface RecordContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  postedVersion: number
  notifyPosted: () => void
}

const RecordContext = createContext<RecordContextType>({} as RecordContextType)
export const useRecord = () => useContext(RecordContext)

export function RecordProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [postedVersion, setPostedVersion] = useState(0)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const notifyPosted = useCallback(() => setPostedVersion(v => v + 1), [])
  const value = useMemo(
    () => ({ isOpen, open, close, postedVersion, notifyPosted }),
    [isOpen, open, close, postedVersion, notifyPosted],
  )
  return (
    <RecordContext.Provider value={value}>
      {children}
    </RecordContext.Provider>
  )
}
