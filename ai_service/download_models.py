"""
Download model.joblib and label.joblib from Hugging Face (foduucom/baby-cry-classification).
Run once before starting the AI service:

    pip install huggingface-hub
    python download_models.py
"""

from pathlib import Path

REPO_ID = "foduucom/baby-cry-classification"
DIR = Path(__file__).resolve().parent


def main():
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("Install huggingface-hub: pip install huggingface-hub")
        raise SystemExit(1)

    for name in ("model.joblib", "label.joblib"):
        out = DIR / name
        if out.exists():
            print(f"Already exists: {out}")
            continue
        print(f"Downloading {name}...")
        path = hf_hub_download(
            repo_id=REPO_ID,
            filename=name,
            local_dir=str(DIR),
        )
        print(f"Saved: {path}")

    print("Done. Start the service with: uvicorn app:app --reload --host 0.0.0.0 --port 8000")


if __name__ == "__main__":
    main()
