"""
Pamantasan Records Management System - PaddleOCR Microservice
Provides deep learning text recognition and Image-to-PDF conversion.
"""

import io
import os
import sys
import base64
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from PIL import Image
import pymupdf as fitz
from paddleocr import PaddleOCR

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PamantasanOCR")

# Initialize FastAPI app
app = FastAPI(
    title="Pamantasan PaddleOCR Service",
    description="High-accuracy OCR text recognition and Image-to-PDF conversion service",
    version="1.0.0",
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-loaded PaddleOCR instances cache
_ocr_instances = {}

def get_ocr_engine(lang: str = "en") -> PaddleOCR:
    """Retrieve or initialize the PaddleOCR engine for the given language."""
    if lang not in _ocr_instances:
        logger.info(f"Initializing PaddleOCR engine for language: {lang}...")
        _ocr_instances[lang] = PaddleOCR(lang=lang)
        logger.info(f"PaddleOCR engine initialized for language: {lang}")
    return _ocr_instances[lang]


def enhance_document_whitening(image_bytes: bytes) -> tuple[Image.Image, bytes]:
    """
    Apply document illumination leveling and background whitening:
    Normalizes background gradients, turns gray paper into crisp white, and deepens black text.
    """
    try:
        import numpy as np
        import cv2

        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_img)

        # 1. Convert to grayscale to estimate background illumination
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

        # 2. Estimate background illumination via morphological closing and blur
        dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
        bg = cv2.medianBlur(dilated, 21)

        # 3. Divide image by background to level lighting and remove shadows
        diff = 255 - cv2.absdiff(gray, bg)
        norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)

        # 4. Enhance contrast: stretch paper to pure white, darken text
        _, thresh = cv2.threshold(norm, 215, 255, cv2.THRESH_TRUNC)
        whitened = cv2.normalize(thresh, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)

        result_rgb = cv2.cvtColor(whitened, cv2.COLOR_GRAY2RGB)
        enhanced_pil = Image.fromarray(result_rgb)

        buf = io.BytesIO()
        enhanced_pil.save(buf, format="JPEG", quality=95)
        return enhanced_pil, buf.getvalue()
    except Exception as exc:
        logger.warning(f"Could not apply OpenCV whitening filter: {exc}")
        raw_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return raw_pil, image_bytes


def process_image_ocr(image_bytes: bytes, lang: str = "en", auto_whiten: bool = True):
    """
    Run PaddleOCR on image bytes and return extracted line items and full text.
    """
    engine = get_ocr_engine(lang)

    # Apply paper background whitening to remove shadows and dark tables
    if auto_whiten:
        image, processed_bytes = enhance_document_whitening(image_bytes)
    else:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            rgb_io = io.BytesIO()
            image.save(rgb_io, format="JPEG", quality=95)
            processed_bytes = rgb_io.getvalue()
        else:
            processed_bytes = image_bytes

    img_width, img_height = image.size

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
        temp_file.write(processed_bytes)
        temp_path = temp_file.name
    
    line_items = []
    total_confidence = 0.0
    text_pieces = []
    
    try:
        raw_predictions = list(engine.predict(temp_path))
        for res_dict in raw_predictions:
            if isinstance(res_dict, dict):
                texts = res_dict.get("rec_texts", [])
                scores = res_dict.get("rec_scores", [])
                polys = res_dict.get("dt_polys", [])
                
                for idx in range(len(texts)):
                    t = str(texts[idx]).strip()
                    if not t:
                        continue
                    
                    s = float(scores[idx]) if idx < len(scores) else 0.95
                    poly = polys[idx].tolist() if idx < len(polys) and hasattr(polys[idx], "tolist") else polys[idx] if idx < len(polys) else None
                    
                    total_confidence += s
                    text_pieces.append(t)
                    
                    line_items.append({
                        "box": poly,
                        "text": t,
                        "confidence": round(s, 4),
                    })
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
    
    avg_conf = (total_confidence / len(line_items)) if line_items else 0.0
    full_text = "\n".join(text_pieces)
    
    return {
        "image": image,
        "image_bytes": processed_bytes,
        "width": img_width,
        "height": img_height,
        "lines": line_items,
        "full_text": full_text,
        "average_confidence": round(avg_conf, 4),
        "lines_count": len(line_items)
    }


