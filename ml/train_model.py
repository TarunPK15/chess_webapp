import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, TensorDataset
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
import matplotlib.pyplot as plt
import os
import time

# Configuration
DATA_FILE = "dataset.parquet"
ONNX_SAVE_PATH = "evaluator.onnx"
BATCH_SIZE = 2048
EPOCHS = 15
LEARNING_RATE = 0.001

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- 1. Load Data & 80/10/10 Split ---
print("Loading data...")
df = pd.read_parquet(DATA_FILE)

X = df.drop('label', axis=1).values.astype(np.float32)
y = df['label'].values.astype(np.float32)

# First split: 80% Train, 20% Temp
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.20, random_state=42)
# Second split: Split Temp in half to get 10% Val, 10% Test
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42)

print(f"Data Split: Train ({len(X_train)}), Val ({len(X_val)}), Test ({len(X_test)})")

# --- 2. Sklearn Baseline ---
print("\n--- Running Sklearn Baseline (Gradient Boosting) ---")
# We use HistGradientBoostingClassifier as it is optimized for large datasets.
# We convert labels back to 0, 1, 2 for classification (Black, Draw, White)
y_class_train = (y_train * 2).astype(int)
y_class_test = (y_test * 2).astype(int)

# To keep it under 2 minutes per the plan, we train the baseline on a 50k subset
subset_size = min(50000, len(X_train))
clf = HistGradientBoostingClassifier(max_iter=50)
clf.fit(X_train[:subset_size], y_class_train[:subset_size])
baseline_acc = clf.score(X_test, y_class_test)
print(f"Sklearn Baseline Accuracy: {baseline_acc * 100:.2f}%")

# --- 3. PyTorch DataLoaders ---
train_dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train).unsqueeze(1))
val_dataset = TensorDataset(torch.tensor(X_val), torch.tensor(y_val).unsqueeze(1))

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

# --- 4. PyTorch Model ---
class ChessEvaluator(nn.Module):
    def __init__(self):
        super(ChessEvaluator, self).__init__()
        # Added Dropout as per the plan to prevent overfitting
        self.network = nn.Sequential(
            nn.Linear(768, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.network(x)

model = ChessEvaluator().to(device)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# --- 5. Training Loop with Val tracking ---
print("\n--- Starting PyTorch Training ---")
train_losses = []
val_losses = []

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
    
    # Validation step
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

# --- 6. Plotting ---
plt.figure(figsize=(10, 5))
plt.plot(train_losses, label='Training Loss')
plt.plot(val_losses, label='Validation Loss')
plt.title('Model Loss Over Time')
plt.xlabel('Epochs')
plt.ylabel('MSE Loss')
plt.legend()
plt.savefig('loss_curve.png')
print("\nSaved loss curve to 'loss_curve.png'")

# --- 7. Export to ONNX ---
print(f"Exporting model to {ONNX_SAVE_PATH}...")
model.eval()
model.to("cpu") # Move to CPU for export
dummy_input = torch.randn(1, 768) # 1 batch, 768 features
torch.onnx.export(
    model, 
    dummy_input, 
    ONNX_SAVE_PATH, 
    export_params=True, 
    input_names=['input'], 
    output_names=['output']
)
print("ONNX Export Complete! Step 6 is fully satisfied.")