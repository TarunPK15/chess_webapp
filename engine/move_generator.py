import copy
from .game_state import GameState

# --- HELPER FUNCTIONS ---

def get_piece_at(gs: GameState, col: int, row: int):
    """Returns the piece ID at a given square, or None."""
    target = [col, row]
    for piece, pos in gs.white.items():
        if pos == target: return piece
    for piece, pos in gs.black.items():
        if pos == target: return piece
    return None

def is_path_clear(gs: GameState, start: list, end: list) -> bool:
    """Checks if orthogonal/diagonal paths have blocking pieces."""
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    step_x = 1 if dx > 0 else (-1 if dx < 0 else 0)
    step_y = 1 if dy > 0 else (-1 if dy < 0 else 0)
    
    current_x, current_y = start[0] + step_x, start[1] + step_y
    while [current_x, current_y] != end:
        if get_piece_at(gs, current_x, current_y):
            return False
        current_x += step_x
        current_y += step_y
    return True

# --- PSEUDOLEGAL MOVE VALIDATORS ---

def is_valid_pawn(gs: GameState, piece: str, start: list, end: list) -> bool:
    color = piece[0]
    direction = 1 if color == 'W' else -1
    start_row = 2 if color == 'W' else 7
    target_piece = get_piece_at(gs, end[0], end[1])

    # Forward 1
    if end[0] == start[0] and end[1] == start[1] + direction:
        return target_piece is None

    # Forward 2
    if end[0] == start[0] and start[1] == start_row and end[1] == start[1] + (2 * direction):
        return target_piece is None and get_piece_at(gs, start[0], start[1] + direction) is None

    # Capture diagonal
    if abs(end[0] - start[0]) == 1 and end[1] == start[1] + direction:
        # Standard capture
        if target_piece and target_piece[0] != color:
            return True
        # En Passant
        if gs.en_passant_target == end:
            return True

    return False

def is_valid_knight(gs: GameState, piece: str, start: list, end: list) -> bool:
    target_piece = get_piece_at(gs, end[0], end[1])
    if target_piece and target_piece[0] == piece[0]: return False  # Cannot capture own piece
    
    dx, dy = abs(start[0] - end[0]), abs(start[1] - end[1])
    return (dx == 1 and dy == 2) or (dx == 2 and dy == 1)

def is_valid_bishop(gs: GameState, piece: str, start: list, end: list) -> bool:
    target_piece = get_piece_at(gs, end[0], end[1])
    if target_piece and target_piece[0] == piece[0]: return False
    
    if abs(start[0] - end[0]) != abs(start[1] - end[1]): return False
    return is_path_clear(gs, start, end)

def is_valid_rook(gs: GameState, piece: str, start: list, end: list) -> bool:
    target_piece = get_piece_at(gs, end[0], end[1])
    if target_piece and target_piece[0] == piece[0]: return False
    
    if start[0] != end[0] and start[1] != end[1]: return False
    return is_path_clear(gs, start, end)

def is_valid_queen(gs: GameState, piece: str, start: list, end: list) -> bool:
    return is_valid_bishop(gs, piece, start, end) or is_valid_rook(gs, piece, start, end)

def is_valid_king(gs: GameState, piece: str, start: list, end: list) -> bool:
    color = piece[0]
    target_piece = get_piece_at(gs, end[0], end[1])
    if target_piece and target_piece[0] == color: return False
    
    dx, dy = abs(start[0] - end[0]), abs(start[1] - end[1])
    
    # Standard 1-step move
    if dx <= 1 and dy <= 1:
        return True

    # Castling
    row = 1 if color == 'W' else 8
    if start == [5, row] and dy == 0 and dx == 2:
        # Queenside (O-O-O) -> x goes to 3
        if end[0] == 3:
            rook_pos = [1, row]
            return get_piece_at(gs, 1, row) and is_path_clear(gs, start, rook_pos)
        # Kingside (O-O) -> x goes to 7
        if end[0] == 7:
            rook_pos = [8, row]
            return get_piece_at(gs, 8, row) and is_path_clear(gs, start, rook_pos)
            
    return False

# --- STATE EXECUTION & LEGALITY CHECKING ---

