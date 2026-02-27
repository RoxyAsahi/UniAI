from fastapi import UploadFile, File

from config import ENABLE_AZURE_SPEECH, MAX_FILE_SIZE, MARKITDOWN_ENABLE
from handlers import (
    pdf,
    word,
    ppt,
    xlsx,
    image,
    speech,
    markitdown,
)
from store.store import process_all
from utils import logger


async def read_file_size(file: UploadFile) -> float:
    """Read file size and return it in MiB."""

    # dont using file.read() directly because it will consume the file content
    file_size = 0
    while chunk := await file.read(20480):  # read chunk of 20KiB per iteration
        file_size += len(chunk)
    await file.seek(0)
    logger.debug(f"File size calculated: {file.filename}, size: {file_size / 1024 / 1024:.2f} MiB")
    return file_size / 1024 / 1024


async def process_file(
        file: UploadFile = File(...),
        enable_ocr: bool = False,
        enable_vision: bool = True,
        save_all: bool = False,
) -> (str, str):
    """Process file and return its contents."""
    logger.debug(f"Processing file: {file.filename}, OCR={enable_ocr}, Vision={enable_vision}, Save all={save_all}")

    if MAX_FILE_SIZE > 0:
        logger.debug(f"Check file size limit: max {MAX_FILE_SIZE} MiB")
        file_size = await read_file_size(file)
        if file_size > MAX_FILE_SIZE:
            logger.warning(f"File size exceeds limit: {file.filename}, size: {file_size:.2f} MiB, limit: {MAX_FILE_SIZE} MiB")
            raise ValueError(f"File size {file_size:.2f} MiB exceeds the limit of {MAX_FILE_SIZE} MiB.")

    filename = file.filename.lower()
    logger.debug(f"Processing file: {filename}")

    if save_all:
        # save all types of files to storage
        logger.info(f"Save all types of files: {filename}")
        return "file", await process_all(file)

    # markitdown is enabled and the current file type is supported
    if MARKITDOWN_ENABLE and markitdown.is_supported(filename):
        logger.info(f"Processing file with MarkItDown: {filename}")
        try:
            return "markitdown", await markitdown.process(file)
        except Exception as e:
            logger.error(f"Error processing file with MarkItDown: {str(e)}")
            logger.info(f"Falling back to default file processing")
            # downgrade to default file processing if markitdown processing failed

    if pdf.is_pdf(filename):
        logger.info(f"Processing PDF file: {filename}")
        return "pdf", await pdf.process(
            file,
            enable_ocr=enable_ocr,
            enable_vision=enable_vision,
        )
    elif word.is_docx(filename):
        logger.info(f"Processing Word file: {filename}")
        return "docx", word.process(file)
    elif ppt.is_pptx(filename):
        logger.info(f"Processing PowerPoint file: {filename}")
        return "pptx", ppt.process(file)
    elif xlsx.is_xlsx(filename):
        logger.info(f"Processing Excel file: {filename}")
        return "xlsx", xlsx.process(file)
    elif image.is_image(filename):
        logger.info(f"Processing image file: {filename}")
        return "image", await image.process(
            file,
            enable_ocr=enable_ocr,
            enable_vision=enable_vision,
        )
    elif ENABLE_AZURE_SPEECH and speech.is_audio(filename):
        logger.info(f"Processing audio file: {filename}")
        return "audio", speech.process(file)

    logger.info(f"Processing as text file: {filename}")
    content = await file.read()
    return "text", content.decode("utf-8")
