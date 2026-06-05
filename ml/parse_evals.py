import chess.pgn
import pandas as pd
import numpy as np
import time
import os

PGN_FILE = "lichess_db_standard_rated_2013-01.pgn"
OUTPUT_FILE = "dataset_evals.parquet"
TARGET_POSITIONS = 300000  # A beefy dataset of absolute truth

def extract_features(board):
    features = np.zeros(768, dtype=np.float32)
    piece_map = {chess.PAWN: 0, chess.KNIGHT: 1, chess.BISHOP: 2, chess.ROOK: 3, chess.QUEEN: 4, chess.KING: 5}
    
    for color_idx, color in enumerate([chess.WHITE, chess.BLACK]):
        for piece_type in piece_map:
            for square in board.pieces(piece_type, color):
                plane = (color_idx * 6) + piece_map[piece_type]
                features[plane * 64 + square] = 1.0
    return features

def parse():
    if not os.path.exists(PGN_FILE):
        print(f"ERROR: Cannot find {PGN_FILE}.")
        return

    pgn = open(PGN_FILE, "r")
    data = []
    games_parsed = 0
    games_with_evals = 0
    
    print(f"Hunting for {TARGET_POSITIONS} Stockfish-evaluated positions...")
    start_time = time.time()
    
    while len(data) < TARGET_POSITIONS:
        try:
            game = chess.pgn.read_game(pgn)
        except Exception:
            continue
            
        if game is None:
            print("Reached end of PGN file!")
            break
            
        games_parsed += 1
        node = game.next()
        has_evals = False
        
        while node is not None:
            eval_obj = node.eval()
            if eval_obj is not None:
                has_evals = True
                
                # Extract centipawns (Mates are capped at +/- 1000 cp)
                score_cp = eval_obj.white().score(mate_score=1000)
                
                # Convert to pawns (e.g. 150 cp = 1.5 pawns)
                pawns = score_cp / 100.0
                
                # Clamp between -15.0 and +15.0 pawns
                clamped = max(-15.0, min(15.0, pawns))
                
                # Scale to [-1.0, 1.0] for our PyTorch Tanh layer
                scaled_score = clamped / 15.0
                
                features = extract_features(node.board())
                
                # Append flat row: 768 features + 1 label
                row = np.append(features, scaled_score)
                data.append(row)
                
                if len(data) % 25000 == 0:
                    print(f"Extracted {len(data)} evaluated positions...")
                    
                if len(data) >= TARGET_POSITIONS:
                    break
                    
            node = node.next()
            
        if has_evals:
            games_with_evals += 1
            
    print(f"\nParsing complete in {time.time() - start_time:.1f} seconds.")
    print(f"Scanned {games_parsed} games. Found Stockfish evals in {games_with_evals} games.")
    
    print(f"Saving to {OUTPUT_FILE}...")
    df = pd.DataFrame(data)
    
    # Rename the last column to 'label'
    cols = list(range(768))
    cols.append('label')
    df.columns = cols
    
    df.to_parquet(OUTPUT_FILE)
    print(f"Done! Evaluated dataset saved as {OUTPUT_FILE}.")

if __name__ == "__main__":
    parse()