def create_searchable_pdf(ocr_result: dict, title: str = "Scanned Document") -> bytes:
    """
    Generate a high-quality PDF containing the original image with embedded
    searchable text layers and an institutional transcription summary page.
    """
    doc = fitz.open()
    
    img_bytes = ocr_result["image_bytes"]
    width = ocr_result["width"]
    height = ocr_result["height"]
    lines = ocr_result["lines"]
    
    # PAGE 1: Scanned Visual Page with Searchable Invisible/Overlay Text Layer (Standard ISO A4)
    if width > height:
        page_width, page_height = 842.0, 595.0  # Landscape A4
    else:
        page_width, page_height = 595.0, 842.0  # Portrait A4

    page1 = doc.new_page(width=page_width, height=page_height)
    
    # Scale image proportionally to fit clean A4 page canvas with consistent margin
    page_margin = 15.0
    avail_w = page_width - (2.0 * page_margin)
    avail_h = page_height - (2.0 * page_margin)
    
    scale = min(avail_w / width, avail_h / height)
    target_w = width * scale
    target_h = height * scale
    
    # Center image on A4 page
    offset_x = page_margin + (avail_w - target_w) / 2.0
    offset_y = page_margin + (avail_h - target_h) / 2.0
    
    rect = fitz.Rect(offset_x, offset_y, offset_x + target_w, offset_y + target_h)
    page1.insert_image(rect, stream=img_bytes)
    
    # Embed invisible text blocks on top of detected bounding boxes (scaled accurately to A4)
    for item in lines:
        box = item["box"]
        text = item["text"]
        
        # Bounding box coordinates: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        x_coords = [pt[0] for pt in box]
        y_coords = [pt[1] for pt in box]
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)
        
        scaled_min_x = offset_x + (min_x * scale)
        scaled_max_x = offset_x + (max_x * scale)
        scaled_min_y = offset_y + (min_y * scale)
        scaled_max_y = offset_y + (max_y * scale)
        
        box_rect = fitz.Rect(scaled_min_x, scaled_min_y, scaled_max_x, scaled_max_y)
        font_size = max(7, int((scaled_max_y - scaled_min_y) * 0.75))
        
        try:
            # Insert text invisibly (render_mode=3 means neither fill nor stroke = invisible searchable text)
            page1.insert_textbox(
                box_rect,
                text,
                fontsize=font_size,
                fontname="helv",
                render_mode=3
            )
        except Exception:
            pass
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Pamantasan PaddleOCR Microservice",
        "version": "1.0.0",
        "engine": "PaddleOCR 3.7.0",
        "python": sys.version
    }


@app.post("/ocr/extract-text")
async def extract_text_endpoint(
    file: UploadFile = File(...),
    language: str = Form("en")
):
    """
    Extract text lines and bounding boxes from an uploaded image.
    """
    try:
        contents = await file.read()
        ocr_result = process_image_ocr(contents, lang=language)
        return {
            "success": True,
            "fileName": file.filename,
            "fullText": ocr_result["full_text"],
            "averageConfidence": ocr_result["average_confidence"],
            "linesCount": ocr_result["lines_count"],
            "lines": ocr_result["lines"]
        }
    except Exception as exc:
        logger.error(f"Error processing OCR text extraction: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/ocr/convert-to-pdf")
async def convert_to_pdf_endpoint(
    file: UploadFile = File(...),
    language: str = Form("en"),
    customTitle: Optional[str] = Form(None)
):
    """
    Perform PaddleOCR and convert image to a multi-layered searchable PDF.
    Returns base64 encoded PDF and extracted text metadata.
    """
    try:
        contents = await file.read()
        ocr_result = process_image_ocr(contents, lang=language)
        
        doc_title = customTitle or os.path.splitext(file.filename or "document")[0]
        pdf_bytes = create_searchable_pdf(ocr_result, title=doc_title)
        
        pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
        
        # Prepare auto-suggested clean filename
        base_name = os.path.splitext(file.filename or "document")[0]
        pdf_filename = f"{base_name}.pdf"
        
        return {
            "success": True,
            "originalFileName": file.filename,
            "pdfFileName": pdf_filename,
            "pdfBase64": pdf_base64,
            "sizeBytes": len(pdf_bytes),
            "mimeType": "application/pdf",
            "extractedText": ocr_result["full_text"],
            "averageConfidence": ocr_result["average_confidence"],
            "linesCount": ocr_result["lines_count"]
        }
    except Exception as exc:
        logger.error(f"Error converting image to PDF with OCR: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5005))
    logger.info(f"Starting Pamantasan PaddleOCR service on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
