import urllib.request

try:
    url = 'https://upload.wikimedia.org/wikipedia/commons/1/17/Hertzsprung-Russell_Diagram_-_pt.png'
    # Use a generic browser user-agent to bypass 429 Bot Traffic blocks on Wikipedia
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'})
    img_data = urllib.request.urlopen(req).read()
    with open('hr-diagram.png', 'wb') as f:
        f.write(img_data)
    print("Success")
except Exception as e:
    print("Error:", e)
