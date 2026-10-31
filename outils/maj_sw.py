"""Met à jour sw.js : liste des fichiers à garder en cache (hors ligne) et numéro de version.
Usage : python3 outils/maj_sw.py [version]   (par défaut : date du jour + .1, .2…)"""
import os, re, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app') if os.path.isdir(os.path.join(HERE, '..', 'app')) else os.path.join(HERE, '..')
SKIP_DIRS = {'synchro', 'outils'}
SKIP_FILES = {'sw.js', 'README.md', '.nojekyll'}
files = []
for root, dirs, names in os.walk(APP):
    dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith('.'))
    for n in sorted(names):
        rel = os.path.relpath(os.path.join(root, n), APP).replace(os.sep, '/')
        if rel in SKIP_FILES or n.startswith('LICENSE') or n.startswith('.'):
            continue
        files.append(rel)
p = os.path.join(APP, 'sw.js')
s = open(p, encoding='utf-8').read()
old = re.search(r"const VERSION = '([^']+)'", s).group(1)
if len(sys.argv) > 1:
    ver = sys.argv[1]
else:
    today = datetime.date.today().isoformat()
    n = int(old.split('.')[-1]) + 1 if old.startswith(today) else 1
    ver = f'{today}.{n}'
core = "const CORE = [\n  './',\n" + ',\n'.join(f"  '{f}'" for f in files) + "\n];"
s = re.sub(r"const VERSION = '[^']+'", f"const VERSION = '{ver}'", s)
s = re.sub(r"const CORE = \[.*?\];", core, s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)
print('version', old, '->', ver, '|', len(files), 'fichiers en cache')
