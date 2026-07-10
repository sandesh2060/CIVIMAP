from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.road_damage_verification import router as road_damage_router
from routes.plate_detection import router as plate_router
# image_moderation gets wired here the same way once that model is built:
# from routes.image_moderation import router as moderation_router

app = FastAPI(title="CIVIMAP AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(road_damage_router)
app.include_router(plate_router)
# app.include_router(moderation_router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)