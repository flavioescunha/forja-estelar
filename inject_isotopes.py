import json
import re

with open('isotopes_db.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

# Filter out Z=0, A>1
filtered_db = {}
for k, v in db.items():
    if v['Z'] == 0 and v['A'] > 1:
        continue
    filtered_db[k] = v

# We need to preserve the elementary particles and specific flags
extra_isotopes = {
  'e-': { 'Z':-1, 'N':0,  'A':0,  'symbol':'e⁻', 'name':'Elétron',       'mass_u':0.0005485, 'isStable':True,  'isElementary':True, 'type':'electron' },
  'e+': { 'Z':1,  'N':0,  'A':0,  'symbol':'e⁺', 'name':'Pósitron',      'mass_u':0.0005485, 'isStable':False, 'realHalfLife_s':0.08, 'isElementary':True, 'type':'positron', 'isAntiparticle':True },
  'n':  { 'Z':0,  'N':1,  'A':1,  'symbol':'n',  'name':'Nêutron',       'mass_u':1.008665,  'isStable':False, 'realHalfLife_s':611, 'decayMode':'BETA_MINUS', 'isElementary':True, 'type':'neutron' },
}

# Goal flags
goals = {'Fe-56'}
special_roles = {'Be-8': 'TRIPLE_ALPHA'}

# Merge
for k, v in extra_isotopes.items():
    filtered_db[k] = v
    
for k, v in filtered_db.items():
    if k in goals:
        v['isGoal'] = True
    if k in special_roles:
        v['specialRole'] = special_roles[k]

# Convert to JS string
js_str = "const ISOTOPES = {\n"
for k, v in filtered_db.items():
    # Convert python dict to JS object string
    props = []
    for pk, pv in v.items():
        if pv is None:
            continue
        if isinstance(pv, str):
            props.append(f"{pk}:'{pv}'")
        elif isinstance(pv, bool):
            props.append(f"{pk}:{'true' if pv else 'false'}")
        else:
            props.append(f"{pk}:{pv}")
    js_str += f"  '{k}': {{ {', '.join(props)} }},\n"
js_str += "};\n"

# Replace in data.js
with open('js/data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to find const ISOTOPES = { ... };
pattern = re.compile(r'const ISOTOPES = \{.*?\n\};\n', re.DOTALL)
if not pattern.search(content):
    print("Could not find ISOTOPES block")
else:
    new_content = pattern.sub(js_str, content)
    with open('js/data.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Injected successfully.")