def apply_move(gs: GameState, piece: str, target: list) -> GameState:
    """Returns a NEW GameState object with the move applied. Does NOT check legality."""
    new_gs = gs.copy()
    color = piece[0]
    start = gs.white[piece] if color == 'W' else gs.black[piece]
    is_capture = get_piece_at(gs, target[0], target[1]) is not None
    is_pawn_move = piece[1] == 'P'
    
    # Next En Passant Target calculation
    next_ep_target = None
    if is_pawn_move and abs(target[1] - start[1]) == 2:
        direction = 1 if color == 'W' else -1
        next_ep_target = [start[0], start[1] + direction]
    
    # Execute En Passant Capture
    if is_pawn_move and target == gs.en_passant_target:
        cap_row = target[1] - (1 if color == 'W' else -1)
        cap_piece = get_piece_at(gs, target[0], cap_row)
        if cap_piece:
            if color == 'W': del new_gs.black[cap_piece]
            else: del new_gs.white[cap_piece]
            is_capture = True

    # Handle standard capture
    if get_piece_at(gs, target[0], target[1]):
        cap_piece = get_piece_at(gs, target[0], target[1])
        if color == 'W' and cap_piece in new_gs.black: del new_gs.black[cap_piece]
        if color == 'B' and cap_piece in new_gs.white: del new_gs.white[cap_piece]

    # Handle Castling Rook Movement
    if piece[1] == 'K' and abs(target[0] - start[0]) == 2:
        row = 1 if color == 'W' else 8
        if target[0] == 7:  # Kingside
            rook_piece = get_piece_at(gs, 8, row)
            if color == 'W': new_gs.white[rook_piece] = [6, row]
            else: new_gs.black[rook_piece] = [6, row]
        elif target[0] == 3:  # Queenside
            rook_piece = get_piece_at(gs, 1, row)
            if color == 'W': new_gs.white[rook_piece] = [4, row]
            else: new_gs.black[rook_piece] = [4, row]

    # Move the piece
    if color == 'W': new_gs.white[piece] = target
    else: new_gs.black[piece] = target

    # Handle Pawn Promotion (Auto-Queen for now)
    if is_pawn_move and target[1] in (1, 8):
        new_piece_id = f"{color}Q99" # Temporary ID to avoid conflicts
        if color == 'W':
            del new_gs.white[piece]
            new_gs.white[new_piece_id] = target
        else:
            del new_gs.black[piece]
            new_gs.black[new_piece_id] = target

    # --- Finalize state metadata ---
    
    # Record the move string (e.g., "WP4_44") in the history array
    move_str = f"{piece}_{target[0]}{target[1]}"
    new_gs.move_history.append(move_str)
    
    new_gs.en_passant_target = next_ep_target
    
    # This single line handles 50-move rule, threefold repetition, and turn swapping!
    new_gs.update_turn_and_clocks(is_pawn_move, is_capture)
    
    return new_gs

def is_in_check(gs: GameState, color: str) -> bool:
    """Checks if the given color's king is currently under attack."""
    king_piece = 'WK1' if color == 'W' else 'BK1'
    king_pos = gs.white.get(king_piece) if color == 'W' else gs.black.get(king_piece)
    if not king_pos: return False  # Failsafe

    opp_dict = gs.black if color == 'W' else gs.white
    
    # Iterate all opponent pieces and see if any can legally move to the king's square
    for p_name, p_pos in opp_dict.items():
        if p_name[1] == 'P' and is_valid_pawn(gs, p_name, p_pos, king_pos): return True
        if p_name[1] == 'N' and is_valid_knight(gs, p_name, p_pos, king_pos): return True
        if p_name[1] == 'B' and is_valid_bishop(gs, p_name, p_pos, king_pos): return True
        if p_name[1] == 'R' and is_valid_rook(gs, p_name, p_pos, king_pos): return True
        if p_name[1] == 'Q' and is_valid_queen(gs, p_name, p_pos, king_pos): return True
        if p_name[1] == 'K' and is_valid_king(gs, p_name, p_pos, king_pos): return True
        
    return False

def get_legal_moves(gs: GameState) -> list:
    """Generates the 'MegaList' of all legal (piece, target) tuples."""
    legal_moves = []
    color = 'W' if gs.turn == 'w' else 'B'
    my_pieces = gs.white if color == 'W' else gs.black

    for piece, start in my_pieces.items():
        for col in range(1, 9):
            for row in range(1, 9):
                target = [col, row]
                if target == start: continue

                # 1. Check pseudolegality
                is_pseudo = False
                if piece[1] == 'P': is_pseudo = is_valid_pawn(gs, piece, start, target)
                elif piece[1] == 'N': is_pseudo = is_valid_knight(gs, piece, start, target)
                elif piece[1] == 'B': is_pseudo = is_valid_bishop(gs, piece, start, target)
                elif piece[1] == 'R': is_pseudo = is_valid_rook(gs, piece, start, target)
                elif piece[1] == 'Q': is_pseudo = is_valid_queen(gs, piece, start, target)
                elif piece[1] == 'K': is_pseudo = is_valid_king(gs, piece, start, target)

                # 2. If pseudolegal, apply move and verify king safety
                if is_pseudo:
                    future_gs = apply_move(gs, piece, target)
                    if not is_in_check(future_gs, color):
                        # 3. Prevent castling out of or through check
                        if piece[1] == 'K' and abs(target[0] - start[0]) == 2:
                            if is_in_check(gs, color): continue # Cannot castle out of check
                            pass_through_sq = [start[0] + (1 if target[0] == 7 else -1), start[1]]
                            test_gs = apply_move(gs, piece, pass_through_sq)
                            if is_in_check(test_gs, color): continue # Cannot castle through check
                            
                        legal_moves.append((piece, target))

    return legal_moves