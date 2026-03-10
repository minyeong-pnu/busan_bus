from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests
import xml.etree.ElementTree as ET
import os

app = FastAPI(title="Busan Bus Arrival Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = "1ac523e5004a96e070db6e08b4feb4532b2b67a7c92d955b0d0103b5db288b60"

def parse_xml_to_dict(xml_string):
    try:
        root = ET.fromstring(xml_string)
        items = []
        for item in root.findall('.//item'):
            item_data = {}
            for child in item:
                item_data[child.tag] = child.text
            items.append(item_data)
        return items
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return []

@app.get("/api/stops")
def get_stops(name: str):
    url = "http://apis.data.go.kr/6260000/BusanBIMS/busStopList"
    params = {
        "serviceKey": API_KEY,
        "bstopnm": name,
        "pageNo": "1",
        "numOfRows": "50"
    }
    resp = requests.get(url, params=params)
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="API request failed")
    
    data = parse_xml_to_dict(resp.text)
    return {"status": "success", "data": data}

@app.get("/api/arrivals")
def get_arrivals(bstopid: str):
    url = "http://apis.data.go.kr/6260000/BusanBIMS/stopArrByBstopid"
    params = {
        "serviceKey": API_KEY,
        "bstopid": bstopid,
        "pageNo": "1",
        "numOfRows": "50"
    }
    resp = requests.get(url, params=params)
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="API request failed")
    
    data = parse_xml_to_dict(resp.text)
    return {"status": "success", "data": data}

# Ensure static dir exists
os.makedirs("static", exist_ok=True)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
