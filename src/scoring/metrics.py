def compute_model_score(judgments: list[dict], scan_costs: float) -> dict:
    valid_judgments = [j for j in judgments if "judgment" in j and "error" not in j["judgment"]]

    if not valid_judgments:
        return {"error": "No valid judgments"}

    total = len(valid_judgments)

    found = sum(1 for j in valid_judgments if j["judgment"].get("found_correct_vuln"))
    detection_rate = (found / total) * 100

    swc_matches = sum(1 for j in valid_judgments if j["judgment"].get("swc_id_match"))
    swc_accuracy = (swc_matches / total) * 100

    severity_exact = sum(1 for j in valid_judgments if j["judgment"].get("severity_match") == "exact")
    severity_close = sum(1 for j in valid_judgments if j["judgment"].get("severity_match") == "close")
    severity_score = ((severity_exact * 1.0 + severity_close * 0.5) / total) * 100

    location_exact = sum(1 for j in valid_judgments if j["judgment"].get("location_accuracy") == "exact")
    location_approx = sum(1 for j in valid_judgments if j["judgment"].get("location_accuracy") == "approximate")
    location_score = ((location_exact * 1.0 + location_approx * 0.5) / total) * 100

    explanations = [j["judgment"].get("explanation_quality", 0) for j in valid_judgments]
    avg_explanation = (sum(explanations) / len(explanations)) if explanations else 0

    total_fp = sum(j["judgment"].get("false_positives", 0) for j in valid_judgments)
    fp_per_scan = total_fp / total

    overall_scores = [j["judgment"].get("overall_score", 0) for j in valid_judgments]
    quality_score = (sum(overall_scores) / len(overall_scores)) * 100 if overall_scores else 0

    cost_adjusted = (quality_score / scan_costs) if scan_costs > 0 else 0

    return {
        "detection_rate": round(detection_rate, 1),
        "swc_id_accuracy": round(swc_accuracy, 1),
        "severity_score": round(severity_score, 1),
        "location_score": round(location_score, 1),
        "avg_explanation_quality": round(avg_explanation, 2),
        "false_positives_per_scan": round(fp_per_scan, 2),
        "quality_score": round(quality_score, 1),
        "total_scan_cost_usd": round(scan_costs, 4),
        "cost_adjusted_score": round(cost_adjusted, 1),
        "scenarios_evaluated": total,
    }


def generate_leaderboard(judgments: dict, scan_costs: dict, contracts_count: int) -> dict:
    leaderboard = {
        "benchmark_version": "generative-solidity-vuln-v1",
        "total_contracts": contracts_count,
        "models": {},
    }

    for model, model_judgments in judgments.items():
        leaderboard["models"][model] = compute_model_score(
            model_judgments,
            scan_costs.get(model, 0.0),
        )

    valid_models = {m: d for m, d in leaderboard["models"].items() if "error" not in d}

    if valid_models:
        quality_winner = max(valid_models.items(), key=lambda x: x[1]["quality_score"])
        cost_winner = max(valid_models.items(), key=lambda x: x[1]["cost_adjusted_score"])

        leaderboard["winners"] = {
            "highest_quality": {
                "model": quality_winner[0],
                "score": quality_winner[1]["quality_score"],
            },
            "best_value": {
                "model": cost_winner[0],
                "score": cost_winner[1]["cost_adjusted_score"],
            },
        }

    return leaderboard
