import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const BOARD_THEMES = {
  green: { dark: '#739552', light: '#ebecd0', name: 'Green (Default)' },
  blue: { dark: '#4b7399', light: '#eae9d2', name: 'Blue' },
  wood: { dark: '#b58863', light: '#f0d9b5', name: 'Classic Wood' },
  purple: { dark: '#7a668c', light: '#cac0d2', name: 'Purple' }
};

export const PIECE_SETS = {
  unicode: { name: 'Standard Unicode' },
  merida: { name: 'Lichess Merida' }
};

export function SettingsProvider({ children }) {
  const [boardTheme, setBoardTheme] = useState(() => {
    const saved = localStorage.getItem('boardTheme');
    return saved && BOARD_THEMES[saved] ? saved : 'green';
  });

  const [pieceSet, setPieceSet] = useState(() => {
    const saved = localStorage.getItem('pieceSet');
    return saved && PIECE_SETS[saved] ? saved : 'unicode';
  });

  useEffect(() => {
    localStorage.setItem('boardTheme', boardTheme);
  }, [boardTheme]);

  useEffect(() => {
    localStorage.setItem('pieceSet', pieceSet);
  }, [pieceSet]);

  return (
    <SettingsContext.Provider value={{
      boardTheme, setBoardTheme,
      pieceSet, setPieceSet
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
