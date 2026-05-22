import math
from .game_state import GameState
from .move_generator import get_legal_moves, apply_move, get_piece_at, is_in_check

PIECE_VALUES = {
    'P': 1.0,
    'N': 3.0,
    'B': 3.0,
    'R': 5.0,
    'Q': 9.0,
    'K': 1000.0  # King value must be massively high to prioritize checkmate
}

class ChessEngine:
    def __init__(self, mode='greedy', depth=3):
        self.mode = mode
        self.depth = depth
        self.nodes_evaluated = 0 

    def evaluate(self, gs: GameState) -> float:
        """
        Static evaluation of the board. 
        Positive score = White is winning. Negative score = Black is winning.
        This is the exact function the ML model will replace in Phase 2.
        """
        score = 0.0
        
        for piece, pos in gs.white.items():
            score += PIECE_VALUES[piece[1]]
            score += self._get_positional_bonus(piece, pos, 'w', gs.fullmove_number)
            
        for piece, pos in gs.black.items():
            score -= PIECE_VALUES[piece[1]]
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