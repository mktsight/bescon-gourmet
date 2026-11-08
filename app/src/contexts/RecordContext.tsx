import { createContext, useContext, useState } from 'react'
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
  return (
    <RecordContext.Provider value={{
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      postedVersion,
      notifyPosted: () => setPostedVersion(v => v + 1),
    }}>
      {children}
    </RecordContext.Provider>
  )
}
