from hashlib import sha256, md5
from typing import List
import logging
import sys
from typing import Optional
import os

def sha2_file(filename) -> str:
    """Returns hash of file."""
    with open(filename, "rb") as buffer:
        return sha256(buffer.read()).hexdigest()


def md5_file(filename) -> str:
    """Returns hash of file."""
    with open(filename, "rb") as buffer:
        return md5(buffer.read()).hexdigest()


def sha2_encode(string) -> str:
    """Returns hash of string."""
    return sha256(string.encode("utf-8")).hexdigest()


def md5_encode(string) -> str:
    """Returns hash of string."""
    return md5(string.encode("utf-8")).hexdigest()


def contains(value: str, items: List[str]) -> bool:
    """Returns True if value is in items or contains it."""

    return any(item in value for item in items if item)


def setup_logger(name: str = "blob-service", level: Optional[int] = None) -> logging.Logger:
    """Setup and return a configured logger.

    Args:
        name: The name of the logger, default is 'blob-service'
        level: The log level, default is None (use INFO level)

    Returns:
        The configured logger instance
    """
    if level is None:
        log_level_str = os.environ.get("LOG_LEVEL", "INFO").upper()
        try:
            level = getattr(logging, log_level_str)
        except AttributeError:
            level = logging.INFO

    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    logger.setLevel(level)
    logger.propagate = False
    
    return logger


logger = setup_logger()
