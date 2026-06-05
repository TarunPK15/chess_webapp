import math
import numpy as np
from .game_state import GameState
from .move_generator import get_legal_moves, apply_move, get_piece_at, is_in_check
from .cpp_bridge import get_cpp_greedy_move
from ml.evaluator import MLEvaluator

PIECE_VALUES = {
    'P': 1.0,
    'N': 3.0,
    'B': 3.0,
    'R': 5.0,
    'Q': 9.0,
    'K': 1000.0  
}

class ChessEngine:
    def __init__(self, mode='greedy', depth=3):
        self.mode = mode
        self.depth = depth
        self.nodes_evaluated = 0 
        self.eval_cache = {}  # Added memory cache to speed up ML inference
        
        if self.mode == 'ml':
            print(f"Initializing ML Engine (Depth {self.depth})...")
            # Point to the ONNX file we generated in Step 6
            self.ml_evaluator = MLEvaluator("ml/evaluator.onnx")

        elif self.mode == 'ml2':
            print(f"Initializing ML Engine (Depth {self.depth})...")
            # Point to the ONNX file we generated in Step 6
            self.ml_evaluator = MLEvaluator("ml/evaluator_cp.onnx")

        elif self.mode == 'ml3':
            print(f"Initializing ML Engine (Depth {self.depth})...")
            # Point to Goliath!
            self.ml_evaluator = MLEvaluator("ml/evaluator_kaggle.onnx")

    def _extract_features(self, gs: GameState) -> np.ndarray:
        """Converts GameState dicts to the 768-element AlphaZero array."""
        features = np.zeros(768, dtype=np.float32)
        piece_map = {'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5}
        
        # Parse White Pieces (Planes 0 to 5)
        for piece_id, pos in gs.white.items():
            p_type = piece_id[1]
            if p_type in piece_map:
                plane = piece_map[p_type]
                sq = (pos[1] - 1) * 8 + (pos[0] - 1)
                features[plane * 64 + sq] = 1.0
                
        # Parse Black Pieces (Planes 6 to 11)
        for piece_id, pos in gs.black.items():
            p_type = piece_id[1]
            if p_type in piece_map:
                plane = 6 + piece_map[p_type]
                sq = (pos[1] - 1) * 8 + (pos[0] - 1)
                features[plane * 64 + sq] = 1.0
                
        return features

    def evaluate(self, gs: GameState) -> float:
        """Routes the evaluation based on the engine mode."""
        if gs.result == "1/2-1/2":
            return 0.0  # A draw is worth exactly 0 advantage. The engine will avoid this if it's winning!
        
        if gs.result == "1-0":
            return 9999.0  # White wins (Adjust polarity based on how your minimax evaluates perspective)
            
        if gs.result == "0-1":
            return -9999.0 # Black wins
            
        # Create a unique string for this exact board position
        board_hash = gs._get_position_signature()
        
        # ML Evaluation Branch
        if self.mode.startswith('ml'):
            # If we've calculated this board before, return the saved score instantly
            if board_hash in self.eval_cache:
                return self.eval_cache[board_hash]
                
            features = self._extract_features(gs)
            ml_score = self.ml_evaluator.score(features)
            
            if self.mode == 'ml':
                # Convert 0.0-1.0 probability to -10.0 to +10.0 Minimax scale
                final_score = (ml_score - 0.5) * 20.0
            else: # ml2 or ml3
                # Convert Tanh (-1.0 to 1.0) directly to Minimax pawn advantage (-15.0 to +15.0)
                final_score = ml_score * 15.0
                
            # Save the result to cache before returning
            self.eval_cache[board_hash] = final_score
            return final_score
            
        # Greedy Evaluation Branch
        score = 0.0
        for piece, pos in gs.white.items():
            # Use .get() with a default of 1.0 just in case a piece ID is misread
            score += PIECE_VALUES.get(piece[1], 1.0)
            score += self._get_positional_bonus(piece, pos, 'w', gs.fullmove_number)
            
        for piece, pos in gs.black.items():
            score -= PIECE_VALUES.get(piece[1], 1.0)
            score -= self._get_positional_bonus(piece, pos, 'b', gs.fullmove_number)
            
        return score

    def _get_positional_bonus(self, piece: str, pos: list, color: str, move_number: int) -> float:
        bonus = 0.0
        p_type = piece[1]
        col, row = pos[0], pos[1]
        
        if move_number < 15:
            if p_type == 'P' and col in (4, 5) and row in (4, 5):
                bonus += 0.1
            if p_type in ('N', 'B'):
                back_rank = 1 if color == 'w' else 8
                if row != back_rank:
                    bonus += 0.09
            if p_type == 'K':
                back_rank = 1 if color == 'w' else 8
                if col in (3, 7) and row == back_rank:
                    bonus += 0.5
                elif col == 5 and row == back_rank:
                    bonus -= 0.1
        return bonus

    def order_moves(self, gs: GameState, moves: list) -> list:
        def move_score(move):
            piece, target = move
            target_piece = get_piece_at(gs, target[0], target[1])
            if target_piece:
                return PIECE_VALUES[target_piece[1]] - (PIECE_VALUES[piece[1]] * 0.1)
            return 0.0
        return sorted(moves, key=move_score, reverse=True)

    def get_best_move(self, gs: GameState) -> tuple:
        self.nodes_evaluated = 0
        best_move = None
        
        # --- 1. Prevent infinite loops ---
        current_hash = gs._get_position_signature()
        if gs.position_counts.get(current_hash, 0) >= 3 or gs.halfmove_clock >= 100:
            return None # Force draw recognition

        # --- 2. C++ Greedy Bridge ---
        if self.mode == 'greedy':
            # We pass depth here so the C++ engine knows how deep to calculate
            return get_cpp_greedy_move(gs, self.depth)
            
        # --- 3. Python Minimax (For ML Engines) ---
        if gs.turn == 'w':
            max_eval = -math.inf
            alpha = -math.inf
            beta = math.inf
            
            moves = self.order_moves(gs, get_legal_moves(gs))
            
            for move in moves:
                next_gs = apply_move(gs, move[0], move[1])
                eval = self.minimax(next_gs, self.depth - 1, alpha, beta, False)
                if eval > max_eval:
                    max_eval = eval
                    best_move = move
                alpha = max(alpha, eval)
        else:
            min_eval = math.inf
            alpha = -math.inf
            beta = math.inf
            
            moves = self.order_moves(gs, get_legal_moves(gs))
            
            for move in moves:
                next_gs = apply_move(gs, move[0], move[1])
                eval = self.minimax(next_gs, self.depth - 1, alpha, beta, True)
                if eval < min_eval:
                    min_eval = eval
                    best_move = move
                beta = min(beta, eval)
                
        return best_move

    def minimax(self, gs: GameState, depth: int, alpha: float, beta: float, maximizing_player: bool) -> float:
        self.nodes_evaluated += 1
        
        legal_moves = get_legal_moves(gs)
        
        if len(legal_moves) == 0:
            color_to_move = 'W' if gs.turn == 'w' else 'B'
            if is_in_check(gs, color_to_move):
                return -9999.0 if maximizing_player else 9999.0
            return 0.0
            
        if depth == 0:
            return self.evaluate(gs)
            
        legal_moves = self.order_moves(gs, legal_moves)

        if maximizing_player:
            max_eval = -math.inf
            for move in legal_moves:
                next_gs = apply_move(gs, move[0], move[1])
                eval = self.minimax(next_gs, depth - 1, alpha, beta, False)
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            return max_eval
            
        else:
            min_eval = math.inf
            for move in legal_moves:
                next_gs = apply_move(gs, move[0], move[1])
                eval = self.minimax(next_gs, depth - 1, alpha, beta, True)
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            return min_eval