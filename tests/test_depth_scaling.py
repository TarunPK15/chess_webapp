import time
import pytest
from engine.game_state import GameState
from engine.chess_engine import ChessEngine

# 3 Distinct Game States
FENS = {
    "1. Opening (Standard Start)": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
    "2. Midgame (High Tension)": "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 0 1",
    "3. Endgame (Kings & Pawn)": "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1"
}

def test_depth_scaling():
    print("\n\n" + "="*50)
    print(" ENGINE PERFORMANCE & DEPTH SCALING TEST (MAX DEPTH 7)")
    print("="*50)
    
    for state_name, fen in FENS.items():
        print(f"\n--- {state_name} ---")
        gs = GameState()
        gs.load_from_fen(fen)
        
        # Test depths 1 through 7 (range goes up to but not including 8)
        for depth in range(1, 8):
            engine = ChessEngine(depth=depth)
            
            # Start timer
            start_time = time.perf_counter()
            best_move = engine.get_best_move(gs)
            end_time = time.perf_counter()
            
            elapsed_time = end_time - start_time
            
            # Format output
            move_str = f"{best_move[0]} to {best_move[1]}" if best_move else "None"
            print(f"Depth {depth} | Time: {elapsed_time:7.3f}s | Nodes: {engine.nodes_evaluated:8d} | Move: {move_str}")
            
            # Safety cutoff: Increased to 60 seconds (1 minute)
            if elapsed_time > 60.0 and depth < 7:
                print(f"  [!] Stopping deeper searches for {state_name}. Previous depth took > 1 minute.")
                break