import copy
import json

FEN_MAP = {
    'WP': 'P', 'WR': 'R', 'WN': 'N', 'WB': 'B', 'WQ': 'Q', 'WK': 'K',
    'BP': 'p', 'BR': 'r', 'BN': 'n', 'BB': 'b', 'BQ': 'q', 'BK': 'k'
}

class GameState:
    def __init__(self):
        # 1. Core Board Representation
        self.white = {}
        self.black = {}
        
        # 2. Turn & History State
        self.turn = 'w'
        self.move_history = []
        
        # 3. Draw by 50-Move Rule
        self.halfmove_clock = 0 
        self.fullmove_number = 1
        
        # 4. Draw by Threefold Repetition
        # Maps a position "signature" to the number of times it has occurred
        self.position_counts = {}
        
        # 5. En Passant Tracker
        self.en_passant_target = None  # Format: [col, row] of the capture square
        
        # 6. Player Actions & Game Result
        self.result = "*"  # "*" = ongoing, "1-0" = white wins, "0-1" = black wins, "1/2-1/2" = draw
        self.draw_offer = None  # 'w' if white offered, 'b' if black offered, None otherwise
        
        # 7. Piece Movement Trackers (Preserved for Castling)
        self.countrook = 0
        self.countking = 0
        self.Hcountrook = 0
        self.Hcountking = 0

    def copy(self):
        """Returns a deep copy for the engine to 'think' ahead without mutating the real game."""
        new_state = GameState()
        new_state.white = copy.deepcopy(self.white)
        new_state.black = copy.deepcopy(self.black)
        new_state.turn = self.turn
        new_state.move_history = list(self.move_history)
        new_state.halfmove_clock = self.halfmove_clock
        new_state.fullmove_number = self.fullmove_number
        new_state.position_counts = copy.deepcopy(self.position_counts)
        new_state.en_passant_target = list(self.en_passant_target) if self.en_passant_target else None
        new_state.result = self.result
        new_state.draw_offer = self.draw_offer
        new_state.countrook = self.countrook
        new_state.countking = self.countking
        new_state.Hcountrook = self.Hcountrook
        new_state.Hcountking = self.Hcountking
        return new_state

    def to_dict(self):
        """Serializes the board for the Node.js API."""
        return {
            "white": self.white,
            "black": self.black,
            "turn": self.turn,
            "move_history": self.move_history,
            "halfmove_clock": self.halfmove_clock,
            "fullmove_number": self.fullmove_number,
            "position_counts": self.position_counts,
            "en_passant_target": self.en_passant_target,
            "result": self.result,
            "draw_offer": self.draw_offer
        }

    @classmethod
    def from_dict(cls, data):
        """Reconstructs the GameState from JSON."""
        gs = cls()
        gs.white = data.get("white", {})
        gs.black = data.get("black", {})
        gs.turn = data.get("turn", 'w')
        gs.move_history = data.get("move_history", [])
        gs.halfmove_clock = data.get("halfmove_clock", 0)
        gs.fullmove_number = data.get("fullmove_number", 1)
        gs.position_counts = data.get("position_counts", {})
        gs.en_passant_target = data.get("en_passant_target", None)
        gs.result = data.get("result", "*")
        gs.draw_offer = data.get("draw_offer", None)
        return gs

    # --- NEW RULE ENFORCEMENT LOGIC ---

    def update_turn_and_clocks(self, is_pawn_move: bool, is_capture: bool):
        """Called by apply_move() in Step 3 after a piece is moved."""
        # 1. Handle the 50-move rule reset
        if is_pawn_move or is_capture:
            self.halfmove_clock = 0
            # If a pawn moves or piece is captured, threefold repetition is impossible to reach again
            self.position_counts.clear() 
        else:
            self.halfmove_clock += 1

        # 2. Advance the turn and fullmove clock
        if self.turn == 'b':
            self.fullmove_number += 1
            self.turn = 'w'
        else:
            self.turn = 'b'

        # 3. Record the new position for threefold repetition
        sig = self._get_position_signature()
        self.position_counts[sig] = self.position_counts.get(sig, 0) + 1

        # 4. Auto-claim draws if mandatory
        self.check_auto_draws()

    def check_auto_draws(self):
        """Checks if the game has forced a draw state."""
        if self.halfmove_clock >= 100:  # 100 half-moves = 50 full moves per side
            self.result = "1/2-1/2"
            
        sig = self._get_position_signature()
        if self.position_counts.get(sig, 0) >= 3:
            self.result = "1/2-1/2"

    def player_forfeits(self, color: str):
        """Ends the game immediately."""
        if self.result == "*":
            self.result = "0-1" if color == 'w' else "1-0"

    def handle_draw_offer(self, action: str, color: str):
        """Handles proposing, accepting, or rejecting a draw."""
        if self.result != "*":
            return # Game already over

        if action == "offer":
            self.draw_offer = color
        elif action == "accept" and self.draw_offer and self.draw_offer != color:
            self.result = "1/2-1/2"
            self.draw_offer = None
        elif action == "reject":
            self.draw_offer = None

    # --- UTILITIES ---

    def _get_position_signature(self):
        """Returns a string representing the board state ignoring move counters.
        Used strictly for calculating Threefold Repetition."""
        # Note: True standard FEN requires castling rights tracking. 
        # We will extract just the board state and the current turn.
        fen_parts = self.to_fen().split(" ")
        return f"{fen_parts[0]} {fen_parts[1]} {fen_parts[3]}" # Board, Turn, En Passant

    def set_starting_position(self):
        self.white = {
            'WP1': [1, 2], 'WP2': [2, 2], 'WP3': [3, 2], 'WP4': [4, 2],
            'WP5': [5, 2], 'WP6': [6, 2], 'WP7': [7, 2], 'WP8': [8, 2],
            'WR1': [1, 1], 'WN1': [2, 1], 'WB1': [3, 1], 'WQ1': [4, 1],
            'WK1': [5, 1], 'WB2': [6, 1], 'WN2': [7, 1], 'WR2': [8, 1]
        }
        self.black = {
            'BP1': [1, 7], 'BP2': [2, 7], 'BP3': [3, 7], 'BP4': [4, 7],
            'BP5': [5, 7], 'BP6': [6, 7], 'BP7': [7, 7], 'BP8': [8, 7],
            'BR1': [1, 8], 'BN1': [2, 8], 'BB1': [3, 8], 'BQ1': [4, 8],
            'BK1': [5, 8], 'BB2': [6, 8], 'BN2': [7, 8], 'BR2': [8, 8]
        }

    def to_fen(self):
        grid = [['' for _ in range(8)] for _ in range(8)]
        for piece_name, pos in self.white.items():
            grid[8 - pos[1]][pos[0] - 1] = FEN_MAP[piece_name[:2]]
        for piece_name, pos in self.black.items():
            grid[8 - pos[1]][pos[0] - 1] = FEN_MAP[piece_name[:2]]

        fen_rows = []
        for row in grid:
            empty_count = 0
            fen_row = ""
            for square in row:
                if square == '':
                    empty_count += 1
                else:
                    if empty_count > 0:
                        fen_row += str(empty_count)
                        empty_count = 0
                    fen_row += square
            if empty_count > 0:
                fen_row += str(empty_count)
            fen_rows.append(fen_row)
            
        board_fen = "/".join(fen_rows)
        
        # En Passant logic formatting for FEN
        ep_str = "-"
        if self.en_passant_target:
            files = "abcdefgh"
            col, row = self.en_passant_target
            ep_str = f"{files[col-1]}{row}"

        # TODO: Add accurate castling rights string "-"
        fen = f"{board_fen} {self.turn} - {ep_str} {self.halfmove_clock} {self.fullmove_number}"
        return fen
    
    def load_from_fen(self, fen: str):
        """
        Translates a standard FEN string into the engine's internal dictionary format.
        Dynamically generates unique piece IDs (e.g., 'WP1', 'BK1') as it parses.
        """
        parts = fen.split(" ")
        if len(parts) < 6:
            raise ValueError(f"Invalid FEN string: {fen}")

        board_part, turn_part, castling_part, ep_part, halfmove_part, fullmove_part = parts[:6]

        # 1. Reset board state
        self.white = {}
        self.black = {}
        
        # Track counts of piece types to generate unique IDs (WP1, WP2, WQ1, etc.)
        piece_counts = {
            'WP': 0, 'WR': 0, 'WN': 0, 'WB': 0, 'WQ': 0, 'WK': 0,
            'BP': 0, 'BR': 0, 'BN': 0, 'BB': 0, 'BQ': 0, 'BK': 0
        }

        # 2. Parse Piece Placement
        rows = board_part.split("/")
        for r_idx, row_str in enumerate(rows):
            # FEN starts at rank 8 and goes down to rank 1
            rank = 8 - r_idx 
            col = 1
            
            for char in row_str:
                if char.isdigit():
                    # Empty squares (e.g., '3' means 3 empty squares)
                    col += int(char)
                else:
                    # Piece square
                    is_white = char.isupper()
                    piece_type = char.upper()  # 'P', 'R', 'N', etc.
                    
                    color_prefix = 'W' if is_white else 'B'
                    base_name = color_prefix + piece_type
                    
                    # Increment counter for this piece type to create a unique ID
                    piece_counts[base_name] += 1
                    piece_id = f"{base_name}{piece_counts[base_name]}"
                    
                    # Assign to the correct dictionary
                    if is_white:
                        self.white[piece_id] = [col, rank]
                    else:
                        self.black[piece_id] = [col, rank]
                        
                    col += 1

        # 3. Parse Turn
        self.turn = 'w' if turn_part == 'w' else 'b'

        # 4. Parse En Passant Target
        if ep_part == '-':
            self.en_passant_target = None
        else:
            files = "abcdefgh"
            ep_col = files.index(ep_part[0]) + 1
            ep_row = int(ep_part[1])
            self.en_passant_target = [ep_col, ep_row]

        # 5. Parse Clocks
        self.halfmove_clock = int(halfmove_part)
        self.fullmove_number = int(fullmove_part)
        
        # Reset the threefold repetition tracker since we are jumping to a new state
        self.position_counts.clear()
        sig = self._get_position_signature()
        self.position_counts[sig] = 1

        # Note: 'castling_part' (e.g., KQkq) is skipped here because your engine currently
        # relies on king/rook move trackers rather than explicit FEN castling rights.
        # This is perfectly fine for ML training on position evaluations.