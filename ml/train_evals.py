import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

DATA_FILE = "dataset_evals.parquet"
ONNX_SAVE_PATH = "evaluator_cp.onnx"
BATCH_SIZE = 1024
EPOCHS = 20
LEARNING_RATE = 0.001

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("Loading Stockfish evaluated data...")
# Convert column names to strings to silence the Pandas warning for the future
df = pd.read_parquet(DATA_FILE)
df.columns = df.columns.astype(str)

X = df.drop('label', axis=1).values.astype(np.float32)
y = df['label'].values.astype(np.float32)

X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.20, random_state=42)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42)

print(f"Data Split: Train ({len(X_train)}), Val ({len(X_val)}), Test ({len(X_test)})")

train_dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train).unsqueeze(1))
val_dataset = TensorDataset(torch.tensor(X_val), torch.tensor(y_val).unsqueeze(1))

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

class ChessEvaluator(nn.Module):
    def __init__(self):
        super(ChessEvaluator, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(768, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Tanh()  # <--- CRITICAL CHANGE: Outputs -1.0 to 1.0
        )

    def forward(self, x):
        return self.network(x)

model = ChessEvaluator().to(device)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

print("\n--- Starting PyTorch Training ---")
train_losses, val_losses = [], []

for epoch in range(EPOCHS):
    model.train()
    running_train_loss = 0.0
    for batch_X, batch_y in train_loader:
        batch_X, batch_y = batch_X.to(device), batch_y.to(device)
        optimizer.zero_grad()
        predictions = model(batch_X)
        loss = criterion(predictions, batch_y)
        loss.backward()
        optimizer.step()
        running_train_loss += loss.item() * batch_X.size(0)
    
    model.eval()
    running_val_loss = 0.0
    with torch.no_grad():
        for batch_X, batch_y in val_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            predictions = model(batch_X)
            loss = criterion(predictions, batch_y)
            running_val_loss += loss.item() * batch_X.size(0)

    epoch_train_loss = running_train_loss / len(train_dataset)
    epoch_val_loss = running_val_loss / len(val_dataset)
    train_losses.append(epoch_train_loss)
    val_losses.append(epoch_val_loss)
    
    print(f"Epoch [{epoch+1}/{EPOCHS}] - Train Loss: {epoch_train_loss:.4f} | Val Loss: {epoch_val_loss:.4f}")

plt.figure(figsize=(10, 5))
plt.plot(train_losses, label='Training Loss')
plt.plot(val_losses, label='Validation Loss')
plt.title('Stockfish Centipawn Model Loss')
plt.legend()
plt.savefig('loss_curve_cp.png')

print(f"\nExporting to {ONNX_SAVE_PATH}...")
model.eval()
model.to("cpu")
dummy_input = torch.randn(1, 768)
torch.onnx.export(model, dummy_input, ONNX_SAVE_PATH, export_params=True, input_names=['input'], output_names=['output'])
print("ONNX Export Complete!")