from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from handlers.processor import process_file
from config import *
from handlers.ocr import create_ocr_task, deprecated_could_enable_ocr
from utils import logger, setup_logger
import logging
import time

log_level = getattr(logging, LOG_LEVEL, logging.INFO)
logger = setup_logger(level=log_level)
logger.info(f"Initializing app with log level: {LOG_LEVEL}")

app = FastAPI()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    request_id = id(request)
    client_host = request.client.host if request.client else "unknown"
    request_path = request.url.path
    request_method = request.method
    
    logger.debug(f"Request Start [{request_id}] {request_method} {request_path} from {client_host}")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    formatted_process_time = f"{process_time:.2f}"
    
    logger.info(
        f"Request End [{request_id}] {request_method} {request_path} "
        f"Status: {response.status_code} Time: {formatted_process_time}s"
    )
    
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"Allowed CORS origins: {CORS_ALLOW_ORIGINS}")
app.mount("/static", StaticFiles(directory="static"), name="static")
logger.info("Static files directory mounted")


@app.get("/")
def root():
    logger.debug("Access root path")
    return FileResponse("index.html", media_type="text/html")


@app.get("/favicon.ico")
def favicon():
    logger.debug("Request favicon.ico")
    return FileResponse("favicon.ico")


@app.post("/upload")
async def upload(
        file: UploadFile = File(...),
        enable_ocr: bool = Form(default=False),
        enable_vision: bool = Form(default=True),
        save_all: bool = Form(default=False),
        model: str = Form(default=""),  # deprecated
):
    """Accepts file and returns its contents."""
    logger.info(f"Received file upload request: {file.filename}, OCR={enable_ocr}, Vision={enable_vision}, Save all={save_all}")

    if model and len(model) > 0:
        # compatibility with deprecated model parameter
        logger.warning(f"Using deprecated model parameter: {model}")
        enable_ocr = deprecated_could_enable_ocr(model)
        enable_vision = not enable_ocr
        logger.info(f"Setting OCR={enable_ocr}, Vision={enable_vision} based on deprecated model parameter")

    if len(OCR_ENDPOINT) == 0:
        logger.warning("OCR endpoint not configured, disable OCR")
        enable_ocr = False

    try:
        logger.debug(f"Processing file: {file.filename}")
        filetype, contents = await process_file(
            file,
            enable_ocr=enable_ocr,
            enable_vision=enable_vision,
            save_all=save_all,
        )
        logger.info(f"File processed successfully: {file.filename}, type: {filetype}")
        return {
            "status": True,
            "content": contents,
            "type": filetype,
            "error": "",
        }
    except Exception as e:
        logger.error(f"Error processing file: {file.filename}, error: {str(e)}", exc_info=True)
        return {
            "status": False,
            "content": "",
            "type": "error",
            "error": str(e),
        }
