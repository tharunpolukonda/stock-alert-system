from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scraper import StockScraper
import logging
from typing import Optional
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="Stock Alert API")

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    company_name: str


class SearchResponse(BaseModel):
    company_name: str
    price: Optional[float]
    success: bool
    error: Optional[str] = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Stock Alert API is running"
    }


@app.post("/api/search", response_model=SearchResponse)
async def search_stock(request: SearchRequest, response: Response):
    """
    Search for a stock and return its current price
    
    Args:
        request: SearchRequest with company_name
        
    Returns:
        SearchResponse with price data
    """
    # Disable caching so Vercel's CDN never serves a stale price
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    try:
        log.info(f"Searching for stock: {request.company_name}")
        
        scraper = StockScraper()
        result = scraper.scrape_stock_price(request.company_name)
        
        return SearchResponse(**result)
    
    except Exception as e:
        log.error(f"Error in search endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
