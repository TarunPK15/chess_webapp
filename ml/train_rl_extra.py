import torch
import torch.nn as nn
import torch.optim as optim
import chess
import random
import numpy as np
from collections import deque

# 1. Bring in your existing model architecture and preprocessing
class ChessEvaluator(nn.Module):
    def __init__(self):
        super(ChessEvaluator, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(768, 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 1), nn.Tanh()
        )
    def forward(self, x):
        return self.network(x)

def extract_features(board):
    features = np.zeros(768, dtype=np.float32)
    piece_map = {chess.PAWN: 0, chess.KNIGHT: 1, chess.BISHOP: 2, chess.ROOK: 3, chess.QUEEN: 4, chess.KING: 5}
    for color_idx, color in enumerate([chess.WHITE, chess.BLACK]):
        for piece_type in piece_map:
            for square in board.pieces(piece_type, color):
                plane = (color_idx * 6) + piece_map[piece_type]
                features[plane * 64 + square] = 1.0
    return features

# 2. Setup the RL Environment
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = ChessEvaluator().to(device)

# LOAD YOUR PRE-TRAINED KAGGLE KNOWLEDGE
model.load_state_dict(torch.load("goliath_base.pth"))

# Use a smaller learning rate for fine-tuning so we don't destroy existing knowledge
optimizer = optim.Adam(model.parameters(), lr=0.0001)
criterion = nn.MSELoss()

# The Experience Replay Buffer (Stores the last 10,000 moves)
memory = deque(maxlen=10000)

GAMES_TO_PLAY = 1000
DISCOUNT_FACTOR = 0.95 # How much we care about future rewards
EPSILON = 0.1 # 10% of the time, make a random move to explore new strategies

for game in range(GAMES_TO_PLAY):
    board = chess.Board()
    game_history = []
    
    # --- PLAY ONE GAME ---
    while not board.is_game_over():
        legal_moves = list(board.legal_moves)
        
        # ACTOR: RL MODEL (White)
        if board.turn == chess.WHITE:
            # Epsilon-Greedy: Sometimes play a random move to learn new things
            if random.random() < EPSILON:
                best_move = random.choice(legal_moves)
            else:
                # Ask the neural network to evaluate all possible next states
                best_move = None
                best_score = -float('inf')
                
                with torch.no_grad():
                    for move in legal_moves:
                        board.push(move)
                        features = torch.tensor(extract_features(board)).unsqueeze(0).to(device)
                        score = model(features).item()
                        board.pop()
                        
                        if score > best_score:
                            best_score = score
                            best_move = move
            
            # Save the state BEFORE making the move
            state_features = extract_features(board)
            board.push(best_move)
            game_history.append(state_features)
            
        # OPPONENT: GREEDY ENGINE (Black)
        else:
            # (Replace this with your actual Greedy engine logic)
            # For this example, we'll just pick a random legal move
            enemy_move = random.choice(legal_moves) 
            board.push(enemy_move)
            
    # --- GAME OVER: CALCULATE REWARD ---
    result = board.result()
    if result == '1-0': reward = 1.0   # RL Won
    elif result == '0-1': reward = -1.0  # RL Lost
    else: reward = 0.0                 # Draw

    # Calculate Temporal Difference targets for the history
    # The final move gets the pure reward. Earlier moves are discounted.
    current_reward = reward
    for state in reversed(game_history):
        memory.append((state, current_reward))
        current_reward = current_reward * DISCOUNT_FACTOR

    # --- TRAIN THE MODEL (Experience Replay) ---
    # Only train if we have enough memories collected
    if len(memory) > 256:
        model.train()
        
        # Grab a random batch of 256 moves from past games
        batch = random.sample(memory, 256)
        batch_states = torch.tensor(np.array([m[0] for m in batch])).to(device)
        batch_targets = torch.tensor(np.array([m[1] for m in batch])).unsqueeze(1).to(device).float()
        
        optimizer.zero_grad()
        predictions = model(batch_states)
        loss = criterion(predictions, batch_targets)
        loss.backward()
        optimizer.step()
        
    print(f"Game {game+1} Complete | Result: {result} | Replay Buffer Size: {len(memory)}")

# Save the newly RL-optimized weights
torch.save(model.state_dict(), "goliath_rl_optimized.pth")