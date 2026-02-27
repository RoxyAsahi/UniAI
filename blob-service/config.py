from os import environ
import os
from pathlib import Path
from dotenv import load_dotenv
from utils import logger

config_cache = {}

def load_env_files():
    """load .env file"""
    base_dir = Path.cwd()
    env_file = base_dir / '.env'
    
    if env_file.exists():
        logger.info(f"Loading environment variables from {env_file}")
        load_dotenv(dotenv_path=str(env_file), override=True)
    else:
        logger.info("No .env file found, using environment variables only")

load_env_files()

def reload_config():
    """reload config, used for command line parameter override environment variable"""
    global config_cache
    config_cache = {}
    init_config()
    logger.info("Configuration reloaded")

def get_env(key: str, default=None):
    """
    get value from environment variable or .env file,
    .env file has higher priority
    """
    return os.environ.get(key, default)

def to_str(key: str, default: str = "") -> str:
    """Converts string to string."""
    if key in config_cache:
        return config_cache[key]
        
    value = get_env(key, default)
    result = value.strip() if value else default.strip()
    
    config_cache[key] = result
    return result


def to_none_str(key: str, default: str = None) -> str:
    """Converts string to string."""
    if f"none_str:{key}" in config_cache:
        return config_cache[f"none_str:{key}"]
        
    value = get_env(key, default)
    result = value.strip() if value else None
    
    config_cache[f"none_str:{key}"] = result
    return result


def to_endpoint(key: str, default: str = "") -> str:
    """Converts string to string."""
    if f"endpoint:{key}" in config_cache:
        return config_cache[f"endpoint:{key}"]
        
    result = to_str(key, default).rstrip("/")
    
    config_cache[f"endpoint:{key}"] = result
    return result


def to_list(key: str, default: list) -> list:
    """Converts comma-separated string to list."""
    if f"list:{key}" in config_cache:
        return config_cache[f"list:{key}"]
        
    key_value = to_str(key, "")
    if not key_value:
        config_cache[f"list:{key}"] = default
        return default

    result = [item for item in key_value.split(",") if item]
    
    config_cache[f"list:{key}"] = result
    return result


def to_bool(key: str, default: bool) -> bool:
    """Converts string to bool."""
    if f"bool:{key}" in config_cache:
        return config_cache[f"bool:{key}"]
        
    value = to_str(key, "")
    if not value:
        config_cache[f"bool:{key}"] = default
        return default

    result = value.lower() == "true" or value == "1"
    
    config_cache[f"bool:{key}"] = result
    return result


def to_float(key: str, default: float) -> float:
    """Converts string to float."""
    if f"float:{key}" in config_cache:
        return config_cache[f"float:{key}"]
        
    value = to_str(key, "")
    if not value:
        config_cache[f"float:{key}"] = default
        return default

    try:
        result = float(value)
        config_cache[f"float:{key}"] = result
        return result
    except ValueError:
        logger.warning(f"Could not convert {key}={value} to float, using default {default}")
        config_cache[f"float:{key}"] = default
        return default


def to_int(key: str, default: int) -> int:
    """Converts string to int."""
    if f"int:{key}" in config_cache:
        return config_cache[f"int:{key}"]
        
    value = to_str(key, "")
    if not value:
        config_cache[f"int:{key}"] = default
        return default

    try:
        result = int(value)
        config_cache[f"int:{key}"] = result
        return result
    except ValueError:
        logger.warning(f"Could not convert {key}={value} to int, using default {default}")
        config_cache[f"int:{key}"] = default
        return default

