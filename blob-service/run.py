import uvicorn
import logging
import argparse
import os
from utils import setup_logger
from config import LOG_LEVEL, reload_config

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CoAI Blob Service")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="host")
    parser.add_argument("--port", type=int, default=8000, help="port")
    parser.add_argument("--log-level", type=str, default=None, help="log level")
    parser.add_argument("--reload", action="store_true", help="enable auto reload")
    args = parser.parse_args()
    
    if args.log_level:
        valid_log_levels = ["debug", "info", "warning", "error", "critical"]
        if args.log_level.lower() not in valid_log_levels:
            print(f"Warning: Invalid log level {args.log_level}, using INFO instead")
            args.log_level = "info"
        
        os.environ["LOG_LEVEL"] = args.log_level.upper()
        reload_config()
    
    log_level_name = LOG_LEVEL
    log_level = getattr(logging, log_level_name)
    
    logger = setup_logger("blob-service", log_level)
    logger.info(f"CoAI Blob Service - Start with log level: {log_level_name}")
    
    log_config = uvicorn.config.LOGGING_CONFIG
    log_config["formatters"]["access"]["fmt"] = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_config["formatters"]["default"]["fmt"] = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    uvicorn_log_level = log_level_name.lower()
    
    logger.info(f"Starting server at http://{args.host}:{args.port}")
    if args.reload:
        logger.info("Auto-reload is enabled")
    
    uvicorn.run(
        "main:app", 
        host=args.host, 
        port=args.port, 
        reload=args.reload, 
        log_level=uvicorn_log_level,
        log_config=log_config
    )
