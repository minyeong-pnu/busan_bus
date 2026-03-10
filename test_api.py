import requests
import urllib.parse

api_key = "1ac523e5004a96e070db6e08b4feb4532b2b67a7c92d955b0d0103b5db288b60"

url = "http://apis.data.go.kr/6260000/BusanBIMS/busStopList"
params = {
    "serviceKey": api_key,
    "pageNo": "1",
    "numOfRows": "10",
    "bstopnm": "서면"
}
# requests normally urlencodes params. If the key is rejected, we might need to use a pre-encoded query string.
resp = requests.get(url, params=params)
print("Status Code:", resp.status_code)
print("Response Length:", len(resp.text))
print("Response Starts With:")
print(resp.text[:1000])