def init_config():
    """initialize all config items"""
    global CORS_ALLOW_ORIGINS, MAX_FILE_SIZE, PDF_MAX_IMAGES
    global AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, ENABLE_AZURE_SPEECH
    global STORAGE_TYPE, LOCAL_STORAGE_DOMAIN
    global S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION
    global S3_DOMAIN, S3_DIRECT_URL_DOMAIN, S3_SIGN_VERSION
    global S3_API, S3_SPACE
    global TG_ENDPOINT, TG_PASSWORD, TG_API
    global OCR_ENDPOINT, OCR_SKIP_MODELS, OCR_SPEC_MODELS
    global LOG_LEVEL
    global MARKITDOWN_ENABLE, MARKITDOWN_ENABLE_PLUGINS, MARKITDOWN_USE_DOCINTEL
    global MARKITDOWN_DOCINTEL_ENDPOINT, MARKITDOWN_DOCINTEL_KEY, MARKITDOWN_USE_LLM, MARKITDOWN_LLM_MODEL
    global MARKITDOWN_LLM_ENDPOINT, MARKITDOWN_LLM_API_KEY

    # General Config
    CORS_ALLOW_ORIGINS = to_list("CORS_ALLOW_ORIGINS", ["*"])  # CORS Allow Origins
    MAX_FILE_SIZE = to_float("MAX_FILE_SIZE", -1)  # Max File Size
    PDF_MAX_IMAGES = to_int("PDF_MAX_IMAGES", 10)  # PDF Max Images
    AZURE_SPEECH_KEY = to_str("AZURE_SPEECH_KEY")  # Azure Speech Key
    AZURE_SPEECH_REGION = to_str("AZURE_SPEECH_REGION")  # Azure Speech Region
    ENABLE_AZURE_SPEECH = AZURE_SPEECH_KEY and AZURE_SPEECH_REGION  # Enable Azure Speech

    # Storage Config
    STORAGE_TYPE = to_str("STORAGE_TYPE", "common")  # Storage Type
    LOCAL_STORAGE_DOMAIN = to_str("LOCAL_STORAGE_DOMAIN", "").rstrip("/")  # Local Storage Domain
    S3_BUCKET = to_str("S3_BUCKET", "")  # S3 Bucket
    S3_ACCESS_KEY = to_str("S3_ACCESS_KEY", "")  # S3 Access Key
    S3_SECRET_KEY = to_str("S3_SECRET_KEY", "")  # S3 Secret Key
    S3_REGION = to_str("S3_REGION", "")  # S3 Region
    S3_DOMAIN = to_endpoint("S3_DOMAIN", "")  # S3 Domain (Optional)
    S3_DIRECT_URL_DOMAIN = to_endpoint("S3_DIRECT_URL_DOMAIN", "")  # S3 Direct/Proxy URL Domain (Optional)
    S3_SIGN_VERSION = to_none_str("S3_SIGN_VERSION")  # S3 Sign Version
    S3_API = S3_DOMAIN or f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com"  # S3 API
    S3_SPACE = S3_DIRECT_URL_DOMAIN or S3_API  # S3 Image URL Domain
    TG_ENDPOINT = to_endpoint("TG_ENDPOINT", "")  # Telegram Endpoint
    TG_PASSWORD = to_str("TG_PASSWORD", "")  # Telegram Password
    TG_API = TG_ENDPOINT + "/api" + (f"?pass={TG_PASSWORD}" if TG_PASSWORD and len(TG_PASSWORD) > 0 else "")  # Telegram API

    # OCR Config
    OCR_ENDPOINT = to_endpoint("OCR_ENDPOINT", "")  # OCR Endpoint
    OCR_SKIP_MODELS = to_list("OCR_SKIP_MODELS", [])  # OCR Skip Models
    OCR_SPEC_MODELS = to_list("OCR_SPEC_MODELS", [])  # OCR Specific Models

    # MarkItDown Config
    MARKITDOWN_ENABLE = to_bool("MARKITDOWN_ENABLE", False)  # Enable MarkItDown
    MARKITDOWN_ENABLE_PLUGINS = to_bool("MARKITDOWN_ENABLE_PLUGINS", False)  # Enable MarkItDown Plugins
    MARKITDOWN_USE_DOCINTEL = to_bool("MARKITDOWN_USE_DOCINTEL", False)  # Use Document Intelligence
    MARKITDOWN_DOCINTEL_ENDPOINT = to_str("MARKITDOWN_DOCINTEL_ENDPOINT", "")  # Document Intelligence Endpoint
    MARKITDOWN_DOCINTEL_KEY = to_str("MARKITDOWN_DOCINTEL_KEY", "")  # Document Intelligence API Key
    MARKITDOWN_USE_LLM = to_bool("MARKITDOWN_USE_LLM", False)  # Use LLM for image descriptions
    MARKITDOWN_LLM_MODEL = to_str("MARKITDOWN_LLM_MODEL", "gpt-4o")  # LLM Model for image descriptions
    MARKITDOWN_LLM_ENDPOINT = to_str("MARKITDOWN_LLM_ENDPOINT", "")  # LLM Endpoint
    MARKITDOWN_LLM_API_KEY = to_str("MARKITDOWN_LLM_API_KEY", "")  # LLM API Key

    LOG_LEVEL = to_str("LOG_LEVEL", "INFO").upper()  # log level

init_config()
