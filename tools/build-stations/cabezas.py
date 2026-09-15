import subprocess, sys, collections
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
urls = {
 '1':'/storage/app/media/red/linea1/l1_cabeza.jpg',
 '2':'/storage/app/media/uploaded-files/cabeza_linea2.png',
 '3':'/storage/app/media/uploaded-files/cabeza_linea3.png',
 '4':'/storage/app/media/red/linea4/cabeza_linea4.png',
 '5':'/storage/app/media/uploaded-files/cabeza_linea5.png',
 '6':'/storage/app/media/uploaded-files/cabeza_linea6.png',
 '7':'/storage/app/media/uploaded-files/cabeza_linea7.png',
 '8':'/storage/app/media/uploaded-files/cabeza_linea8.png',
 '9':'/storage/app/media/uploaded-files/cabeza_linea9.png',
 'A':'/storage/app/media/uploaded-files/cabeza_lineaA.png',
 'B':'/storage/app/media/uploaded-files/cabeza_lineaB.png',
 '12':'/storage/app/media/red/linea12/cabeza-linea12.png',
}
for L, u in urls.items():
    ext = u.rsplit('.',1)[1]
    fn = f'cabezas/l{L}.{ext}'
    subprocess.run(['curl','-sL','-A','Mozilla/5.0','https://www.metro.cdmx.gob.mx'+u,'-o',fn])
    try:
        im = Image.open(fn).convert('RGB')
    except Exception as e:
        print(L, 'ERROR', e); continue
    px = list(im.getdata())
    # Ignore near-white, near-black, and grays (likely text/background)
    def is_chromatic(p):
        r,g,b = p; mx,mn = max(p),min(p)
        return mx-mn > 40 and mx > 60 and mn < 230
    chrom = [p for p in px if is_chromatic(p)]
    # quantize to reduce noise
    q = collections.Counter((r//8*8, g//8*8, b//8*8) for r,g,b in chrom)
    top = q.most_common(3)
    allq = collections.Counter((r//8*8, g//8*8, b//8*8) for r,g,b in px).most_common(2)
    print(f"L{L:3s} {im.size}  dominante cromático: " + ', '.join(f'#{r:02X}{g:02X}{b:02X}({n*100//len(px)}%)' for (r,g,b),n in top) + "   | todo: " + ', '.join(f'#{r:02X}{g:02X}{b:02X}({n*100//len(px)}%)' for (r,g,b),n in allq))
