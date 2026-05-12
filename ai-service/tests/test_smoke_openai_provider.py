from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def test_smoke_openai_provider_skips_when_env_missing() -> None:
    project_root = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["RUN_OPENAI_SMOKE"] = "false"
    env["OPENAI_API_KEY"] = ""
    env["PYTHONPATH"] = str(project_root)
    result = subprocess.run(
        [sys.executable, "scripts/smoke_openai_provider.py"],
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )

    assert result.returncode == 0
    assert "SKIP:" in result.stdout
