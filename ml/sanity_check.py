import pandas as pd
import numpy as np

DATA_FILE = "dataset.parquet"

def run_sanity_check():
    print(f"Loading {DATA_FILE} for inspection...\n")
    df = pd.read_parquet(DATA_FILE)
    
    # Separate features (768 columns) from labels
    features = df.drop('label', axis=1)
    labels = df['label']

    print("--- LABEL DISTRIBUTION ---")
    white_wins = (labels == 1.0).mean() * 100
    black_wins = (labels == 0.0).mean() * 100
    draws = (labels == 0.5).mean() * 100
    print(f"White Wins: {white_wins:.1f}%")
    print(f"Black Wins: {black_wins:.1f}%")
    print(f"Draws:      {draws:.1f}%\n")

    print("--- PIECE COUNT LIMITS ---")
    # The 768 array is structured as 12 planes of 64 squares.
    # W_P, W_N, W_B, W_R, W_Q, W_K, B_P, B_N, B_B, B_R, B_Q, B_K
    
    piece_names = ['White Pawns', 'White Knights', 'White Bishops', 'White Rooks', 'White Queens', 'White Kings',
                   'Black Pawns', 'Black Knights', 'Black Bishops', 'Black Rooks', 'Black Queens', 'Black Kings']
    
    piece_counts = {}
    for i in range(12):
        # Extract the 64 columns for this specific piece plane
        plane_cols = features.iloc[:, (i*64):((i+1)*64)]
        # Sum across the 64 squares to get the total count of this piece per position
        counts = plane_cols.sum(axis=1)
        piece_counts[piece_names[i]] = counts
        
        max_seen = counts.max()
        avg_seen = counts.mean()
        
        # Flag obvious errors (e.g., more than 1 king, or more than 8 pawns)
        warning = ""
        if 'Kings' in piece_names[i] and max_seen > 1:
            warning = " <-- [WARNING] INVALID KING COUNT!"
        elif 'Pawns' in piece_names[i] and max_seen > 8:
            warning = " <-- [WARNING] INVALID PAWN COUNT!"
            
        print(f"{piece_names[i]:<15}: Max = {max_seen}, Avg = {avg_seen:.2f}{warning}")

    print("\n--- MATERIAL BALANCE ---")
    # Traditional piece values: P=1, N=3, B=3, R=5, Q=9
    w_mat = (piece_counts['White Pawns'] * 1 + 
             piece_counts['White Knights'] * 3 + 
             piece_counts['White Bishops'] * 3 + 
             piece_counts['White Rooks'] * 5 + 
             piece_counts['White Queens'] * 9)
             
    b_mat = (piece_counts['Black Pawns'] * 1 + 
             piece_counts['Black Knights'] * 3 + 
             piece_counts['Black Bishops'] * 3 + 
             piece_counts['Black Rooks'] * 5 + 
             piece_counts['Black Queens'] * 9)
             
    balance = w_mat - b_mat
    
    print(f"Average Material Balance (White - Black): {balance.mean():.3f} points")
    print(f"Max White Advantage: +{balance.max()} points")
    print(f"Max Black Advantage: {balance.min()} points")
    
    # Check if any positions have more than 32 total pieces (impossible in chess)
    total_pieces = features.sum(axis=1)
    max_total = total_pieces.max()
    print(f"\nMax Total Pieces on Board: {max_total} (Should be <= 32)")
    
    if max_total <= 32:
        print("\n✅ SANITY CHECK PASSED: Data looks mathematically sound for chess.")
    else:
        print("\n❌ SANITY CHECK FAILED: Found positions with too many pieces.")

if __name__ == "__main__":
    run_sanity_check()