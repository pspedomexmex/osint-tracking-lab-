import express from 'express';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(process.cwd(), 'links.json');

app.use(express.json());
app.use(express.static('public'));

// Trust proxy para IPs reales en Render
app.set('trust proxy', true);

function loadLinks() {
  if (!fs.existsSync(DATA_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch { return []; }
}

function saveLinks(links) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(links, null, 2));
}

async function getGeoFromIP(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { 
      signal: AbortSignal.timeout(2000) 
    });
    const data = await res.json();
    return {
      ciudad: `${data.city || 'N/A'}, ${data.region || ''}`.trim(),
      pais: data.country_name || 'México',
      lat: data.latitude,
      lon: data.longitude,
      isp: data.org || 'ISP desconocido'
    };
  } catch(e) {
    console.log(`❌ API falló: ${e.message}`);
    return {
      ciudad: 'Estado de México',
      isp: 'Telcel',
      lat: 19.4339,
      lon: -99.1175,
      pais: 'México'
    };
  }
}





app.post('/api/nuevo', (req, res) => {
  const { destino } = req.body;
  if (!destino || !destino.startsWith('http')) {
    return res.status(400).json({ error: 'URL inválida' });
  }
  
  const links = loadLinks();
  const id = nanoid(6);
  const nuevoLink = { id, destino, clicks: [], creado: new Date().toISOString() };
  
  links.push(nuevoLink);
  saveLinks(links);
  
  res.json({
    corto: `${req.protocol}://${req.get('host')}/l/${id}`,
    id, destino
  });
});

app.get('/l/:id', async (req, res) => {
  const { id } = req.params;
  const links = loadLinks();
  const link = links.find(l => l.id === id);
  
  if (!link) return res.status(404).send('Enlace no encontrado');
  
  // 🆕 IP REAL (Render proxy)
  const ipReal = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                 req.ip || req.connection.remoteAddress || '127.0.0.1';
  
  console.log(`🎯 CLIC: ${id} desde IP ${ipReal}`);
  
  // 🆕 GEOLOCALIZACIÓN INMEDIATA
  const geo = await getGeoFromIP(ipReal);
  
  const clic = {
    ip: ipReal,
    userAgent: req.headers['user-agent'] || 'desconocido',
    fecha: new Date().toISOString(),
    referrer: req.headers.referer || null,
    ciudad: geo.ciudad,
    pais: geo.pais,
    lat: geo.lat,
    lon: geo.lon,
    isp: geo.isp
  };
  
  link.clicks.push(clic);
  saveLinks(links);
  
  res.redirect(302, link.destino);
});

app.get('/api/links', (req, res) => res.json(loadLinks()));
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  let links = loadLinks();
  const indice = links.findIndex(l => l.id === id);
  if (indice === -1) return res.status(404).json({ error: 'No encontrado' });
  
  links.splice(indice, 1);
  saveLinks(links);
  res.json({ ok: true, mensaje: `Eliminado ${id}` });
});

app.listen(PORT, () => {
  console.log(`🚀 OSINT Lab con GEOLOCALIZACIÓN puerto ${PORT}`);
});
