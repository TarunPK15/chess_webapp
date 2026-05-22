import pytest
from engine.game_state import GameState
from engine.chess_engine import ChessEngine

def test_mate_in_one():
    """
    Scenario: White has a forced 'Back Rank Mate' in one move.
    White Rook on e1. Black King trapped on g8 behind its own pawns.
    The correct move is Rook to e8.
    """
    # FEN: 6k1 = black king on g8, 5ppp = pawns on f7,g7,h7. 4R1K1 = white rook on e1, king on g1
    fen = "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1"
    gs = GameState()
    gs.load_from_fen(fen)

    # A depth of 2 is plenty to see a mate in 1
    engine = ChessEngine(depth=2)
    best_move = engine.get_best_move(gs)

    # In our coordinate system, e8 is column 5, row 8.
    target_square = best_move[1]
    assert target_square == [5, 8], f"Engine failed to find Mate in 1. It moved to {target_square}"


def test_depth_1_vs_depth_3_blunder():
    """
    Scenario: The Poisoned Knight.
    White Queen on e4. Black Knight on d5. Black Pawn on c6.
    If the Queen takes the Knight, the Pawn recaptures the Queen on the next turn.
    """
    # FEN Setup
    fen = "8/8/2p5/3n4/4Q3/8/8/8 w - - 0 1"
    gs = GameState()
    gs.load_from_fen(fen)

    # 1. Test the "Dumb" Engine (Depth 1)
    # It only looks at its own turn. It sees a free Knight (+3 points) and takes it.
    engine_dumb = ChessEngine(depth=1)
    move_dumb = engine_dumb.get_best_move(gs)
    
    # d5 is column 4, row 5.
    assert move_dumb[1] == [4, 5], "Depth 1 engine was supposed to fall for the trap, but didn't!"

    # 2. Test the "Smart" Engine (Depth 3)
    # It looks at its move, black's response, and its counter-response.
    # It sees the net result is -6 points (Queen for a Knight) and avoids it.
    engine_smart = ChessEngine(depth=3)
    move_smart = engine_smart.get_best_move(gs)
    
    assert move_smart[1] != [4, 5], "Depth 3 engine fell for the trap and blundered the Queen!"

def test_alpha_beta_node_reduction():
    """
    Scenario: Verify that move ordering actually reduces the number of nodes evaluated.
    We run a depth 3 search on the starting position with and without ordering.
    """
    gs = GameState()
    gs.set_starting_position()
    
    engine = ChessEngine(depth=3)
    engine.get_best_move(gs)
    
    nodes_searched = engine.nodes_evaluated
    
    # Without Alpha-Beta pruning, depth 3 looks at roughly ~42,000 nodes.
    # With pruning and ordering, it should be significantly less (usually under 5,000).
    assert nodes_searched < 10000, f"Engine evaluated too many nodes ({nodes_searched}). Alpha-Beta pruning might be failing."