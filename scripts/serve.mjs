// Servidor estático local: nunca conecta con TiDB/Gemini. Las APIs responden 503.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'API desactivada en desarrollo local; usa mocks de prueba.'}));return;}
  if(pathname!=='/' && pathname!=='/index.html' && !/^\/assets\/[\w.-]+\.(js|css)$/.test(pathname)){res.writeHead(404);res.end();return;}
  try{const path=pathname==='/'?'index.html':pathname.slice(1);res.setHeader('Content-Type',mime[path.slice(path.lastIndexOf('.'))]||'text/plain');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('BioVolt local http://127.0.0.1:4173 · APIs desactivadas'));
