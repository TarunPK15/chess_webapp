# Stonkfish Chess Web App

A custom chess application and engine with a graphical user interface.

## Prerequisites

Before setting up the project, make sure you have Python installed. We recommend **Python 3.8 or higher**.
You can check your Python version by running:
```bash
python --version
```

---

## Setting Up a Virtual Environment (venv)

Using a virtual environment isolates project dependencies, preventing conflicts with other Python projects on your system.

### 1. Create the Virtual Environment
Navigate to the project root directory and run the following command:

```bash
python -m venv venv
```
*Note: This creates a folder named `venv` in your project directory containing the isolated Python environment.*

### 2. Activate the Virtual Environment

Select the appropriate activation command depending on your operating system and terminal/shell:

#### 🖥️ Windows
*   **PowerShell** (Default in modern Windows terminal):
    ```powershell
    .\venv\Scripts\Activate.ps1
    ```
    *If you get an execution policy error, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first, then activate.*

*   **Command Prompt (cmd.exe)**:
    ```cmd
    .\venv\Scripts\activate.bat
    ```

*   **Git Bash / WSL / MSYS2**:
    ```bash
    source venv/Scripts/activate
    ```

#### 🍎 macOS / 🐧 Linux
```bash
source venv/bin/activate
```

---

### 3. Install Dependencies
With the virtual environment active (you should see `(venv)` prepended to your command prompt), install the required dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Running the Application

To run the main chess application with the Tkinter GUI:

```bash
python baseline.py
```

---

## Running Tests

To run the unit tests (e.g., verifying legal move generations):

```bash
pytest
```

---

## Deactivating the Virtual Environment

When you are done working on the project, you can exit the virtual environment by running:

```bash
deactivate
```
