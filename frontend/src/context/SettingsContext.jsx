import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const BOARD_THEMES = {
  green: { dark: '#739552', light: '#ebecd0', name: 'Green (Default)' },
  blue: { dark: '#4b7399', light: '#eae9d2', name: 'Blue' },
  wood: { dark: '#b58863', light: '#f0d9b5', name: 'Classic Wood' },
  purple: { dark: '#7a668c', light: '#cac0d2', name: 'Purple' },
  brown: { dark: '#8B5A2B', light: '#FFE4B5', name: 'Brown' },
  gray: { dark: '#888888', light: '#E0E0E0', name: 'Monochrome' },
  ocean: { dark: '#006994', light: '#B0E0E6', name: 'Ocean' },
  cherry: { dark: '#8B0000', light: '#FFC0CB', name: 'Cherry' },
  midnight: { dark: '#2C3E50', light: '#BDC3C7', name: 'Midnight' },
  mint: { dark: '#4CAF50', light: '#C8E6C9', name: 'Mint' },
  sand: { dark: '#C2B280', light: '#F5DEB3', name: 'Desert Sand' },
  pink: { dark: '#FF69B4', light: '#FFB6C1', name: 'Bubblegum' }
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
