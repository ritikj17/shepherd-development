import pytest
from types import SimpleNamespace

# Import the compute_risk function from the intelligence service
from app.risk.compute import compute_risk


def make_classification(label: str, indicators=None):
    """Helper to create a simple classification object with .label and .indicators."""
    if indicators is None:
        indicators = []
    return SimpleNamespace(label=label, indicators=indicators)





def test_digital_exposure_factor_unavailable_when_no_context():
    classification = make_classification("doxxing")
    result = compute_risk(description="test description", evidence=[], ocr_results=[], classification=classification)

    d_factor = next(f for f in result["factors"] if f["name"] == "D")
    assert d_factor["value"] == 0
    assert "(unavailable)" in d_factor["explanation"]

    # All other factors unavailable
    for name in ["T", "F", "E", "P"]:
        factor = next(f for f in result["factors"] if f["name"] == name)
        assert factor["value"] == 0
        assert "(unavailable)" in factor["explanation"]

    assert result["score"] == 0
    assert result["level"] == "insufficient_data"
    assert "pending clarification from Shrey" in result["explanation"]


def test_threat_indicator_dict_matching_sets_t_factor():
    """Verify that dict indicators matching threat keywords successfully set T factor."""
    indicators = [
        {"name": "threat", "description": "Matched pattern 'threatens to kill' in context: 'threatens to kill me'"}
    ]
    classification = make_classification("threat", indicators=indicators)
    result = compute_risk(description="violent threat", evidence=[], ocr_results=[], classification=classification)

    t_factor = next(f for f in result["factors"] if f["name"] == "T")
    assert t_factor["value"] == 80
    assert "(unavailable)" not in t_factor["explanation"]


def test_threat_indicator_dict_non_matching():
    """Verify that non-threat dict indicators keep T factor unavailable."""
    indicators = [
        {"name": "general_harassment", "description": "unwanted contact without violence"}
    ]
    classification = make_classification("general_harassment", indicators=indicators)
    result = compute_risk(description="hello", evidence=[], ocr_results=[], classification=classification)

    t_factor = next(f for f in result["factors"] if f["name"] == "T")
    assert t_factor["value"] == 0
    assert "(unavailable)" in t_factor["explanation"]


def test_threat_indicator_malformed_and_edge_cases():
    """Verify resilience against malformed indicators (None, empty dict, string, ints)."""
    malformed_indicators = [
        None,
        {},
        {"name": None, "description": None},
        {"name": "threat", "description": None},
        12345,
        "explicit threat of violent attack",
    ]
    classification = make_classification("threat", indicators=malformed_indicators)
    # Should not raise AttributeError or any exception
    result = compute_risk(description="some text", evidence=[], ocr_results=[], classification=classification)
    t_factor = next(f for f in result["factors"] if f["name"] == "T")
    # "threat" name and string matched the keyword
    assert t_factor["value"] == 80

