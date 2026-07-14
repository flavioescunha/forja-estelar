import urllib.request
import re

try:
    url = 'https://astro.if.ufrgs.br/estrelas/node14.htm'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('latin1')
    
    # search for img with name related to hr
    matches = re.findall(r'img[^>]+src=["\']([^"\']+)["\']', html)
    print("Found images:", matches)
    for m in matches:
        if 'hr' in m.lower() or 'diag' in m.lower() or 'img' in m.lower():
            img_url = 'https://astro.if.ufrgs.br/estrelas/' + m
            print("Downloading:", img_url)
            img_data = urllib.request.urlopen(urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})).read()
            with open('hr-diagram.png', 'wb') as f:
                f.write(img_data)
            print("Success")
            break
except Exception as e:
    print("Error:", e)
