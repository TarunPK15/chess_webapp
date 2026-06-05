import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
import gc
import time  # <-- Added for the stopwatch

DATA_FILE = "kaggle_2M.parquet"
ONNX_SAVE_PATH = "evaluator_kaggle.onnx"
BATCH_SIZE = 4096
EPOCHS = 10
LEARNING_RATE = 0.001

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Targeting device: {device.type.upper()}")

print("Loading 2-Million row dataset into RAM (Hold on tight)...")
df = pd.read_parquet(DATA_FILE)

X = df.drop('label', axis=1).values.astype(np.float32)
y = df['label'].values.astype(np.float32)
del df 
gc.collect() 

print("Splitting data (80/10/10)...")
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.20, random_state=42)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42)

del X, y, X_temp, y_temp
gc.collect()

print(f"Ready: Train ({len(X_train)}), Val ({len(X_val)})")

train_dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train).unsqueeze(1))
val_dataset = TensorDataset(torch.tensor(X_val), torch.tensor(y_val).unsqueeze(1))

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

class ChessEvaluator(nn.Module):
    def __init__(self):
        super(ChessEvaluator, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(768, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Tanh()
        )

    def forward(self, x):
        return self.network(x)

model = ChessEvaluator().to(device)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

print("\n--- Unleashing the RTX 3050 ---")
train_losses, val_losses = [], []

# Start the grand total timer
total_start_time = time.time()

for epoch in range(EPOCHS):
    # Start the per-epoch timer
    epoch_start_time = time.time()
    
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

    # Calculate times and losses
    epoch_time = time.time() - epoch_start_time
    epoch_train_loss = running_train_loss / len(train_dataset)
    epoch_val_loss = running_val_loss / len(val_dataset)
    
    train_losses.append(epoch_train_loss)
    val_losses.append(epoch_val_loss)
    
    print(f"Epoch [{epoch+1}/{EPOCHS}] - Train Loss: {epoch_train_loss:.4f} | Val Loss: {epoch_val_loss:.4f} | Time: {epoch_time:.1f}s")

# Calculate grand total time
total_time = time.time() - total_start_time
mins, secs = divmod(total_time, 60)

print(f"\n✅ Training Complete! Total Flex Time: {int(mins)}m {secs:.1f}s")

plt.figure(figsize=(10, 5))
plt.plot(train_losses, label='Training Loss')
plt.plot(val_losses, label='Validation Loss')
plt.title('2M Kaggle Centipawn Model Loss')
plt.legend()
plt.savefig('loss_curve_kaggle.png')

print(f"\nExporting Goliath to {ONNX_SAVE_PATH}...")
model.eval()
model.to("cpu")
dummy_input = torch.randn(1, 768)
torch.onnx.export(model, dummy_input, ONNX_SAVE_PATH, export_params=True, input_names=['input'], output_names=['output'])
print("Goliath ONNX Export Complete!")