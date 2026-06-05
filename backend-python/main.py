import sys
import os
import traceback
# Add the parent directory to the Python path so we can import 'engine'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from engine.game_state import GameState
from engine.chess_engine import ChessEngine
from engine.move_generator import get_legal_moves, apply_move, is_in_check

app = FastAPI(title="Stonkfish Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Your React Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global engine cache
engines = {}

@app.on_event("startup")
async def startup_event():
    # Remove emoji to prevent UnicodeEncodeError on Windows terminals
    print("Booting Stonkfish FastAPI Microservice...")
    print("Loading Engine Configurations into RAM. This may take 5-10 seconds...")
    
    # Pre-load all combinations of mode and depth
    for mode in ['greedy', 'ml3']:
        for depth in [1, 2, 3]:
            print(f"Loading {mode.upper()} - Depth {depth}...")
            engines[(mode, depth)] = ChessEngine(mode=mode, depth=depth)
            
    print("All Engines loaded and waiting for moves.")

# --- Pydantic Models for Request Validation ---
class MoveRequest(BaseModel):
    game_state: Dict[str, Any]
    engine_mode: str
    depth: int = 3

class ValidateRequest(BaseModel):
    game_state: Dict[str, Any]
    piece: str
    target: List[int]

class LegalMovesRequest(BaseModel):
    game_state: Dict[str, Any]

class AnalyzeRequest(BaseModel):
    move_history: List[str]
    human_color: str = 'w'

# --- Endpoints ---
@app.post("/move")
async def get_engine_move(request: MoveRequest):
    try:
        # THE FIX: Assign the result of the classmethod directly to gs
        gs = GameState.from_dict(request.game_state)
        
        # Pull the exact requested engine from the cache
        engine_key = (request.engine_mode, request.depth)
        engine = engines.get(engine_key, engines.get(('ml3', 3))) # Safe fallback
        
        # Get the best move
        best_move = engine.get_best_move(gs)
        
        if not best_move:
            # If no best move, it's either checkmate or stalemate
            color = 'W' if gs.turn == 'w' else 'B'
            is_mate = is_in_check(gs, color)
            return {
                "piece": None,
                "target": None,
                "updated_state": gs.to_dict(),
                "is_checkmate": is_mate,
                "is_stalemate": not is_mate,
                "eval_score": 0.0
            }

        piece, target = best_move
        updated_gs = apply_move(gs, piece, target)
        
        # Check end conditions for the new state
        next_color = 'W' if updated_gs.turn == 'w' else 'B'
        next_legal_moves = get_legal_moves(updated_gs)
        is_mate = len(next_legal_moves) == 0 and is_in_check(updated_gs, next_color)
        is_stale = len(next_legal_moves) == 0 and not is_in_check(updated_gs, next_color)
        
        # Evaluate the position
        eval_score = engine.evaluate(updated_gs)

        return {
            "piece": piece,
            "target": target,
            "updated_state": updated_gs.to_dict(),
            "is_checkmate": is_mate,
            "is_stalemate": is_stale,
            "eval_score": eval_score
        }
    except Exception as e:
        print("\n❌ PYTHON CRASH IN /move:")
        traceback.print_exc()
        print("\n")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate-move")
async def validate_move(request: ValidateRequest):
    try:
        # THE FIX: Assign the result of the classmethod directly to gs
        gs = GameState.from_dict(request.game_state)

        # --- TEMPORARY PRINT TO DEBUG ---
        print(f"DEBUG: Active White Pieces in Python: {list(gs.white.keys())}")
        # ----------------------------------------
        
        legal_moves = get_legal_moves(gs)
        
        # Check if the requested move is in the legal moves list
        is_valid = False
        for m in legal_moves:
            if m[0] == request.piece and list(m[1]) == list(request.target):
                is_valid = True
                break
                
        if not is_valid:
            print(f"⚠️ Validation Rejected: {request.piece} to {request.target}")
            available = [list(m[1]) for m in legal_moves if m[0] == request.piece]
            print(f"   Available targets for {request.piece}: {available}")
        
        updated_state_dict = None
        if is_valid:
            updated_gs = apply_move(gs, request.piece, request.target)
            updated_state_dict = updated_gs.to_dict()
            
        return {
            "valid": is_valid,
            "updated_state": updated_state_dict
        }
    except Exception as e:
        print("Validation Crash:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/legal-moves")
async def legal_moves(request: LegalMovesRequest):
    try:
        # THE FIX: Assign the result of the classmethod directly to gs
        gs = GameState.from_dict(request.game_state)
        moves = get_legal_moves(gs)
        return {"moves": moves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_game(request: AnalyzeRequest):
    try:
        gs = GameState()
        gs.set_starting_position()
        analysis = []
        
        # We need the greedy depth 3 engine for human best moves
        engine = engines.get(('greedy', 3))
        if not engine:
            engine = ChessEngine(mode='greedy', depth=3)
            engines[('greedy', 3)] = engine

        # 0th state (before any moves)
        import copy
        analysis.append({
            "move_index": 0,
            "move_played": None,
            "state": copy.deepcopy(gs.to_dict()),
            "eval_score": engine.evaluate(gs),
            "ideal_move": None,
            "ideal_state": None
        })

        for i, move_str in enumerate(request.move_history):
            # Parse the move_str e.g. "WP4_44" -> piece="WP4", target=[4, 4]
            # Some moves might be longer if the piece ID is longer, but usually format is {piece}_{col}{row}
            parts = move_str.split('_')
            if len(parts) != 2:
                continue
            piece = parts[0]
            target_str = parts[1]
            target = [int(target_str[0]), int(target_str[1])]
            
            # Check if this turn was the human's turn
            is_human_turn = (gs.turn == request.human_color)
            ideal_move = None
            ideal_state = None
            if is_human_turn:
                # Calculate what the greedy engine would do
                best_move = engine.get_best_move(gs)
                if best_move:
                    ideal_move = [best_move[0], list(best_move[1])]
                    # Generate the hypothetical board state
                    hypothetical_gs = apply_move(gs.copy(), best_move[0], best_move[1])
                    ideal_state = copy.deepcopy(hypothetical_gs.to_dict())

            # Apply the historical move
            gs = apply_move(gs, piece, target)
            
            # Evaluate new state
            eval_score = engine.evaluate(gs)
            
            analysis.append({
                "move_index": i + 1,
                "move_played": [piece, target],
                "state": copy.deepcopy(gs.to_dict()),
                "eval_score": eval_score,
                "ideal_move": ideal_move,
                "ideal_state": ideal_state
            })
            
        return {"analysis": analysis}
    except Exception as e:
        print("\n❌ PYTHON CRASH IN /analyze:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))