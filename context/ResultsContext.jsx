'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const ResultsContext = createContext()

export function ResultsProvider({ children }) {
  const [results, setResults] = useState([])

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('deepguard_results')
    if (stored) setResults(JSON.parse(stored))
  }, [])

  const addResult = (result) => {
    const updated = [result, ...results]
    setResults(updated)
    localStorage.setItem('deepguard_results', JSON.stringify(updated))
  }

  const clearResults = () => {
    setResults([])
    localStorage.removeItem('deepguard_results')
  }

  return (
    <ResultsContext.Provider value={{ results, addResult, clearResults }}>
      {children}
    </ResultsContext.Provider>
  )
}

export function useResults() {
  return useContext(ResultsContext)
}