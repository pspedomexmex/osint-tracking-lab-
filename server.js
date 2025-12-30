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

// 🆕 GEOLOCALIZACIÓN MÉXICO INMEDIATA (SIN APIs externas)
async function getGeoFromIP(ip) {
  console.log(`🎯 CLIC desde IP: ${ip}`);
  
  // Base de datos México realista para taller
  const geodb = {
    '189.217': { ciudad: 'Ecatepec de Morelos, Estado de México', isp: 'Telcel', lat: 19.6012, lon: -99.0487, pais: 'México' },
    '187.': { ciudad: 'Naucalpan, Estado de México', isp: 'Telcel', lat: 19.5247, lon: -99.2388, pais: 'México' },
    '200.57': { ciudad: 'Ciudad de México', isp: 'Telmex', lat: 19.4326, lon: -99.1332, pais: 'México' },
    '280.': { ciudad: 'Monterrey, Nuevo León', isp: 'AT&T', lat: 25.6866, lon: -100.3161, pais: 'México' },
    '189.': { ciudad: 'Valle de Chalco, Estado de México', isp: 'Telcel', lat: 19.4064, lon: -98.9742, pais: 'México' },
    '187.1': { ciudad: 'Nezahualcóyotl, Estado de México', isp: 'Telcel', lat: 19.3883, lon: -99.0194, pais: 'México' }
  };
  
  for (const [prefix, geo] of Object.entries(geodb)) {
    if (ip.startsWith(prefix)) {
      console.log(`✅ GEO: ${geo.ciudad} (${geo.isp})`);
      return geo;
    }
  }
  
  // Default Guanajuato (tu zona UVEG)
  console.log(`ℹ️ IP genérica México: ${ip}`);
  return {
    ciudad: 'Guanajuato, Guanajuato',
    isp: 'ISP local',
    lat: 21.0223,
    lon: -101.8413,
    pais: 'México'
  };
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
