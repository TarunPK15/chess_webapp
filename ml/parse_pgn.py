import chess
import chess.pgn
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import random
import os

# Configuration
PGN_FILE = "lichess_db_standard_rated_2013-01.pgn" # Ensure this matches your unzipped file name
OUTPUT_FILE = "dataset.parquet"
MAX_GAMES = 50000  # We stop after 50k games to keep RAM usage safe
POSITIONS_PER_GAME = 10  # Sample 10 random positions per game to prevent correlation

# The 12 piece types in order for our 768-feature array
PIECES = [
    chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING
]
COLORS = [chess.WHITE, chess.BLACK]

def board_to_features(board):
    """
    Converts a python-chess board into a flat 768-element binary array.
    This represents 12 planes (one for each piece type and color) of 64 squares.
    """
    features = np.zeros(768, dtype=np.int8)
    
    for color_idx, color in enumerate(COLORS):
        for piece_idx, piece_type in enumerate(PIECES):
            # Get a bitboard of all squares containing this specific piece
            squares = board.pieces(piece_type, color)
            
            # Calculate the offset in the flat array
            # color_idx (0 or 1) * 6 pieces * 64 squares
            plane_offset = (color_idx * 6 + piece_idx) * 64
            
            for square in squares:
                features[plane_offset + square] = 1
                
    return features

def extract_dataset():
    print(f"Opening {PGN_FILE}...")
    
    if not os.path.exists(PGN_FILE):
        print(f"ERROR: Could not find {PGN_FILE}. Make sure it is unzipped and in the correct folder.")
        return

    # Prepare lists to hold our data before converting to a DataFrame
    feature_list = []
    label_list = []
    
    games_parsed = 0
    positions_extracted = 0

    with open(PGN_FILE, "r") as pgn:
        while games_parsed < MAX_GAMES:
            game = chess.pgn.read_game(pgn)
            if game is None:
                break  # End of file
                
            # Filter out aborted games or games with no clear result
            result = game.headers["Result"]
            if result == "1-0":
                label = 1.0  # White wins
            elif result == "0-1":
                label = 0.0  # Black wins
            elif result == "1/2-1/2":
                label = 0.5  # Draw
            else:
                continue

            # Play through the game to get all board positions
            board = game.board()
            positions = []
            
            for move in game.mainline_moves():
                board.push(move)
                # Only grab positions after move 10 to avoid highly repetitive openings
                if board.fullmove_number > 5: 
                    positions.append(board.copy())
            
            # Sample random positions from the game
            if len(positions) > POSITIONS_PER_GAME:
                sampled_positions = random.sample(positions, POSITIONS_PER_GAME)
            else:
                sampled_positions = positions

            for pos in sampled_positions:
                feature_vector = board_to_features(pos)
                feature_list.append(feature_vector)
                label_list.append(label)
                positions_extracted += 1

            games_parsed += 1
            
            if games_parsed % 5000 == 0:
                print(f"Parsed {games_parsed} games... Extracted {positions_extracted} positions.")

    print("\nParsing complete. Converting to DataFrame...")
    
    # Create column names (e.g., W_PAWN_0, B_KING_63)
    cols = [f"f_{i}" for i in range(768)]
    
    df = pd.DataFrame(feature_list, columns=cols)
    df["label"] = label_list
    
    print(f"Saving to {OUTPUT_FILE}...")
    df.to_parquet(OUTPUT_FILE, engine='pyarrow')
    
    print(f"Done! Dataset contains {len(df)} positions.")

if __name__ == "__main__":
    extract_dataset()