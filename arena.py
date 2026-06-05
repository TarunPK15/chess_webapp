import time
from engine.game_state import GameState
from engine.chess_engine import ChessEngine
from engine.move_generator import apply_move, get_legal_moves, is_in_check

def run_arena(max_moves=100):
    print("--- STONKFISH ARENA ---")
    print("White: ML3 StonkFish (Depth 3)")
    print("Black: Greedy StonkFish (Depth 3)\n")
    
    # Initialize engines per your constraints
    white_engine = ChessEngine(mode='ml3', depth=2)
    black_engine = ChessEngine(mode='greedy', depth=2)
    
    gs = GameState()
    gs.load_from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    
    for move_number in range(1, max_moves + 1):
        legal_moves = get_legal_moves(gs)
        
        # Check end game conditions
        if not legal_moves:
            color_to_move = 'W' if gs.turn == 'w' else 'B'
            if is_in_check(gs, color_to_move):
                winner = "Black (Greedy)" if gs.turn == 'w' else "White (ML)"
                print(f"\n🏆 CHECKMATE! {winner} wins.")
            else:
                print("\n🤝 STALEMATE! It's a draw.")
            return

        print(f"\n--- Move {move_number} (Turn: {gs.turn.upper()}) ---")
        start_time = time.time()
        
        # Engine thinking
        if gs.turn == 'w':
            best_move = white_engine.get_best_move(gs)
            engine_name = "ML (Depth 2)"
            nodes = white_engine.nodes_evaluated
        else:
            best_move = black_engine.get_best_move(gs)
            engine_name = "Greedy (Depth 3)"
            nodes = black_engine.nodes_evaluated
            
        elapsed = time.time() - start_time
        
        piece, target = best_move
        print(f"{engine_name} plays {piece} to {target}")
        print(f"Time: {elapsed:.3f}s | Nodes Searched: {nodes}")
        
        # Apply the move to the board
        gs = apply_move(gs, piece, target)
        
    print("\n⚠️ Game stopped due to max moves limit.")

if __name__ == "__main__":
    run_arena()