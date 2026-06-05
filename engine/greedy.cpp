#include <iostream>
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cstdint>

using namespace std;

const int PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

struct Move {
    int start_idx;
    int target_idx;
    int piece_type;
    int captured_type;
};

const int EXACT = 0, ALPHA_FLAG = 1, BETA_FLAG = 2;
struct TTEntry {
    uint64_t key;
    int depth;
    int flag;
    float score;
    int best_move_start;
    int best_move_target;
};

const int TT_SIZE = 1048576; 
TTEntry TT[TT_SIZE];
uint64_t zobrist_table[64][12];
uint64_t zobrist_turn;
bool zobrist_initialized = false;

uint64_t random64() {
    uint64_t r1 = rand() & 0x7FFF;
    uint64_t r2 = rand() & 0x7FFF;
    uint64_t r3 = rand() & 0x7FFF;
    uint64_t r4 = rand() & 0x7FFF;
    return (r1 << 48) | (r2 << 32) | (r3 << 16) | r4;
}

void init_zobrist() {
    if (zobrist_initialized) return;
    for (int i = 0; i < 64; i++) for (int j = 0; j < 12; j++) zobrist_table[i][j] = random64();
    zobrist_turn = random64();
    for (int i = 0; i < TT_SIZE; i++) TT[i].key = 0;
    zobrist_initialized = true;
}

int get_piece_index(int piece) {
    int type = abs(piece);
    int offset = (piece > 0) ? 0 : 6;
    if (type >= PAWN && type <= KING) return offset + (type - 1);
    return 0;
}

uint64_t compute_initial_hash(int* board, int turn) {
    uint64_t h = 0;
    for (int i = 0; i < 64; i++) if (board[i] != 0) h ^= zobrist_table[i][get_piece_index(board[i])];
    if (turn == -1) h ^= zobrist_turn;
    return h;
}

uint64_t compute_board_hash(int* board) {
    uint64_t h = 0;
    for (int i = 0; i < 64; i++) if (board[i] != 0) h ^= zobrist_table[i][get_piece_index(board[i])];
    return h;
}

int generate_moves(int* board, int turn, Move* moves) {
    int count = 0;
    int knight_offsets[8] = {-17, -15, -10, -6, 6, 10, 15, 17};
    int king_offsets[8] = {-9, -8, -7, -1, 1, 7, 8, 9};

    for (int i = 0; i < 64; i++) {
        int piece = board[i];
        if (piece == 0) continue;
        bool is_white = piece > 0;
        if ((turn == 1 && !is_white) || (turn == -1 && is_white)) continue;
        
        int type = abs(piece);
        
        if (type == PAWN) {
            int dir = is_white ? -8 : 8;
            if (i + dir >= 0 && i + dir < 64 && board[i + dir] == 0)
                moves[count++] = {i, i + dir, type, 0};
            int caps[2] = {dir - 1, dir + 1};
            for (int c : caps) {
                int target = i + c;
                if (target >= 0 && target < 64 && abs((i%8) - (target%8)) <= 1 && board[target] * turn < 0)
                    moves[count++] = {i, target, type, abs(board[target])};
            }
        }
        else if (type == KNIGHT) {
            for (int off : knight_offsets) {
                int target = i + off;
                if (target >= 0 && target < 64 && abs((i%8) - (target%8)) <= 2 && board[target] * turn <= 0)
                    moves[count++] = {i, target, type, abs(board[target])};
            }
        }
        else if (type == BISHOP || type == ROOK || type == QUEEN) {
            int b_off[4] = {-9, -7, 7, 9};
            int r_off[4] = {-8, -1, 1, 8};
            if (type == BISHOP || type == QUEEN) {
                for (int off : b_off) {
                    int target = i + off;
                    while (target >= 0 && target < 64 && abs((target%8) - ((target-off)%8)) <= 1) {
                        if (board[target] * turn > 0) break; 
                        moves[count++] = {i, target, type, abs(board[target])};
                        if (board[target] * turn < 0) break; 
                        target += off;
                    }
                }
            }
            if (type == ROOK || type == QUEEN) {
                for (int off : r_off) {
                    int target = i + off;
                    while (target >= 0 && target < 64 && abs((target%8) - ((target-off)%8)) <= 1) {
                        if (board[target] * turn > 0) break; 
                        moves[count++] = {i, target, type, abs(board[target])};
                        if (board[target] * turn < 0) break; 
                        target += off;
                    }
                }
            }
        }
        else if (type == KING) {
            for (int off : king_offsets) {
                int target = i + off;
                if (target >= 0 && target < 64 && abs((i%8) - (target%8)) <= 1 && board[target] * turn <= 0)
                    moves[count++] = {i, target, type, abs(board[target])};
            }
        }
    }
    return count;
}

