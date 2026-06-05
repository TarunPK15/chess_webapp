import time
from engine.game_state import GameState
from engine.chess_engine import ChessEngine
from engine.move_generator import apply_move

def print_board(gs):
    """A quick visualizer for the terminal"""
    board = [['.' for _ in range(8)] for _ in range(8)]
    for piece, pos in gs.white.items():
        board[8 - pos[1]][pos[0] - 1] = piece[1].upper()
    for piece, pos in gs.black.items():
        board[8 - pos[1]][pos[0] - 1] = piece[1].lower()
    
    print("\n  1 2 3 4 5 6 7 8")
    for i, row in enumerate(board):
        print(f"{8-i} {' '.join(row)}")
    print()

def run_arena():
    print("⚔️ --- THE ULTIMATE SHOWDOWN --- ⚔️")
    print("⚪ DAVID (C++ Heuristics, Depth 4+)")
    print("⚫ GOLIATH (ONNX Neural Net, Depth 3)")
    print("-----------------------------------\n")

    # Initialize engines
    david = ChessEngine(mode='greedy', depth=5)
    goliath = ChessEngine(mode='ml3', depth=2) 
    
    gs = GameState()
    
    # --- FIX: INITIALIZE THE STARTING BOARD ---
    gs.white = {
        'WR1': [1, 1], 'WN1': [2, 1], 'WB1': [3, 1], 'WQ1': [4, 1], 'WK1': [5, 1], 'WB2': [6, 1], 'WN2': [7, 1], 'WR2': [8, 1],
        'WP1': [1, 2], 'WP2': [2, 2], 'WP3': [3, 2], 'WP4': [4, 2], 'WP5': [5, 2], 'WP6': [6, 2], 'WP7': [7, 2], 'WP8': [8, 2]
    }
    gs.black = {
        'BR1': [1, 8], 'BN1': [2, 8], 'BB1': [3, 8], 'BQ1': [4, 8], 'BK1': [5, 8], 'BB2': [6, 8], 'BN2': [7, 8], 'BR2': [8, 8],
        'BP1': [1, 7], 'BP2': [2, 7], 'BP3': [3, 7], 'BP4': [4, 7], 'BP5': [5, 7], 'BP6': [6, 7], 'BP7': [7, 7], 'BP8': [8, 7]
    }
    gs.turn = 'w'
    # ------------------------------------------
    
    move_number = 1
    while gs.result == "*":
        engine = david if gs.turn == 'w' else goliath
        engine_name = "⚪ David" if gs.turn == 'w' else "⚫ Goliath"
        
        start_time = time.time()
        best_move = engine.get_best_move(gs)
        calc_time = time.time() - start_time
        
        if not best_move:
            print(f"🛑 {engine_name} has no legal moves left!")
            break
            
        piece, target = best_move
        print(f"Move {move_number}: {engine_name} plays {piece} to {target} (Thought for {calc_time:.2f}s)")
        
        gs = apply_move(gs, piece, target)
        
        if move_number % 10 == 0 or gs.result != "*":
            print_board(gs)
            
        move_number += 1
        
        if move_number > 200:
            print("🛑 Game aborted! 200 Move Limit Reached (Draw).")
            break

    print(f"\n🏆 MATCH FINISHED! Official Result: {gs.result}")
    print_board(gs)

if __name__ == "__main__":
    run_arena()