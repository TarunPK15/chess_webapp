import onnxruntime as ort
import numpy as np
import chess
import os

class MLEvaluator:
    def __init__(self, model_path="evaluator.onnx"):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Could not find model at {model_path}")
            
        # Configure ONNX Runtime for single-threaded cloud performance
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 1
        sess_options.inter_op_num_threads = 1
        
        # Initialize ONNX Runtime session with optimized CPU settings
        self.session = ort.InferenceSession(model_path, sess_options=sess_options)
        self.input_name = self.session.get_inputs()[0].name

    def score(self, features: np.ndarray) -> float:
        """
        Takes a 768-element numpy array.
        Returns a float between 0.0 (Black winning) and 1.0 (White winning).
        """
        # Ensure the data type matches the ONNX export (float32) and add batch dimension
        input_data = features.astype(np.float32).reshape(1, 768)
        
        # Run inference without needing PyTorch
        result = self.session.run(None, {self.input_name: input_data})
        
        # Extract the scalar value from the output array
        return float(result[0][0][0])

if __name__ == "__main__":
    print("Testing ONNX MLEvaluator...")
    
    try:
        evaluator = MLEvaluator("evaluator.onnx")
        
        # 1. Generate the features for the standard starting position
        board = chess.Board()
        features = np.zeros(768, dtype=np.float32)
        
        PIECES = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
        COLORS = [chess.WHITE, chess.BLACK]
        
        for color_idx, color in enumerate(COLORS):
            for piece_idx, piece_type in enumerate(PIECES):
                squares = board.pieces(piece_type, color)
                plane_offset = (color_idx * 6 + piece_idx) * 64
                for square in squares:
                    features[plane_offset + square] = 1.0
                    
        # 2. Score the board
        start_score = evaluator.score(features)
        print(f"Starting Position Score: {start_score:.4f}")
        
        # 3. Verify it's near 0.5 (perfectly balanced)
        if 0.40 <= start_score <= 0.60:
            print("✅ TEST PASSED: Model recognizes the starting board as perfectly balanced (~0.5).")
            print("Step 6 is officially complete.")
        else:
            print("⚠️ WARNING: Score is heavily skewed. Check feature alignment.")
            
    except Exception as e:
        print(f"❌ TEST FAILED: {e}")