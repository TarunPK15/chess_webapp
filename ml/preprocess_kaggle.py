import pandas as pd
import numpy as np
import chess
import time
import os

CSV_FILE = "chessData.csv"
OUTPUT_FILE = "kaggle_2M.parquet"
TARGET_ROWS = 2_000_000

def parse_evaluation(eval_str):
    """Converts Kaggle's string evals ('-39', '#+2') into scaled floats [-1.0 to 1.0]"""
    try:
        if '#' in eval_str:
            # It's a forced mate. #+2 means White mates in 2.
            # We treat forced mate as a massive 15-pawn advantage.
            if '+' in eval_str or not eval_str.startswith('#-'):
                return 1.0  # White is winning completely
            else:
                return -1.0 # Black is winning completely
        else:
            # Standard centipawn evaluation
            cp = float(eval_str)
            pawns = cp / 100.0
            clamped = max(-15.0, min(15.0, pawns))
            return clamped / 15.0
    except:
        return 0.0

def extract_features(fen):
    """Converts FEN to the 768-element AlphaZero array."""
    board = chess.Board(fen)
    features = np.zeros(768, dtype=np.float32)
    piece_map = {chess.PAWN: 0, chess.KNIGHT: 1, chess.BISHOP: 2, chess.ROOK: 3, chess.QUEEN: 4, chess.KING: 5}
    
    for color_idx, color in enumerate([chess.WHITE, chess.BLACK]):
        for piece_type in piece_map:
            for square in board.pieces(piece_type, color):
                plane = (color_idx * 6) + piece_map[piece_type]
                features[plane * 64 + square] = 1.0
    return features

def preprocess():
    if not os.path.exists(CSV_FILE):
        print(f"ERROR: Cannot find {CSV_FILE}.")
        return

    print("Loading 16-million row CSV into RAM (this takes a moment)...")
    # We load the CSV and instantly take a random 2-million row sample to save memory
    df = pd.read_csv(CSV_FILE).sample(n=TARGET_ROWS, random_state=42)
    
    print(f"Successfully sampled {TARGET_ROWS} positions. Beginning extraction...")
    start_time = time.time()
    
    # We will build the 768 matrix row by row
    features_list = []
    labels_list = []
    
    for idx, (index, row) in enumerate(df.iterrows()):
        fen = row['FEN']
        eval_str = str(row['Evaluation'])
        
        features_list.append(extract_features(fen))
        labels_list.append(parse_evaluation(eval_str))
        
        if (idx + 1) % 100_000 == 0:
            elapsed = time.time() - start_time
            print(f"Processed {idx + 1} / {TARGET_ROWS} boards... ({elapsed:.1f}s)")

    print("Converting to mathematically pure DataFrames...")
    # Convert lists to massive numpy arrays
    X = np.array(features_list, dtype=np.float32)
    y = np.array(labels_list, dtype=np.float32).reshape(-1, 1)
    
    # Combine into one DataFrame and save
    final_data = np.hstack((X, y))
    
    cols = [str(i) for i in range(768)] + ['label']
    final_df = pd.DataFrame(final_data, columns=cols)
    
    print(f"Saving to {OUTPUT_FILE} (This will take a minute or two)...")
    final_df.to_parquet(OUTPUT_FILE)
    
    total_time = time.time() - start_time
    print(f"Done! 2-Million row elite dataset created in {total_time:.1f} seconds.")

if __name__ == "__main__":
    preprocess()