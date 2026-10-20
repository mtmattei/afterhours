from pathlib import Path
import base64
import json
import re
import zipfile

root = Path(__file__).resolve().parent.parent
project = root
dist = project / 'dist'
(root/'release').mkdir(exist_ok=True)
references = '\n'.join(p.read_text(encoding='utf-8') for p in dist.iterdir() if p.suffix in ['.js','.css','.html'])
assets = {
    path.name: 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()
    for path in sorted((dist/'assets').glob('*.png'))
}
html = (dist/'index.html').read_text(encoding='utf-8')
styles = re.findall(r'<link rel="stylesheet" href="([^"]+)">', html)
css = '\n'.join((dist/name).read_text(encoding='utf-8') for name in styles)
for name in assets:
    css = css.replace("url('assets/"+name+"')", 'var(--asset-'+name.replace('.','-')+')')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>'+css+'</style>')
for name in styles[1:]:
    html = html.replace('<link rel="stylesheet" href="'+name+'">','')
boot = '<script>window.ART='+json.dumps(assets,separators=(',',':'))+''';
// CSS custom properties have a size ceiling. Render small UI thumbnails at their display scale.
for(const name of ['avatars.png','side-b.png','room-atlas.png','my-room.png']){
 const image=new Image();
 image.onload=()=>{const thumb=document.createElement('canvas'),size=name==='avatars.png'?504:384;
  thumb.width=size;thumb.height=Math.round(image.naturalHeight/image.naturalWidth*size);
  thumb.getContext('2d').drawImage(image,0,0,thumb.width,thumb.height);
  document.documentElement.style.setProperty('--asset-'+name.replace('.','-'),'url("'+thumb.toDataURL('image/png')+'")');
 };image.src=window.ART[name];
}
</script>'''
html = html.replace('<script src="movement.js">', boot+'<script src="movement.js">')
for name in re.findall(r'<script src="([^"]+)"></script>', html):
    script = (dist/name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    script = script.replace("'assets/'+file", "window.ART[file]")
    for asset in assets:
        script = script.replace("'assets/"+asset+"'", "window.ART['"+asset+"']")
    html = html.replace('<script src="'+name+'"></script>', '<script>'+script+'</script>')
assert not re.search(r'<script[^>]+src=',html)
assert not re.search(r'<link rel="stylesheet"',html)
assert "url('assets/" not in html
(root/'release/Afterhours.html').write_text(html,encoding='utf-8')
with zipfile.ZipFile(root/'release/afterhours-prototype.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            archive.write(path, 'afterhours/'+path.relative_to(project).as_posix())
    for name in ['DESIGN.txt','ART-PROMPTS.txt','GAME-OBJECTS-PROMPT.txt','REMAKE-ROADMAP.txt','server.mjs','session-core.mjs']:
        archive.write(project/name,'afterhours/'+name)
print('Standalone HTML and source ZIP rebuilt.')
print(f'{len(assets)} images embedded; {len(html):,} characters; no external script files.')
