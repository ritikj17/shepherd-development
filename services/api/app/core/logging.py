import logging


def configure_logging(level: str = "INFO") -> None:
    """Configure operational logging.

    Never log authorization tokens, passwords, private evidence bytes, or raw OCR text.
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
