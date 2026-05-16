import os
from dataclasses import dataclass
from typing import Optional

# Prices in USD per 1M tokens — COMMERCIAL LIST PRICES.
# This benchmark may run entirely on free tiers (OpenRouter :free, NIM free credits),
# but the cost-adjusted leaderboard uses these list prices so it reflects realistic
# deployment economics for an audit firm choosing a model for production use.
#
# Models prefixed "nim:" route to NVIDIA NIM (build.nvidia.com); the prefix is stripped
# before the API call. All other IDs route to OpenRouter as-is.
MODEL_COSTS = {
    # ---- OpenRouter ----
    # Anthropic
    "anthropic/claude-3.5-sonnet": {"input": 3.0, "output": 15.0},
    "anthropic/claude-3.7-sonnet": {"input": 3.0, "output": 15.0},
    "anthropic/claude-3.5-haiku": {"input": 0.80, "output": 4.0},
    "anthropic/claude-3-opus": {"input": 15.0, "output": 75.0},
    # OpenAI
    "openai/gpt-4o": {"input": 2.50, "output": 10.0},
    "openai/gpt-4o-mini": {"input": 0.15, "output": 0.60},
    # Google
    "google/gemini-flash-1.5": {"input": 0.075, "output": 0.30},
    "google/gemini-pro-1.5": {"input": 1.25, "output": 5.0},
    "google/gemini-2.0-flash-001": {"input": 0.10, "output": 0.40},
    # DeepSeek
    "deepseek/deepseek-chat": {"input": 0.14, "output": 0.28},
    # Meta / Llama
    "meta-llama/llama-3.3-70b-instruct": {"input": 0.59, "output": 0.79},
    "meta-llama/llama-3.1-8b-instruct": {"input": 0.02, "output": 0.05},
    # Qwen
    "qwen/qwen3-coder": {"input": 0.30, "output": 1.20},
    "qwen/qwen-2.5-coder-32b-instruct": {"input": 0.08, "output": 0.15},
    "qwen/qwen-2.5-72b-instruct": {"input": 0.40, "output": 0.40},
    # Z AI / GLM
    "z-ai/glm-4.5": {"input": 0.30, "output": 0.50},

    # OpenRouter free tiers — rate-limited but $0 actual spend.
    # Priced at paid-variant list rate for cost-adjusted scoring.
    "meta-llama/llama-3.3-70b-instruct:free": {"input": 0.59, "output": 0.79},
    "meta-llama/llama-3.1-8b-instruct:free": {"input": 0.02, "output": 0.05},
    "google/gemini-2.0-flash-exp:free": {"input": 0.10, "output": 0.40},
    "google/gemini-flash-1.5-8b:free": {"input": 0.04, "output": 0.15},
    "deepseek/deepseek-chat-v3-0324:free": {"input": 0.14, "output": 0.28},
    "qwen/qwen-2.5-coder-32b-instruct:free": {"input": 0.08, "output": 0.15},
    "z-ai/glm-4.5-air:free": {"input": 0.20, "output": 0.30},

    # ---- NVIDIA NIM (build.nvidia.com) ----
    # Free via NIM credits; priced at vendor commercial rates for cost-adjusted scoring.
    "nim:qwen/qwen3-coder-480b-a35b-instruct": {"input": 0.30, "output": 0.30},
    "nim:qwen/qwen2.5-coder-32b-instruct": {"input": 0.08, "output": 0.15},
    "nim:meta/llama-3.3-70b-instruct": {"input": 0.59, "output": 0.79},
    "nim:meta/llama-3.1-405b-instruct": {"input": 1.79, "output": 1.79},
    "nim:nvidia/llama-3.3-nemotron-super-49b-v1": {"input": 0.40, "output": 0.40},
    "nim:nvidia/llama-3.1-nemotron-70b-instruct": {"input": 0.35, "output": 0.40},
    "nim:deepseek-ai/deepseek-r1": {"input": 0.55, "output": 2.19},
    "nim:zai-org/glm-4.5": {"input": 0.30, "output": 0.50},
    "nim:microsoft/phi-4": {"input": 0.07, "output": 0.14},
    "nim:minimaxai/minimax-m2.7": {"input": 0.30, "output": 1.20},
    "nim:stepfun-ai/step-3.5-flash": {"input": 0.20, "output": 0.60},
    "nim:bytedance/seed-oss-36b-instruct": {"input": 0.15, "output": 0.30},
    "nim:mistralai/mistral-large-3-675b-instruct-2512": {"input": 2.00, "output": 6.00},
}


@dataclass
class LLMResponse:
    text: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    model: str


class LLMClient:
    """Unified client. Routes models prefixed `nim:` to NVIDIA NIM; everything else to OpenRouter.

    Both endpoints speak the OpenAI chat-completions protocol, so the OpenAI SDK is reused
    with different base_url and api_key per provider.
    """

    OPENROUTER_BASE = "https://openrouter.ai/api/v1"
    NIM_BASE = "https://integrate.api.nvidia.com/v1"

    def __init__(self):
        from openai import OpenAI

        or_key = os.getenv("OPENROUTER_API_KEY")
        nim_key = os.getenv("NVIDIA_API_KEY")

        if not or_key and not nim_key:
            raise RuntimeError(
                "Need at least one of OPENROUTER_API_KEY or NVIDIA_API_KEY. "
                "Get keys at https://openrouter.ai/keys and https://build.nvidia.com"
            )

        self.openrouter = (
            OpenAI(api_key=or_key, base_url=self.OPENROUTER_BASE) if or_key else None
        )
        self.nim = (
            OpenAI(api_key=nim_key, base_url=self.NIM_BASE) if nim_key else None
        )

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        if model not in MODEL_COSTS:
            return 0.0
        costs = MODEL_COSTS[model]
        return (input_tokens * costs["input"] + output_tokens * costs["output"]) / 1_000_000

    def _resolve(self, model: str):
        """Return (client, api_model_id, extra_headers) tuple for the given model."""
        if model.startswith("nim:"):
            if not self.nim:
                raise RuntimeError(
                    f"Model '{model}' requires NVIDIA_API_KEY. Get one at https://build.nvidia.com"
                )
            return self.nim, model[len("nim:"):], None

        if not self.openrouter:
            raise RuntimeError(
                f"Model '{model}' requires OPENROUTER_API_KEY. Get one at https://openrouter.ai/keys"
            )
        extra_headers = {
            "HTTP-Referer": "https://github.com/sc-audit-benchmark",
            "X-Title": "SC Audit Benchmark",
        }
        return self.openrouter, model, extra_headers

    def query(self, model: str, prompt: str, max_tokens: int = 2000, system: Optional[str] = None) -> LLMResponse:
        client, api_model, extra_headers = self._resolve(model)

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": api_model,
            "max_tokens": max_tokens,
            "temperature": 0,
            "messages": messages,
        }
        if extra_headers:
            kwargs["extra_headers"] = extra_headers

        response = client.chat.completions.create(**kwargs)

        text = response.choices[0].message.content or ""
        in_tokens = response.usage.prompt_tokens
        out_tokens = response.usage.completion_tokens
        cost = self._calculate_cost(model, in_tokens, out_tokens)

        return LLMResponse(
            text=text,
            input_tokens=in_tokens,
            output_tokens=out_tokens,
            cost_usd=cost,
            model=model,
        )
