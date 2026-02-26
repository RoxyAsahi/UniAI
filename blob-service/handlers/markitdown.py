from io import BytesIO
from fastapi import UploadFile
from config import MARKITDOWN_USE_DOCINTEL, MARKITDOWN_DOCINTEL_ENDPOINT, MARKITDOWN_DOCINTEL_KEY, MARKITDOWN_ENABLE_PLUGINS, MARKITDOWN_USE_LLM, MARKITDOWN_LLM_MODEL, MARKITDOWN_LLM_ENDPOINT, MARKITDOWN_LLM_API_KEY
from utils import logger
import os

try:
    from markitdown import MarkItDown
    from openai import OpenAI
    MARKITDOWN_AVAILABLE = True
except ImportError:
    logger.warning("MarkItDown not installed. Installing...")
    MARKITDOWN_AVAILABLE = False


def is_supported(filename: str) -> bool:
    """Check if file can be processed by MarkItDown."""
    if not MARKITDOWN_AVAILABLE:
        return False
    
    ext = os.path.splitext(filename.lower())[1]
    supported_exts = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.md', '.txt']
    return ext in supported_exts


async def process(file: UploadFile) -> str:
    """Process file with MarkItDown and return its contents."""
    if not MARKITDOWN_AVAILABLE:
        raise ValueError("MarkItDown is not available. Please install it with `pip install markitdown`.")
    
    try:
        content = await file.read()
        file_bytes = BytesIO(content)
        file_bytes.name = file.filename
        
        temp_file_path = f"temp_{file.filename}"
        with open(temp_file_path, "wb") as f:
            f.write(content)
        
        md_kwargs = {"enable_plugins": MARKITDOWN_ENABLE_PLUGINS}
        
        if MARKITDOWN_USE_DOCINTEL and MARKITDOWN_DOCINTEL_ENDPOINT:
            md_kwargs["docintel_endpoint"] = MARKITDOWN_DOCINTEL_ENDPOINT
            logger.info(f"Using Document Intelligence with endpoint: {MARKITDOWN_DOCINTEL_ENDPOINT}")
            
            if MARKITDOWN_DOCINTEL_KEY:
                md_kwargs["docintel_key"] = MARKITDOWN_DOCINTEL_KEY
                logger.info("Using Document Intelligence with API key")
        
        if MARKITDOWN_USE_LLM and MARKITDOWN_LLM_MODEL:
            try:
                openai_kwargs = {}
                
                if MARKITDOWN_LLM_ENDPOINT:
                    openai_kwargs["base_url"] = MARKITDOWN_LLM_ENDPOINT
                    logger.info(f"Using custom LLM endpoint: {MARKITDOWN_LLM_ENDPOINT}")
                
                if MARKITDOWN_LLM_API_KEY:
                    openai_kwargs["api_key"] = MARKITDOWN_LLM_API_KEY
                    logger.info("Using custom LLM API key")
                
                client = OpenAI(**openai_kwargs)
                md_kwargs["llm_client"] = client
                md_kwargs["llm_model"] = MARKITDOWN_LLM_MODEL
                logger.info(f"Using LLM model: {MARKITDOWN_LLM_MODEL}")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
        
        md = MarkItDown(**md_kwargs)
        
        logger.info(f"Processing file with MarkItDown: {file.filename}")
        result = md.convert(temp_file_path)
        
        os.remove(temp_file_path)
        
        return result.text_content
    except Exception as e:
        logger.error(f"Error processing file with MarkItDown: {str(e)}")
        raise ValueError(f"Error processing file with MarkItDown: {str(e)}")