bool is_square_attacked(int* board, int square, int enemy_turn) {
    int knight_offsets[8] = {-17, -15, -10, -6, 6, 10, 15, 17};
    for (int off : knight_offsets) {
        int target = square + off;
        if (target >= 0 && target < 64 && abs((square%8) - (target%8)) <= 2)
            if (board[target] == KNIGHT * enemy_turn) return true;
    }
    int pawn_dir = (enemy_turn == 1) ? 8 : -8; 
    int pawn_caps[2] = {pawn_dir - 1, pawn_dir + 1};
    for (int c : pawn_caps) {
        int target = square + c;
        if (target >= 0 && target < 64 && abs((square%8) - (target%8)) <= 1)
            if (board[target] == PAWN * enemy_turn) return true;
    }
    int king_offsets[8] = {-9, -8, -7, -1, 1, 7, 8, 9};
    for (int off : king_offsets) {
        int target = square + off;
        if (target >= 0 && target < 64 && abs((square%8) - (target%8)) <= 1)
            if (board[target] == KING * enemy_turn) return true;
    }
    int bishop_offsets[4] = {-9, -7, 7, 9};
    for (int off : bishop_offsets) {
        int target = square + off;
        while (target >= 0 && target < 64 && abs((target%8) - ((target-off)%8)) <= 1) {
            int p = board[target];
            if (p != 0) {
                if (p == BISHOP * enemy_turn || p == QUEEN * enemy_turn) return true;
                break;
            }
            target += off;
        }
    }
    int rook_offsets[4] = {-8, -1, 1, 8};
    for (int off : rook_offsets) {
        int target = square + off;
        while (target >= 0 && target < 64 && abs((target%8) - ((target-off)%8)) <= 1) {
            int p = board[target];
            if (p != 0) {
                if (p == ROOK * enemy_turn || p == QUEEN * enemy_turn) return true;
                break;
            }
            target += off;
        }
    }
    return false;
}

float evaluate_board(int* board, int move_count) {
    float score = 0.0;
    int w_king_idx = -1, b_king_idx = -1;

    for (int i = 0; i < 64; i++) {
        int piece = board[i];
        if (piece == 0) continue;

        int type = abs(piece);
        int color = (piece > 0) ? 1 : -1;

        if (piece == KING) w_king_idx = i;
        if (piece == -KING) b_king_idx = i;

        float piece_score = (type == PAWN) ? 1.0 : (type == KNIGHT || type == BISHOP) ? 3.0 : (type == ROOK) ? 5.0 : (type == QUEEN) ? 9.0 : 1000.0;
        int row = i / 8; 
        int col = i % 8;
        int back_rank = (color == 1) ? 7 : 0;

        if (move_count < 15) {
            if (type == PAWN && (col == 3 || col == 4) && (row == 3 || row == 4)) piece_score += 0.1;
            if ((type == KNIGHT || type == BISHOP) && row != back_rank) piece_score += 0.09;
            if (type == KING) {
                if ((col == 2 || col == 6) && row == back_rank) piece_score += 0.5;
                else if (col == 4 && row == back_rank) piece_score -= 0.1;
            }
            if ((type == KING || type == ROOK) && row != back_rank) piece_score -= 0.01;
        }
        
        if (move_count > 35 && (type == PAWN || type == KING)) piece_score += 0.001; 
        score += (color == 1) ? piece_score : -piece_score;
    }

    float material_adv = score;
    if (material_adv > 5.0 && b_king_idx != -1 && w_king_idx != -1) {
        int bk_row = b_king_idx / 8, bk_col = b_king_idx % 8;
        int edge_dist = max(3 - bk_row, bk_row - 4) + max(3 - bk_col, bk_col - 4);
        score += edge_dist * 0.1; 
        
        int wk_row = w_king_idx / 8, wk_col = w_king_idx % 8;
        int king_dist = abs(wk_row - bk_row) + abs(wk_col - bk_col);
        score -= king_dist * 0.05; 
        score -= move_count * 0.001; 
    } 
    else if (material_adv < -5.0 && b_king_idx != -1 && w_king_idx != -1) {
        int wk_row = w_king_idx / 8, wk_col = w_king_idx % 8;
        int edge_dist = max(3 - wk_row, wk_row - 4) + max(3 - wk_col, wk_col - 4);
        score -= edge_dist * 0.1;
        
        int bk_row = b_king_idx / 8, bk_col = b_king_idx % 8;
        int king_dist = abs(wk_row - bk_row) + abs(wk_col - bk_col);
        score += king_dist * 0.05; 
        score += move_count * 0.001;
    }

    return score;
}

