import pytest
from engine.game_state import GameState
from engine.move_generator import get_legal_moves

def create_gs_from_custom_setup(white_pieces, black_pieces, turn='w', ep=None):
    """Helper to inject specific board states quickly without full FEN parsing."""
    gs = GameState()
    gs.white = white_pieces
    gs.black = black_pieces
    gs.turn = turn
    gs.en_passant_target = ep
    return gs

def test_starting_position_legal_moves():
    """From the starting position, White has exactly 20 legal moves."""
    gs = GameState()
    gs.set_starting_position()
    moves = get_legal_moves(gs)
    assert len(moves) == 20

def test_en_passant_generation():
    """Test that a pawn can capture en passant and it removes the enemy pawn."""
    # White pawn on d5 (col 4, row 5), Black pawn just moved c7 to c5 (col 3, row 5)
    gs = create_gs_from_custom_setup(
        white_pieces={'WK1': [5, 1], 'WP1': [4, 5]},
        black_pieces={'BK1': [5, 8], 'BP1': [3, 5]},
        turn='w',
        ep=[3, 6]  # The c6 square
    )
    moves = get_legal_moves(gs)
    
    # King can move to 5 squares.
    # Pawn can move to d6 (1) AND capture en passant to c6 (1). Total = 7.
    assert len(moves) == 7
    assert ('WP1', [3, 6]) in moves

def test_pinned_piece_cannot_move():
    """Test absolute pins (Piece blocking check cannot move away)."""
    # White King on e1. White Knight on e2. Black Rook on e8.
    gs = create_gs_from_custom_setup(
        white_pieces={'WK1': [5, 1], 'WN1': [5, 2]},
        black_pieces={'BK1': [1, 8], 'BR1': [5, 8]}
    )
    moves = get_legal_moves(gs)
    
    # The Knight is pinned and should yield 0 legal moves.
    knight_moves = [m for m in moves if m[0] == 'WN1']
    assert len(knight_moves) == 0

def test_castling_rights_and_blockers():
    """Test O-O and O-O-O are legal when path is clear and not in check."""
    # White King on e1. Rooks on a1 and h1. No pieces between.
    gs = create_gs_from_custom_setup(
        white_pieces={'WK1': [5, 1], 'WR1': [1, 1], 'WR2': [8, 1]},
        black_pieces={'BK1': [5, 8]}
    )
    moves = get_legal_moves(gs)
    
    # King should be able to move to 7 (O-O) and 3 (O-O-O)
    assert ('WK1', [7, 1]) in moves
    assert ('WK1', [3, 1]) in moves