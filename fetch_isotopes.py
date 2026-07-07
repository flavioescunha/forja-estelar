import urllib.request
import csv
import json

url = 'https://www-nds.iaea.org/relnsd/v0/data?fields=ground_states&nuclides=all'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
response = urllib.request.urlopen(req).read().decode('utf-8')

# The response is a CSV string
lines = response.split('\n')
reader = csv.DictReader(lines)

isotopes = {}

# We only care about Z <= 30
for row in reader:
    try:
        z = int(row['z'])
    except:
        continue
    if z > 30:
        continue
        
    n = int(row['n'])
    a = z + n
    symbol = row['symbol'].strip()
    
    # Capitalize correctly
    if len(symbol) > 1:
        symbol = symbol[0].upper() + symbol[1:].lower()
    else:
        symbol = symbol.upper()
        
    key = f"{symbol}-{a}"
    
    # We ignore the neutron for Z=0, wait, Neutron is n
    if z == 0 and n == 1:
        key = 'n'
        symbol = 'n'
        
    mass_u = 0.0
    # IAEA mass is often given in 'atomic_mass' which is mass excess or atomic mass?
    # Let's read atomic_mass. It's usually the micro-u offset or the mass directly?
    # Wait, 'atomic_mass' in IAEA is typically in micro-amu (e.g., 1007825 for H-1)
    try:
        mass_u = float(row['atomic_mass']) / 1e6
    except:
        pass
        
    # If mass is 0 or unreadable, we can try to estimate it using A + massexcess
    if mass_u == 0.0:
        try:
            mass_excess_kev = float(row['massexcess'])
            # 1 u = 931494 keV
            mass_u = a + (mass_excess_kev / 931.494) / 1000.0
        except:
            mass_u = float(a) # fallback
            
    half_life = row['half_life_sec'].strip()
    is_stable = (row['half_life'] == 'STABLE')
    
    decay_mode = None
    if not is_stable:
        d1 = row['decay_1'].strip()
        if 'B-' in d1:
            decay_mode = 'BETA_MINUS'
        elif 'B+' in d1 or 'EC' in d1 or 'EP' in d1:
            decay_mode = 'BETA_PLUS' # or EC
        elif 'A' == d1 or 'A ' in d1:
            decay_mode = 'ALPHA'
        elif 'P' == d1 or 'P ' in d1:
            decay_mode = 'PROTON_EMISSION'
        elif 'N' == d1 or 'N ' in d1:
            decay_mode = 'NEUTRON_EMISSION'
            
    half_life_val = 0
    if not is_stable and half_life:
        try:
            half_life_val = float(half_life)
        except:
            half_life_val = 1e-9 # Fallback for very unstable
            
    isotopes[key] = {
        'Z': z,
        'N': n,
        'A': a,
        'symbol': symbol,
        'name': f"{symbol}-{a}",
        'mass_u': round(mass_u, 6),
        'isStable': is_stable,
        'realHalfLife_s': half_life_val if not is_stable else None,
        'decayMode': decay_mode
    }

# Ensure some standard names
name_map = {
    'H-1': 'Prótio',
    'H-2': 'Deutério',
    'H-3': 'Trítio',
    'He-4': 'Hélio-4',
    'He-3': 'Hélio-3',
    'C-12': 'Carbono-12',
    'O-16': 'Oxigênio-16',
    'Fe-56': 'Ferro-56',
    'n': 'Nêutron'
}

for k, v in name_map.items():
    if k in isotopes:
        isotopes[k]['name'] = v

print(f"Total isotopes Z<=30 parsed: {len(isotopes)}")

with open('isotopes_db.json', 'w', encoding='utf-8') as f:
    json.dump(isotopes, f, indent=2, ensure_ascii=False)
