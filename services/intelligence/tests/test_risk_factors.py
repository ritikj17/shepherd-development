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
