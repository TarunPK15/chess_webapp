import sys
import os
import requests
import time
import random

# Import your own engine to manage the board state locally during the test
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from engine.game_state import GameState
from engine.move_generator import apply_move, get_legal_moves

BASE_URL = "http://localhost:5000/api"

def register_and_login(username, password="Password123!"):
    """Registers a fresh test user and returns their JWT token."""
    print(f"👤 Registering {username}...")
    res = requests.post(f"{BASE_URL}/auth/register", json={"username": username, "password": password})
    if res.status_code == 400: # User already exists, just login
        res = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    
    token = res.json().get('token')
    return token, res.json().get('user').get('userId')

def make_move(game_id, token, gs, piece, target, is_pvp=False):
    """Fires a move to the backend and updates the local GameState."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "game_state": gs.to_dict(),
        "piece": piece,
        "target": target
    }
    
    res = requests.post(f"{BASE_URL}/games/{game_id}/move", json=payload, headers=headers)
    data = res.json()
    
    if res.status_code != 200:
        print(f"   ❌ Move Failed: {data}")
        return gs, None
    
    # --- THE CRITICAL FIX: Assigning the state back to `gs` ---
    if is_pvp:
        gs = apply_move(gs, piece, target)
    else:
        ai_res = data.get('ai_response', {})
        if 'updated_state' in ai_res:
            gs = GameState.from_dict(ai_res['updated_state']) # Assigned!
            if ai_res.get('piece'):
                print(f"   🤖 Bot replies: {ai_res['piece']} to {ai_res['target']}")
                
    return gs, data.get('game_status')

def test_pvp_scholars_mate():
    print("\n⚔️ --- STARTING PVP TEST (Scholar's Mate) ---")
    token_w, _ = register_and_login("Test_PvP_White")
    token_b, _ = register_and_login("Test_PvP_Black")
    
    print("📩 Sending Challenge...")
    res = requests.post(f"{BASE_URL}/challenges", json={"receiver_username": "Test_PvP_Black", "sender_color": "w"}, headers={"Authorization": f"Bearer {token_w}"})
    challenge_id = res.json()['_id']
    
    print("🤝 Accepting Challenge...")
    res = requests.post(f"{BASE_URL}/challenges/{challenge_id}/accept", headers={"Authorization": f"Bearer {token_b}"})
    game_id = res.json()['game_id']
    print(f"🎮 PvP Game Created! ID: {game_id}")
    
    gs = GameState()
    gs.set_starting_position()
    
    # Hardcoded Scholar's Mate sequence
    moves = [
        (token_w, "WP5", [5, 4]), # e4
        (token_b, "BP5", [5, 5]), # e5
        (token_w, "WB2", [3, 4]), # Bc4
        (token_b, "BN1", [3, 6]), # Nc6
        (token_w, "WQ1", [8, 5]), # Qh5
        (token_b, "BN2", [6, 6]), # Nf6
        (token_w, "WQ1", [6, 7])  # Qxf7#
    ]
    
    for token, piece, target in moves:
        print(f"   Move: {piece} to {target}")
        gs, status = make_move(game_id, token, gs, piece, target, is_pvp=True)
    
    print("✅ PvP Move sequence completed successfully.")

def test_pve_random_loss_white():
    """Test 2: Human plays White vs Greedy Depth 3. Human plays randomly until mated."""
    print("\n🤖 --- STARTING BOT TEST (Human=White vs Greedy Depth 3) ---")
    token, _ = register_and_login("Test_Blunder_White")
    
    res = requests.post(f"{BASE_URL}/games", json={"player_color": "w", "engine_mode": "greedy", "engine_depth": 4}, headers={"Authorization": f"Bearer {token}"})
    game_id = res.json()['game_id']
    print(f"🎮 Game Created! ID: {game_id}")
    
    gs = GameState()
    gs.set_starting_position()
    
    status = "abandoned"
    move_count = 0
    print("   Playing random chaotic moves to intentionally blunder...")
    
    while status == "abandoned" and move_count < 100:
        legal_moves = get_legal_moves(gs)
        my_moves = [m for m in legal_moves if m[0].startswith('W')]
        if not my_moves: break
        
        move = random.choice(my_moves)
        gs, status = make_move(game_id, token, gs, move[0], list(move[1]), is_pvp=False)
        move_count += 1
        
    print(f"✅ Game Over! Database Status: {status} (Completed in {move_count} moves).")

def test_pve_random_loss_black():
    """Test 3: Human plays Black vs Greedy Depth 2. White (Bot) must move first."""
    print("\n🤖 --- STARTING BOT TEST (Human=Black vs Greedy Depth 2) ---")
    token, _ = register_and_login("Test_Blunder_Black")
    
    res = requests.post(f"{BASE_URL}/games", json={"player_color": "b", "engine_mode": "greedy", "engine_depth": 4}, headers={"Authorization": f"Bearer {token}"})
    game_id = res.json()['game_id']
    print(f"🎮 Game Created! ID: {game_id}")
    
    gs = GameState()
    gs.set_starting_position()
    
    # 1. Force the Engine to make the very first move using our special route
    print("   🤖 Triggering Engine's first move (White)...")
    res = requests.post(f"{BASE_URL}/games/{game_id}/engine-move-only", json={"game_state": gs.to_dict()}, headers={"Authorization": f"Bearer {token}"})
    data = res.json()
    ai_res = data.get('ai_response', {})
    
    if 'updated_state' in ai_res:
        gs = GameState.from_dict(ai_res['updated_state'])
        print(f"   🤖 Bot opens with: {ai_res['piece']} to {ai_res['target']}")
    status = data.get('game_status', 'abandoned')
    
    # 2. Loop until human is defeated
    move_count = 0
    print("   Playing random chaotic moves to intentionally blunder...")
    
    while status == "abandoned" and move_count < 100:
        legal_moves = get_legal_moves(gs)
        my_moves = [m for m in legal_moves if m[0].startswith('B')]
        if not my_moves: break
        
        move = random.choice(my_moves)
        gs, status = make_move(game_id, token, gs, move[0], list(move[1]), is_pvp=False)
        move_count += 1
        
    print(f"✅ Game Over! Database Status: {status} (Completed in {move_count} moves).")

def check_leaderboard():
    print("\n🏆 --- FETCHING LEADERBOARD ---")
    res = requests.get(f"{BASE_URL}/leaderboard")
    board = res.json()
    
    print(f"{'Rank':<5} | {'Username':<18} | {'Win %':<6} | {'Games':<5}")
    print("-" * 45)
    for i, user in enumerate(board[:5]):
        print(f"{i+1:<5} | {user['username']:<18} | {user['win_rate']:<6.1f} | {user['games_played']:<5}")

if __name__ == "__main__":
    test_pvp_scholars_mate()
    time.sleep(1) 
    
    test_pve_random_loss_white()
    time.sleep(1)
    
    test_pve_random_loss_black()
    time.sleep(1)
    
    check_leaderboard()
    print("\n🚀 ALL ENDPOINT TESTS COMPLETE!")