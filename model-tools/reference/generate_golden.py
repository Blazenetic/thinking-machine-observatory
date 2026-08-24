#!/usr/bin/env python3
"""Generate deterministic source-framework token and full-logit fixtures.

The large model weights stay in the Hugging Face cache. The repository receives
only small metadata plus one little-endian float32 vector per prompt.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModelForCausalLM, AutoTokenizer

SOURCE_MODEL = {
    "id": "distilbert/distilgpt2",
    "revision": "2290a62682d06624634c1f46a6ad5be0f47f38aa",
    "weightsPath": "model.safetensors",
    "weightsSha256": "e1ff18884359fe8beb795a5f414feb85a6ce3d929ad019c0d958c039d2b94a1b",
}
BROWSER_MODEL = {
    "id": "Xenova/distilgpt2",
    "revision": "a41c10485c18a64b6606729b6a082330cbd8f49e",
}
BROWSER_VARIANTS = {
    "fp32": {
        "weightsPath": "onnx/model.onnx",
        "weightsSha256": "d605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c",
        "sizeBytes": 327_825_716,
        "verificationStatus": "accepted",
    },
    "int8": {
        "weightsPath": "onnx/model_int8.onnx",
        "weightsSha256": "80b02da4fe266412bc49c9955a518151c50f9bac062f596a875068492a21f080",
        "sizeBytes": 236_698_606,
        "verificationStatus": "rejected",
    },
}

EXPECTED_VERSIONS = {
    "huggingface-hub": "0.29.3",
    "numpy": "2.2.3",
    "onnx": "1.17.0",
    "onnxruntime": "1.20.1",
    "optimum": "1.24.0",
    "safetensors": "0.5.3",
    "tokenizers": "0.21.0",
    "torch": "2.6.0+cpu",
    "transformers": "4.49.0",
}
EXPECTED_PYTHON = "3.12.13"

SOURCE_ASSETS = (
    "config.json",
    "merges.txt",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
)
BROWSER_ASSETS = (
    "config.json",
    "generation_config.json",
    "merges.txt",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
)
BROWSER_TOKENIZER_ASSETS = frozenset(
    {
        "merges.txt",
        "special_tokens_map.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "vocab.json",
    }
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical_asset_set_sha256(records: list[dict[str, Any]]) -> str:
    """Hash a stable, reviewable inventory rather than cache-specific paths."""
    canonical = json.dumps(
        sorted(records, key=lambda item: item["path"]),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def assert_environment() -> dict[str, str]:
    if sys.version.split()[0] != EXPECTED_PYTHON:
        raise RuntimeError(
            f"Python {EXPECTED_PYTHON} is required, found {sys.version.split()[0]}."
        )

    actual: dict[str, str] = {}
    for package, expected in EXPECTED_VERSIONS.items():
        value = importlib.metadata.version(package)
        actual[package] = value
        if value != expected:
            raise RuntimeError(f"{package} must be {expected}, found {value}.")
    return actual


def fetch_asset_manifest(
    repository: dict[str, str],
    assets: tuple[str, ...],
    cache_directory: Path,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for asset in assets:
        path = Path(
            hf_hub_download(
                repo_id=repository["id"],
                filename=asset,
                revision=repository["revision"],
                cache_dir=cache_directory,
            )
        )
        records.append(
            {
                "path": asset,
                "sha256": sha256_file(path),
                "sizeBytes": path.stat().st_size,
            }
        )
    return records


def token_specimens(tokenizer: Any, token_ids: list[int]) -> list[dict[str, Any]]:
    specimens: list[dict[str, Any]] = []
    for position, token_id in enumerate(token_ids):
        text = tokenizer.decode(
            [token_id],
            clean_up_tokenization_spaces=False,
            skip_special_tokens=False,
        )
        specimens.append(
            {
                "byteValues": list(text.encode("utf-8")),
                "position": position,
                "text": text,
                "tokenId": token_id,
            }
        )
    return specimens


def golden_case(tokenizer: Any, model: Any, item: dict[str, str], output: Path) -> dict[str, Any]:
    encoded = tokenizer(item["prompt"], add_special_tokens=False, return_tensors="pt")
    input_ids = encoded["input_ids"]
    attention_mask = encoded["attention_mask"]

    with torch.inference_mode():
        sequence_logits = model(input_ids=input_ids, attention_mask=attention_mask).logits.float()

        mutated_ids = input_ids.clone()
        mutated_ids[0, -1] = (mutated_ids[0, -1] + 1) % model.config.vocab_size
        mutated_logits = model(input_ids=mutated_ids, attention_mask=attention_mask).logits.float()

    final_logits = (
        sequence_logits[0, -1].detach().cpu().numpy().astype("<f4", copy=False)
    )
    output_path = output / f"{item['id']}.logits.f32le"
    output_path.write_bytes(final_logits.tobytes(order="C"))

    token_ids = [int(value) for value in input_ids[0].tolist()]
    ranking = np.argsort(-final_logits, kind="stable")[:50]
    top_50 = [
        {
            "logit": float(final_logits[token_id]),
            "text": tokenizer.decode(
                [int(token_id)],
                clean_up_tokenization_spaces=False,
                skip_special_tokens=False,
            ),
            "tokenId": int(token_id),
        }
        for token_id in ranking
    ]

    prefix = sequence_logits[:, :-1]
    mutated_prefix = mutated_logits[:, :-1]
    prefix_error = (
        0.0
        if prefix.numel() == 0
        else float(torch.max(torch.abs(prefix - mutated_prefix)).item())
    )
    final_delta = float(
        torch.max(torch.abs(sequence_logits[:, -1] - mutated_logits[:, -1])).item()
    )

    return {
        "causalMaskCheck": {
            "finalPositionChangedMaxAbsolute": final_delta,
            "mutatedFinalTokenId": int(mutated_ids[0, -1]),
            "prefixMaxAbsoluteError": prefix_error,
        },
        "id": item["id"],
        "logits": {
            "encoding": "float32-le",
            "path": output_path.name,
            "sha256": sha256_file(output_path),
            "valueCount": int(final_logits.size),
        },
        "positionCheck": {
            "finalPositionIndex": len(token_ids) - 1,
            "logitSequenceLength": int(sequence_logits.shape[1]),
            "tokenSequenceLength": len(token_ids),
        },
        "prompt": item["prompt"],
        "promptSha256": hashlib.sha256(item["prompt"].encode("utf-8")).hexdigest(),
        "purpose": item["purpose"],
        "tokenIds": token_ids,
        "tokens": token_specimens(tokenizer, token_ids),
        "top50": top_50,
    }


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--browser-fp32-model",
        type=Path,
        default=(
            Path(os.environ["OBSERVATORY_ONNX_MODEL_FP32"])
            if "OBSERVATORY_ONNX_MODEL_FP32" in os.environ
            else None
        ),
        help="Optional downloaded fp32 browser ONNX asset to hash and verify.",
    )
    parser.add_argument(
        "--browser-int8-model",
        type=Path,
        default=(
            Path(os.environ["OBSERVATORY_ONNX_MODEL_INT8"])
            if "OBSERVATORY_ONNX_MODEL_INT8" in os.environ
            else None
        ),
        help="Optional downloaded int8 browser ONNX asset to hash and verify.",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path(os.environ.get("HF_HOME", "/tmp/observatory-hf")),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository_root / "fixtures/model-golden/source-fp32",
    )
    parser.add_argument(
        "--prompts",
        type=Path,
        default=Path(__file__).with_name("prompts.json"),
    )
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    versions = assert_environment()
    arguments.output.mkdir(parents=True, exist_ok=True)

    prompts = json.loads(arguments.prompts.read_text(encoding="utf-8"))
    tokenizer = AutoTokenizer.from_pretrained(
        SOURCE_MODEL["id"],
        revision=SOURCE_MODEL["revision"],
        cache_dir=arguments.cache_dir,
        use_fast=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        SOURCE_MODEL["id"],
        revision=SOURCE_MODEL["revision"],
        cache_dir=arguments.cache_dir,
        use_safetensors=True,
    ).eval()

    source_assets = fetch_asset_manifest(
        SOURCE_MODEL,
        SOURCE_ASSETS,
        arguments.cache_dir,
    )
    source_weight = next(item for item in source_assets if item["path"] == "model.safetensors")
    if source_weight["sha256"] != SOURCE_MODEL["weightsSha256"]:
        raise RuntimeError("Source safetensors SHA-256 did not match the pinned manifest.")

    browser_assets = fetch_asset_manifest(
        BROWSER_MODEL,
        BROWSER_ASSETS,
        arguments.cache_dir,
    )
    browser_tokenizer_assets = [
        item for item in browser_assets if item["path"] in BROWSER_TOKENIZER_ASSETS
    ]
    local_browser_models = {
        "fp32": arguments.browser_fp32_model,
        "int8": arguments.browser_int8_model,
    }
    browser_targets: list[dict[str, Any]] = []
    for dtype, variant in BROWSER_VARIANTS.items():
        weight: dict[str, Any] = {
            "path": variant["weightsPath"],
            "sha256": variant["weightsSha256"],
            "sizeBytes": variant["sizeBytes"],
            "verifiedFromLocalBytes": False,
        }
        local_path = local_browser_models[dtype]
        if local_path is not None:
            actual_browser_hash = sha256_file(local_path)
            if actual_browser_hash != variant["weightsSha256"]:
                raise RuntimeError(f"Browser {dtype} ONNX SHA-256 did not match the pinned manifest.")
            weight["sizeBytes"] = local_path.stat().st_size
            weight["verifiedFromLocalBytes"] = True
        browser_targets.append(
            {
                "asset": weight,
                "dtype": dtype,
                "verificationStatus": variant["verificationStatus"],
            }
        )

    cases = [golden_case(tokenizer, model, item, arguments.output) for item in prompts]
    manifest = {
        "browserRuntime": {
            "assets": browser_assets,
            "id": BROWSER_MODEL["id"],
            "licence": "Apache-2.0",
            "revision": BROWSER_MODEL["revision"],
            "runtime": {
                "name": "@huggingface/transformers",
                "onnxRuntimeWeb": "1.22.0-dev.20250409-89f8206ba4",
                "version": "3.8.1",
            },
            "sourceUrl": f"https://huggingface.co/{BROWSER_MODEL['id']}/tree/{BROWSER_MODEL['revision']}",
            "targets": browser_targets,
            "tokenizerBundle": {
                "canonicalisation": "sorted-json-v1",
                "includedPaths": sorted(BROWSER_TOKENIZER_ASSETS),
                "sha256": canonical_asset_set_sha256(browser_tokenizer_assets),
            },
        },
        "cases": cases,
        "formatVersion": "1.0.0",
        "sourceFramework": {
            "assets": source_assets,
            "dtype": "float32",
            "id": SOURCE_MODEL["id"],
            "licence": "Apache-2.0",
            "python": sys.version.split()[0],
            "revision": SOURCE_MODEL["revision"],
            "sourceUrl": f"https://huggingface.co/{SOURCE_MODEL['id']}/tree/{SOURCE_MODEL['revision']}",
            "versions": versions,
        },
    }
    manifest_path = arguments.output / "manifest.json"
    manifest_path.write_text(
        f"{json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )
    print(f"Generated {len(cases)} full-vocabulary fixtures at {manifest_path}.")


if __name__ == "__main__":
    main()