bool move_sorter(const Move& a, const Move& b) {
    int score_a = (a.captured_type * 10) - a.piece_type;
    int score_b = (b.captured_type * 10) - b.piece_type;
    return score_a > score_b;
}

float minimax(int* board, int depth, float alpha, float beta, int turn, int move_count, uint64_t hash, uint64_t* search_path, int ply, uint64_t* past_hashes, int num_past) {
    uint64_t b_hash = compute_board_hash(board);
    for(int i = 0; i < num_past; i++) {
        if(past_hashes[i] == b_hash) return 0.0;
    }
    for(int i = 0; i < ply; i++) {
        if(search_path[i] == b_hash) return 0.0;
    }
    search_path[ply] = b_hash;

    int tt_idx = hash % TT_SIZE;
    int tt_best_start = -1, tt_best_target = -1;

    if (TT[tt_idx].key == hash) {
        tt_best_start = TT[tt_idx].best_move_start;
        tt_best_target = TT[tt_idx].best_move_target;
        
        if (TT[tt_idx].depth >= depth) {
            if (TT[tt_idx].flag == EXACT) return TT[tt_idx].score;
            if (TT[tt_idx].flag == ALPHA_FLAG && TT[tt_idx].score <= alpha) return alpha;
            if (TT[tt_idx].flag == BETA_FLAG && TT[tt_idx].score >= beta) return beta;
        }
    }

    if (depth == 0) return evaluate_board(board, move_count);

    Move moves[256];
    int num_moves = generate_moves(board, turn, moves);
    
    if (num_moves == 0) {
        int king_idx = -1;
        for(int i=0; i<64; i++) if(board[i] == KING * turn) { king_idx = i; break; }
        if (king_idx != -1 && is_square_attacked(board, king_idx, -turn)) {
            return (turn == 1) ? -100000.0 + move_count : 100000.0 - move_count;
        }
        return 0.0; 
    }

    sort(moves, moves + num_moves, move_sorter); 

    if (tt_best_start != -1) {
        for (int i = 0; i < num_moves; i++) {
            if (moves[i].start_idx == tt_best_start && moves[i].target_idx == tt_best_target) {
                swap(moves[0], moves[i]);
                break;
            }
        }
    }

    float orig_alpha = alpha;
    float orig_beta = beta;
    Move current_best_move = moves[0]; 

    if (turn == 1) { 
        float max_eval = -999999.0;
        for (int i = 0; i < num_moves; i++) {
            int saved = board[moves[i].target_idx];
            int p_idx = get_piece_index(board[moves[i].start_idx]);
            
            uint64_t next_hash = hash;
            next_hash ^= zobrist_table[moves[i].start_idx][p_idx]; 
            if (saved != 0) next_hash ^= zobrist_table[moves[i].target_idx][get_piece_index(saved)]; 
            next_hash ^= zobrist_table[moves[i].target_idx][p_idx]; 
            next_hash ^= zobrist_turn; 
            
            board[moves[i].target_idx] = board[moves[i].start_idx];
            board[moves[i].start_idx] = 0;
            
            float eval = minimax(board, depth - 1, alpha, beta, -1, move_count + 1, next_hash, search_path, ply + 1, past_hashes, num_past);
            if (saved != 0) eval += 0.09;
            
            board[moves[i].start_idx] = board[moves[i].target_idx];
            board[moves[i].target_idx] = saved;
            
            if (eval > max_eval) {
                max_eval = eval;
                current_best_move = moves[i];
            }
            alpha = max(alpha, eval);
            if (beta <= alpha) break;
        }
        
        TT[tt_idx].key = hash;
        TT[tt_idx].depth = depth;
        TT[tt_idx].score = max_eval;
        TT[tt_idx].best_move_start = current_best_move.start_idx;
        TT[tt_idx].best_move_target = current_best_move.target_idx;
        if (max_eval <= orig_alpha) TT[tt_idx].flag = ALPHA_FLAG;
        else if (max_eval >= beta) TT[tt_idx].flag = BETA_FLAG;
        else TT[tt_idx].flag = EXACT;

        return max_eval;
    } else { 
        float min_eval = 999999.0;
        for (int i = 0; i < num_moves; i++) {
            int saved = board[moves[i].target_idx];
            int p_idx = get_piece_index(board[moves[i].start_idx]);
            
            uint64_t next_hash = hash;
            next_hash ^= zobrist_table[moves[i].start_idx][p_idx];
            if (saved != 0) next_hash ^= zobrist_table[moves[i].target_idx][get_piece_index(saved)];
            next_hash ^= zobrist_table[moves[i].target_idx][p_idx];
            next_hash ^= zobrist_turn;
            
            board[moves[i].target_idx] = board[moves[i].start_idx];
            board[moves[i].start_idx] = 0;
            
            float eval = minimax(board, depth - 1, alpha, beta, 1, move_count + 1, next_hash, search_path, ply + 1, past_hashes, num_past);
            if (saved != 0) eval -= 0.09; 
            
            board[moves[i].start_idx] = board[moves[i].target_idx];
            board[moves[i].target_idx] = saved;
            
            if (eval < min_eval) {
                min_eval = eval;
                current_best_move = moves[i];
            }
            beta = min(beta, eval);
            if (beta <= alpha) break;
        }

        TT[tt_idx].key = hash;
        TT[tt_idx].depth = depth;
        TT[tt_idx].score = min_eval;
        TT[tt_idx].best_move_start = current_best_move.start_idx;
        TT[tt_idx].best_move_target = current_best_move.target_idx;
        if (min_eval <= alpha) TT[tt_idx].flag = ALPHA_FLAG;
        else if (min_eval >= orig_beta) TT[tt_idx].flag = BETA_FLAG;
        else TT[tt_idx].flag = EXACT;

        return min_eval;
    }
}

