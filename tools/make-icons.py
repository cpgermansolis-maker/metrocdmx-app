"""Convierte icon.svg en los PNG que pide el manifest (192, 512) y el de iOS (180).

Usa Chrome o Edge en modo headless para rasterizar el SVG (no necesita librerías
extra) y Pillow para reducir de tamaño con buena calidad.

    python tools/make-icons.py
"""
import os, subprocess, sys, tempfile, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, 'icon.svg')
OUT = {'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180}

CANDIDATES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
browser = next((c for c in CANDIDATES if os.path.exists(c)), None) or shutil.which('chrome') or shutil.which('chromium')
if not browser:
    sys.exit('No encontré Chrome ni Edge. Instala uno o convierte icon.svg a PNG con otra herramienta.')

# Página mínima que muestra el SVG a 512x512 sin márgenes.
svg = open(SVG, encoding='utf-8').read()
html = f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:transparent}}svg{{display:block}}</style>{svg}'
tmpdir = tempfile.mkdtemp()
page = os.path.join(tmpdir, 'icon.html'); open(page, 'w', encoding='utf-8').write(html)
shot = os.path.join(tmpdir, 'shot.png')

subprocess.run([browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                '--default-background-color=00000000', '--window-size=512,512',
                f'--screenshot={shot}', 'file:///' + page.replace('\\', '/')],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

im = Image.open(shot).convert('RGBA')
if im.size != (512, 512):          # por si el navegador impone un tamaño mínimo de ventana
    im = im.crop((0, 0, 512, 512))
for name, size in OUT.items():
    out = im if size == 512 else im.resize((size, size), Image.LANCZOS)
    out.save(os.path.join(ROOT, name), optimize=True)
    print(f'{name}: {size}x{size}')
shutil.rmtree(tmpdir, ignore_errors=True)
