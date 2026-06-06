import ctypes
import os
import platform

# Change this at the top of the file
PIECE_TYPES = {'P': 1, 'N': 2, 'B': 3, 'R': 4, 'Q': 5, 'K': 6}
PIECE_VALUES = {'P': 1.0, 'N': 3.0, 'B': 3.0, 'R': 5.0, 'Q': 9.0, 'K': 1000.0}
cpp_engine = None

if 'game_recent_starts' not in globals():
    game_recent_starts = []
    game_past_boards = []

def load_cpp_engine():
    global cpp_engine
    if cpp_engine is not None:
        return
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # --- THE FIX: Detect OS and load the correct library ---
        if platform.system() == "Windows":
            lib_file = "greedy.dll"
        else:
            lib_file = "greedy.so"  # Linux shared object file
            
        lib_path = os.path.join(current_dir, lib_file)
        cpp_engine = ctypes.CDLL(lib_path)
        
    except Exception as e:
        print(f"DEBUG: Failed to load C++ Engine: {e}")

load_cpp_engine()

def get_cpp_greedy_move(gs, base_depth):
    global cpp_engine, game_recent_starts, game_past_boards
    
    if cpp_engine is None:
        return None 

    try:
        my_score = 0
        enemy_score = 0
        my_dict = gs.white if gs.turn == 'w' else gs.black
        enemy_dict = gs.black if gs.turn == 'w' else gs.white

        for piece in my_dict.keys(): my_score += PIECE_VALUES.get(piece[1], 1.0)
        for piece in enemy_dict.keys(): enemy_score += PIECE_VALUES.get(piece[1], 1.0)

        search_depth = base_depth
        advantage = my_score - enemy_score
        
        if advantage >= 7.0:
            print(f"🔥 COMMANDING POSITION (+{advantage}). Activating Killer Instinct (Depth {base_depth + 3})!")
            search_depth += 2 

        flat_board = [0] * 64
        
        for piece_id, pos in gs.white.items():
            val = PIECE_TYPES.get(piece_id[1], 0)
            idx = (8 - pos[1]) * 8 + (pos[0] - 1)
            flat_board[idx] = int(val)
            
        for piece_id, pos in gs.black.items():
            val = PIECE_TYPES.get(piece_id[1], 0) * -1
            idx = (8 - pos[1]) * 8 + (pos[0] - 1)
            flat_board[idx] = int(val)

        move_count = gs.fullmove_number if hasattr(gs, 'fullmove_number') else 1

        if move_count <= 1:
            game_recent_starts.clear()
            game_past_boards.clear()

        game_past_boards.extend(flat_board)

        if len(game_recent_starts) > 7:
            game_recent_starts.pop(0)

        num_past = len(game_past_boards) // 64
        num_recent = len(game_recent_starts)

        board_array = (ctypes.c_int * 64)(*flat_board)
        past_boards_array = (ctypes.c_int * len(game_past_boards))(*game_past_boards)
        recent_starts_array = (ctypes.c_int * num_recent)(*game_recent_starts)
        out_move = (ctypes.c_int * 2)()
        turn_int = 1 if gs.turn == 'w' else -1

        wk_moved = any(m.startswith('WK1_') for m in gs.move_history)
        wr1_moved = any(m.startswith('WR1_') for m in gs.move_history)
        wr2_moved = any(m.startswith('WR2_') for m in gs.move_history)
        bk_moved = any(m.startswith('BK1_') for m in gs.move_history)
        br1_moved = any(m.startswith('BR1_') for m in gs.move_history)
        br2_moved = any(m.startswith('BR2_') for m in gs.move_history)
        
        wr1_captured = 'WR1' not in gs.white
        wr2_captured = 'WR2' not in gs.white
        br1_captured = 'BR1' not in gs.black
        br2_captured = 'BR2' not in gs.black

        castling_rights = 0
        if not wk_moved:
            if not wr2_moved and not wr2_captured: castling_rights |= 1
            if not wr1_moved and not wr1_captured: castling_rights |= 2
        if not bk_moved:
            if not br2_moved and not br2_captured: castling_rights |= 4
            if not br1_moved and not br1_captured: castling_rights |= 8

        cpp_engine.get_best_move.argtypes = [
            ctypes.POINTER(ctypes.c_int), ctypes.c_int, ctypes.c_int, ctypes.c_int,
            ctypes.POINTER(ctypes.c_int), ctypes.c_int,
            ctypes.POINTER(ctypes.c_int), ctypes.c_int, ctypes.c_int,
            ctypes.POINTER(ctypes.c_int)
        ]

        cpp_engine.get_best_move(
            board_array, ctypes.c_int(search_depth), ctypes.c_int(move_count), ctypes.c_int(turn_int),
            recent_starts_array, ctypes.c_int(num_recent),
            past_boards_array, ctypes.c_int(num_past), ctypes.c_int(castling_rights),
            out_move
        )

        start_idx = out_move[0]
        target_idx = out_move[1]
        
        if start_idx == -1:
            return None

        game_recent_starts.append(start_idx)

        start_col = (start_idx % 8) + 1
        start_row = 8 - (start_idx // 8)
        target_col = (target_idx % 8) + 1
        target_row = 8 - (target_idx // 8)

        best_piece_id = None
        dict_to_search = gs.white if gs.turn == 'w' else gs.black
        for pid, pos in dict_to_search.items():
            if pos == [start_col, start_row]:
                best_piece_id = pid
                break

        if best_piece_id:
            return best_piece_id, [target_col, target_row]
        return None
        
    except Exception as e:
        print(f"\n❌ PYTHON BRIDGE CRASH: {e}\n")
        return None