extern "C" {
    __declspec(dllexport) void get_best_move(int* board, int target_depth, int move_count, int turn, int* recent_starts, int num_recent, int* past_boards, int num_past, int* out_move) {
        init_zobrist();
        uint64_t root_hash = compute_initial_hash(board, turn);

        uint64_t past_hashes[200];
        for (int i = 0; i < num_past; i++) {
            past_hashes[i] = compute_board_hash(&past_boards[i * 64]);
        }

        uint64_t search_path[100];
        search_path[0] = compute_board_hash(board);

        Move global_best_move = { -1, -1, 0, 0 };
        
        for (int d = 1; d <= target_depth; d++) {
            Move moves[256];
            int num_moves = generate_moves(board, turn, moves);
            sort(moves, moves + num_moves, move_sorter);

            int tt_idx = root_hash % TT_SIZE;
            if (TT[tt_idx].key == root_hash) {
                int tt_best_start = TT[tt_idx].best_move_start;
                int tt_best_target = TT[tt_idx].best_move_target;
                for (int i = 0; i < num_moves; i++) {
                    if (moves[i].start_idx == tt_best_start && moves[i].target_idx == tt_best_target) {
                        swap(moves[0], moves[i]);
                        break;
                    }
                }
            }

            float best_score = (turn == 1) ? -999999.0 : 999999.0;
            Move current_depth_best = moves[0]; 

            for (int i = 0; i < num_moves; i++) {
                int saved = board[moves[i].target_idx];
                int p_idx = get_piece_index(board[moves[i].start_idx]);
                
                uint64_t next_hash = root_hash;
                next_hash ^= zobrist_table[moves[i].start_idx][p_idx];
                if (saved != 0) next_hash ^= zobrist_table[moves[i].target_idx][get_piece_index(saved)];
                next_hash ^= zobrist_table[moves[i].target_idx][p_idx];
                next_hash ^= zobrist_turn;

                board[moves[i].target_idx] = board[moves[i].start_idx];
                board[moves[i].start_idx] = 0;
                
                float score = minimax(board, d - 1, -999999.0, 999999.0, -turn, move_count + 1, next_hash, search_path, 1, past_hashes, num_past);
                if (saved != 0) score += (turn == 1) ? 0.09 : -0.09;

                for (int j = 0; j < num_recent; j++) {
                    if (moves[i].start_idx == recent_starts[j]) {
                        float penalty = (num_recent - j) * 0.01;
                        score += (turn == 1) ? -penalty : penalty;
                    }
                }
                
                board[moves[i].start_idx] = board[moves[i].target_idx];
                board[moves[i].target_idx] = saved;
                
                if (turn == 1) {
                    if (score > best_score || (score == best_score && rand() % 2 == 0)) {
                        best_score = score;
                        current_depth_best = moves[i];
                    }
                } else {
                    if (score < best_score || (score == best_score && rand() % 2 == 0)) {
                        best_score = score;
                        current_depth_best = moves[i];
                    }
                }
            }
            if (current_depth_best.start_idx != -1) {
                global_best_move = current_depth_best;
            }
        }
        
        out_move[0] = global_best_move.start_idx;
        out_move[1] = global_best_move.target_idx;
    }
}