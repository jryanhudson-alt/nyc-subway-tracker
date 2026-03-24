const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');
const path    = require('path');
const GtfsRT  = require('gtfs-realtime-bindings');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── All 8 MTA GTFS-RT feeds ───────────────────────────────────────────────────
const MTA_FEEDS = [
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',      routes: ['1','2','3','4','5','6','7','GS'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',  routes: ['A','C','E','H','FS'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm', routes: ['B','D','F','M'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',    routes: ['G'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',   routes: ['J','Z'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',    routes: ['L'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw', routes: ['N','Q','R','W'] },
  { url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',   routes: ['SI'] },
];

const ROUTE_TO_FEED = {};
for (const feed of MTA_FEEDS) {
  for (const route of feed.routes) ROUTE_TO_FEED[route] = feed.url;
}

const ROUTE_COLORS = {
  '1':'#EE352E','2':'#EE352E','3':'#EE352E',
  '4':'#00933C','5':'#00933C','6':'#00933C',
  '7':'#B933AD',
  'A':'#0039A6','C':'#0039A6','E':'#0039A6',
  'B':'#FF6319','D':'#FF6319','F':'#FF6319','M':'#FF6319',
  'G':'#6CBE45','J':'#996633','Z':'#996633',
  'L':'#A7A9AC',
  'N':'#FCCC0A','Q':'#FCCC0A','R':'#FCCC0A','W':'#FCCC0A',
  'GS':'#808183','FS':'#808183','H':'#808183','SI':'#0039A6',
};

// ── Station list with lat/lng coordinates ────────────────────────────────────
// Each station has a unique GTFS stop ID. Stations sharing a name but in
// different locations (e.g. "125 St" on 1 vs 4/5/6) are kept separate
// because they are physically different stops.
const STATIONS = [
  // ── 1 train ──
  { id:'101', name:'Van Cortlandt Park–242 St',      borough:'Bronx',     routes:['1'],                        lat:40.889248, lng:-73.898583, northLabel:'',                    southLabel:'Manhattan' },
  { id:'103', name:'238 St',                          borough:'Bronx',     routes:['1'],                        lat:40.884667, lng:-73.900870, northLabel:'Van Cortlandt Park',  southLabel:'Manhattan' },
  { id:'104', name:'231 St',                          borough:'Bronx',     routes:['1'],                        lat:40.878856, lng:-73.904834, northLabel:'Van Cortlandt Park',  southLabel:'Manhattan' },
  { id:'106', name:'Marble Hill–225 St',              borough:'Bronx',     routes:['1'],                        lat:40.874561, lng:-73.909831, northLabel:'Van Cortlandt Park',  southLabel:'Manhattan' },
  { id:'107', name:'215 St',                          borough:'Manhattan', routes:['1'],                        lat:40.869444, lng:-73.915279, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'108', name:'207 St',                          borough:'Manhattan', routes:['1'],                        lat:40.864621, lng:-73.918822, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'109', name:'Dyckman St (1)',                  borough:'Manhattan', routes:['1'],                        lat:40.860531, lng:-73.925536, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'110', name:'191 St',                          borough:'Manhattan', routes:['1'],                        lat:40.855225, lng:-73.929412, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'111', name:'181 St (1)',                      borough:'Manhattan', routes:['1'],                        lat:40.849505, lng:-73.933596, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'112', name:'168 St–Washington Hts',           borough:'Manhattan', routes:['1','A','C'],                lat:40.840556, lng:-73.939892, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'113', name:'157 St',                          borough:'Manhattan', routes:['1'],                        lat:40.834963, lng:-73.944216, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'114', name:'145 St (1)',                      borough:'Manhattan', routes:['1'],                        lat:40.829471, lng:-73.947806, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'115', name:'137 St–City College',             borough:'Manhattan', routes:['1'],                        lat:40.822008, lng:-73.953676, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'116', name:'125 St (1)',                      borough:'Manhattan', routes:['1'],                        lat:40.815581, lng:-73.958372, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'117', name:'116 St–Columbia University',      borough:'Manhattan', routes:['1'],                        lat:40.811109, lng:-73.960810, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'118', name:'Cathedral Pkwy–110 St (1)',       borough:'Manhattan', routes:['1'],                        lat:40.803967, lng:-73.966013, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'119', name:'103 St (1)',                      borough:'Manhattan', routes:['1'],                        lat:40.799446, lng:-73.968386, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'120', name:'96 St (1/2/3)',                   borough:'Manhattan', routes:['1','2','3'],                lat:40.793919, lng:-73.972323, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'121', name:'86 St (1)',                       borough:'Manhattan', routes:['1'],                        lat:40.788644, lng:-73.976218, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'122', name:'79 St',                           borough:'Manhattan', routes:['1'],                        lat:40.783934, lng:-73.979472, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'123', name:'72 St (1/2/3)',                   borough:'Manhattan', routes:['1','2','3'],                lat:40.778453, lng:-73.982209, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'124', name:'66 St–Lincoln Center',            borough:'Manhattan', routes:['1'],                        lat:40.774498, lng:-73.983849, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'125', name:'59 St–Columbus Circle',           borough:'Manhattan', routes:['1','A','B','C','D'],        lat:40.768247, lng:-73.981929, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'126', name:'50 St (1)',                       borough:'Manhattan', routes:['1'],                        lat:40.761728, lng:-73.983849, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'127', name:'Times Sq–42 St',                  borough:'Manhattan', routes:['1','2','3','7','N','Q','R','W','A','C','E'], lat:40.755983, lng:-73.987606, northLabel:'Uptown', southLabel:'Downtown' },
  { id:'128', name:'34 St–Penn Station (1/2/3)',      borough:'Manhattan', routes:['1','2','3'],                lat:40.750373, lng:-73.991057, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'129', name:'28 St (1)',                       borough:'Manhattan', routes:['1'],                        lat:40.747228, lng:-73.993989, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'130', name:'23 St (1)',                       borough:'Manhattan', routes:['1'],                        lat:40.744549, lng:-73.995955, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'131', name:'18 St',                           borough:'Manhattan', routes:['1'],                        lat:40.741323, lng:-73.997954, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'132', name:'14 St (1/2/3)',                   borough:'Manhattan', routes:['1','2','3'],                lat:40.737826, lng:-74.000201, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'133', name:'Christopher St–Sheridan Sq',      borough:'Manhattan', routes:['1'],                        lat:40.733422, lng:-74.002906, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'134', name:'Houston St',                      borough:'Manhattan', routes:['1'],                        lat:40.728251, lng:-74.005367, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'135', name:'Canal St (1)',                    borough:'Manhattan', routes:['1'],                        lat:40.722585, lng:-74.006277, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'136', name:'Franklin St',                     borough:'Manhattan', routes:['1'],                        lat:40.719053, lng:-74.008756, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'137', name:'Chambers St (1/2/3)',             borough:'Manhattan', routes:['1','2','3'],                lat:40.715478, lng:-74.009266, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'138', name:'Cortlandt St–WTC',                borough:'Manhattan', routes:['1'],                        lat:40.711835, lng:-74.012188, northLabel:'Uptown',              southLabel:'South Ferry' },
  { id:'139', name:'Rector St (1)',                   borough:'Manhattan', routes:['1'],                        lat:40.707557, lng:-74.013585, northLabel:'Uptown',              southLabel:'South Ferry' },
  { id:'142', name:'South Ferry',                     borough:'Manhattan', routes:['1'],                        lat:40.702068, lng:-74.013664, northLabel:'Uptown',              southLabel:'' },
  // ── 2/3 Bronx ──
  { id:'201', name:'Wakefield–241 St',                borough:'Bronx',     routes:['2'],                        lat:40.903125, lng:-73.850620, northLabel:'',                    southLabel:'Manhattan' },
  { id:'204', name:'Nereid Av',                       borough:'Bronx',     routes:['2'],                        lat:40.898379, lng:-73.854997, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'205', name:'233 St',                          borough:'Bronx',     routes:['2'],                        lat:40.893193, lng:-73.857473, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'206', name:'225 St',                          borough:'Bronx',     routes:['2'],                        lat:40.888022, lng:-73.860341, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'207', name:'219 St',                          borough:'Bronx',     routes:['2'],                        lat:40.883895, lng:-73.862633, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'208', name:'Gun Hill Rd (2)',                 borough:'Bronx',     routes:['2'],                        lat:40.877850, lng:-73.866862, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'209', name:'Burke Av',                        borough:'Bronx',     routes:['2'],                        lat:40.871356, lng:-73.870634, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'210', name:'Allerton Av',                     borough:'Bronx',     routes:['2'],                        lat:40.865462, lng:-73.873629, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'211', name:'Pelham Pkwy (2)',                 borough:'Bronx',     routes:['2'],                        lat:40.857192, lng:-73.879501, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'212', name:'Bronx Park East',                 borough:'Bronx',     routes:['2'],                        lat:40.851695, lng:-73.882767, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'213', name:'E Tremont Av',                    borough:'Bronx',     routes:['2'],                        lat:40.846807, lng:-73.886349, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'214', name:'W Farms Sq–E Tremont Av',         borough:'Bronx',     routes:['2'],                        lat:40.840295, lng:-73.891394, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'215', name:'Simpson St',                      borough:'Bronx',     routes:['2'],                        lat:40.836488, lng:-73.893614, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'216', name:'Intervale Av',                    borough:'Bronx',     routes:['2'],                        lat:40.832601, lng:-73.896736, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'217', name:'Prospect Av (2)',                 borough:'Bronx',     routes:['2'],                        lat:40.828938, lng:-73.900571, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'218', name:'Jackson Av',                      borough:'Bronx',     routes:['2'],                        lat:40.825804, lng:-73.903539, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'219', name:'3 Av–149 St',                     borough:'Bronx',     routes:['2'],                        lat:40.816761, lng:-73.917749, northLabel:'Wakefield',           southLabel:'Manhattan' },
  { id:'220', name:'149 St–Grand Concourse',          borough:'Bronx',     routes:['2','4','5'],                lat:40.818435, lng:-73.927351, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'221', name:'135 St (2/3)',                    borough:'Manhattan', routes:['2','3'],                    lat:40.816340, lng:-73.947649, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'222', name:'125 St (2/3)',                    borough:'Manhattan', routes:['2','3'],                    lat:40.811739, lng:-73.952768, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'224', name:'110 St (2/3)',                    borough:'Manhattan', routes:['2','3'],                    lat:40.802098, lng:-73.961995, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'225', name:'Central Park North–110 St',       borough:'Manhattan', routes:['2','3'],                    lat:40.799484, lng:-73.955827, northLabel:'Uptown',              southLabel:'Downtown' },
  // ── 4/5/6 ──
  { id:'401', name:'Woodlawn',                        borough:'Bronx',     routes:['4'],                        lat:40.886037, lng:-73.878750, northLabel:'',                    southLabel:'Manhattan' },
  { id:'402', name:'Mosholu Pkwy',                    borough:'Bronx',     routes:['4'],                        lat:40.880476, lng:-73.882923, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'405', name:'Bedford Park Blvd–Lehman College',borough:'Bronx',     routes:['4'],                        lat:40.873412, lng:-73.887734, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'406', name:'Kingsbridge Rd (4)',              borough:'Bronx',     routes:['4'],                        lat:40.866897, lng:-73.893509, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'407', name:'Fordham Rd (4)',                  borough:'Bronx',     routes:['4'],                        lat:40.860543, lng:-73.897174, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'408', name:'183 St',                          borough:'Bronx',     routes:['4'],                        lat:40.858009, lng:-73.901031, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'409', name:'Burnside Av',                     borough:'Bronx',     routes:['4'],                        lat:40.853662, lng:-73.904834, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'410', name:'176 St',                          borough:'Bronx',     routes:['4'],                        lat:40.848970, lng:-73.909314, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'411', name:'Mt Eden Av',                      borough:'Bronx',     routes:['4'],                        lat:40.844434, lng:-73.912620, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'412', name:'170 St (4)',                      borough:'Bronx',     routes:['4'],                        lat:40.840295, lng:-73.916559, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'413', name:'167 St (4)',                      borough:'Bronx',     routes:['4'],                        lat:40.835488, lng:-73.919950, northLabel:'Woodlawn',            southLabel:'Manhattan' },
  { id:'414', name:'161 St–Yankee Stadium',           borough:'Bronx',     routes:['4','B','D'],                lat:40.827905, lng:-73.925651, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'415', name:'149 St–Grand Concourse (4)',      borough:'Bronx',     routes:['4'],                        lat:40.818435, lng:-73.927351, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'416', name:'138 St–Grand Concourse',          borough:'Bronx',     routes:['4','5'],                    lat:40.813224, lng:-73.929849, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'418', name:'125 St (4/5/6)',                  borough:'Manhattan', routes:['4','5','6'],                lat:40.804138, lng:-73.937594, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'419', name:'86 St (4/5/6)',                   borough:'Manhattan', routes:['4','5','6'],                lat:40.777492, lng:-73.951418, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'420', name:'77 St',                           borough:'Manhattan', routes:['4','5','6'],                lat:40.773604, lng:-73.957119, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'421', name:'68 St–Hunter College',            borough:'Manhattan', routes:['4','5','6'],                lat:40.768141, lng:-73.964019, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'422', name:'59 St (4/5/6)',                   borough:'Manhattan', routes:['4','5','6'],                lat:40.762526, lng:-73.967967, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'423', name:'51 St',                           borough:'Manhattan', routes:['4','5','6'],                lat:40.757107, lng:-73.971920, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'424', name:'Grand Central–42 St',             borough:'Manhattan', routes:['4','5','6','7'],            lat:40.751776, lng:-73.976848, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'425', name:'33 St (4/5/6)',                   borough:'Manhattan', routes:['4','5','6'],                lat:40.746418, lng:-73.980795, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'426', name:'28 St (4/5/6)',                   borough:'Manhattan', routes:['4','5','6'],                lat:40.743292, lng:-73.983765, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'427', name:'23 St (4/5/6)',                   borough:'Manhattan', routes:['4','5','6'],                lat:40.739864, lng:-73.986599, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'428', name:'14 St–Union Sq',                  borough:'Manhattan', routes:['4','5','6','L','N','Q','R','W'], lat:40.734673, lng:-73.989951, northLabel:'Uptown',         southLabel:'Downtown' },
  { id:'429', name:'Astor Pl',                        borough:'Manhattan', routes:['4','5','6'],                lat:40.730054, lng:-73.991057, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'430', name:'Bleecker St',                     borough:'Manhattan', routes:['4','5','6'],                lat:40.725915, lng:-73.994659, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'431', name:'Spring St (4/5/6)',               borough:'Manhattan', routes:['4','5','6'],                lat:40.722301, lng:-73.997141, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'432', name:'Canal St (4/5/6)',                borough:'Manhattan', routes:['4','5','6'],                lat:40.718803, lng:-74.000193, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'433', name:'Brooklyn Bridge–City Hall',       borough:'Manhattan', routes:['4','5','6'],                lat:40.713244, lng:-74.004099, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'501', name:'Eastchester–Dyre Av',             borough:'Bronx',     routes:['5'],                        lat:40.888022, lng:-73.828135, northLabel:'',                    southLabel:'Manhattan' },
  { id:'502', name:'Baychester Av',                   borough:'Bronx',     routes:['5'],                        lat:40.878663, lng:-73.833493, northLabel:'Eastchester',         southLabel:'Manhattan' },
  { id:'503', name:'Gun Hill Rd (5)',                 borough:'Bronx',     routes:['5'],                        lat:40.877850, lng:-73.866862, northLabel:'Eastchester',         southLabel:'Manhattan' },
  { id:'504', name:'Pelham Pkwy (5)',                 borough:'Bronx',     routes:['5'],                        lat:40.857192, lng:-73.879501, northLabel:'Eastchester',         southLabel:'Manhattan' },
  { id:'505', name:'Morris Park',                     borough:'Bronx',     routes:['5'],                        lat:40.854780, lng:-73.855620, northLabel:'Eastchester',         southLabel:'Manhattan' },
  { id:'601', name:'Pelham Bay Park',                 borough:'Bronx',     routes:['6'],                        lat:40.852462, lng:-73.828121, northLabel:'',                    southLabel:'Manhattan' },
  { id:'602', name:'Buhre Av',                        borough:'Bronx',     routes:['6'],                        lat:40.846807, lng:-73.832089, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'603', name:'Middletown Rd',                   borough:'Bronx',     routes:['6'],                        lat:40.843962, lng:-73.836910, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'604', name:'Westchester Sq–E Tremont Av',     borough:'Bronx',     routes:['6'],                        lat:40.839892, lng:-73.842952, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'606', name:'Zerega Av',                       borough:'Bronx',     routes:['6'],                        lat:40.836488, lng:-73.847036, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'607', name:'Castle Hill Av',                  borough:'Bronx',     routes:['6'],                        lat:40.834255, lng:-73.851753, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'608', name:'Parkchester',                     borough:'Bronx',     routes:['6'],                        lat:40.833226, lng:-73.860816, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'609', name:'St Lawrence Av',                  borough:'Bronx',     routes:['6'],                        lat:40.831509, lng:-73.867547, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'610', name:'Morrison Av–Soundview',           borough:'Bronx',     routes:['6'],                        lat:40.829521, lng:-73.874085, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'611', name:'Elder Av',                        borough:'Bronx',     routes:['6'],                        lat:40.828022, lng:-73.879501, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'612', name:'Whitlock Av',                     borough:'Bronx',     routes:['6'],                        lat:40.826994, lng:-73.886349, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'613', name:'Hunts Point Av',                  borough:'Bronx',     routes:['6'],                        lat:40.820948, lng:-73.890358, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'614', name:'Longwood Av',                     borough:'Bronx',     routes:['6'],                        lat:40.816761, lng:-73.896488, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'615', name:'E 149 St',                        borough:'Bronx',     routes:['6'],                        lat:40.812618, lng:-73.904834, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'616', name:"E 143 St–St Mary's St",           borough:'Bronx',     routes:['6'],                        lat:40.808719, lng:-73.907807, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'617', name:'Cypress Av',                      borough:'Bronx',     routes:['6'],                        lat:40.805699, lng:-73.912527, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'618', name:'Brook Av',                        borough:'Bronx',     routes:['6'],                        lat:40.802098, lng:-73.919318, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  { id:'619', name:'3 Av–138 St',                     borough:'Bronx',     routes:['6'],                        lat:40.800653, lng:-73.925651, northLabel:'Pelham Bay',          southLabel:'Manhattan' },
  // ── 7 train ──
  { id:'701', name:'Flushing–Main St',                borough:'Queens',    routes:['7'],                        lat:40.759600, lng:-73.830030, northLabel:'',                    southLabel:'Manhattan' },
  { id:'702', name:'Mets–Willets Point',              borough:'Queens',    routes:['7'],                        lat:40.754622, lng:-73.845836, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'705', name:'Junction Blvd',                   borough:'Queens',    routes:['7'],                        lat:40.749719, lng:-73.869527, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'706', name:'90 St–Elmhurst Av',               borough:'Queens',    routes:['7'],                        lat:40.748397, lng:-73.878030, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'707', name:'82 St–Jackson Hts',               borough:'Queens',    routes:['7'],                        lat:40.747659, lng:-73.883590, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'708', name:'74 St–Broadway',                  borough:'Queens',    routes:['7'],                        lat:40.746940, lng:-73.891394, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'709', name:'69 St',                           borough:'Queens',    routes:['7'],                        lat:40.746154, lng:-73.896808, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'710', name:'61 St–Woodside',                  borough:'Queens',    routes:['7'],                        lat:40.745494, lng:-73.904834, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'711', name:'52 St',                           borough:'Queens',    routes:['7'],                        lat:40.744149, lng:-73.912527, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'712', name:'46 St (7)',                       borough:'Queens',    routes:['7'],                        lat:40.743132, lng:-73.919318, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'713', name:'40 St',                           borough:'Queens',    routes:['7'],                        lat:40.742582, lng:-73.925651, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'714', name:'33 St–Rawson St',                 borough:'Queens',    routes:['7'],                        lat:40.742626, lng:-73.933596, northLabel:'Flushing',            southLabel:'Manhattan' },
  { id:'715', name:'Queensboro Plaza',                borough:'Queens',    routes:['7','N','W'],                lat:40.750779, lng:-73.940154, northLabel:'Flushing',            southLabel:'Manhattan', extraStopIds:['N08'] },
  { id:'716', name:'Court Sq (7)',                    borough:'Queens',    routes:['7','E','M','G'],            lat:40.747846, lng:-73.945950, northLabel:'Flushing',            southLabel:'Manhattan' },
  // ── A/C/E ──
  { id:'A02', name:'Inwood–207 St',                   borough:'Manhattan', routes:['A'],                        lat:40.868072, lng:-73.921479, northLabel:'',                    southLabel:'Downtown' },
  { id:'A03', name:'Dyckman St (A)',                  borough:'Manhattan', routes:['A'],                        lat:40.860476, lng:-73.927351, northLabel:'Inwood',              southLabel:'Downtown' },
  { id:'A05', name:'190 St',                          borough:'Manhattan', routes:['A'],                        lat:40.856718, lng:-73.929412, northLabel:'Inwood',              southLabel:'Downtown' },
  { id:'A06', name:'181 St (A)',                      borough:'Manhattan', routes:['A'],                        lat:40.851695, lng:-73.933596, northLabel:'Inwood',              southLabel:'Downtown' },
  { id:'A07', name:'175 St',                          borough:'Manhattan', routes:['A'],                        lat:40.847391, lng:-73.939026, northLabel:'Inwood',              southLabel:'Downtown' },
  { id:'A09', name:'168 St (A/C/1)',                  borough:'Manhattan', routes:['A','C','1'],                lat:40.840556, lng:-73.939892, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A10', name:'163 St–Amsterdam Av',             borough:'Manhattan', routes:['C'],                        lat:40.836013, lng:-73.941916, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A11', name:'155 St (C)',                      borough:'Manhattan', routes:['C'],                        lat:40.830476, lng:-73.944809, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A12', name:'145 St (A/C)',                    borough:'Manhattan', routes:['A','C'],                    lat:40.824783, lng:-73.944809, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A14', name:'135 St (A/C)',                    borough:'Manhattan', routes:['A','C'],                    lat:40.817765, lng:-73.947649, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A15', name:'125 St (A/B/C/D)',                borough:'Manhattan', routes:['A','B','C','D'],            lat:40.815581, lng:-73.958372, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A16', name:'116 St (C)',                      borough:'Manhattan', routes:['C'],                        lat:40.810476, lng:-73.961995, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A17', name:'Cathedral Pkwy–110 St (C)',       borough:'Manhattan', routes:['C'],                        lat:40.803967, lng:-73.966013, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A18', name:'103 St (C)',                      borough:'Manhattan', routes:['C'],                        lat:40.799446, lng:-73.968386, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A19', name:'96 St (C)',                       borough:'Manhattan', routes:['C'],                        lat:40.793919, lng:-73.972323, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A20', name:'86 St (C)',                       borough:'Manhattan', routes:['C'],                        lat:40.788644, lng:-73.976218, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A21', name:'81 St–Museum of Natural History', borough:'Manhattan', routes:['C'],                        lat:40.781740, lng:-73.979472, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A22', name:'72 St (C)',                       borough:'Manhattan', routes:['C'],                        lat:40.778453, lng:-73.982209, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A24', name:'50 St (C/E)',                     borough:'Manhattan', routes:['C','E'],                    lat:40.761728, lng:-73.983849, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A25', name:'34 St–Penn Station (A/C/E)',      borough:'Manhattan', routes:['A','C','E'],                lat:40.750373, lng:-73.991057, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A27', name:'23 St (C/E)',                     borough:'Manhattan', routes:['C','E'],                    lat:40.744549, lng:-73.995955, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A28', name:'14 St (A/C/E)',                   borough:'Manhattan', routes:['A','C','E'],                lat:40.737826, lng:-74.000201, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A30', name:'Spring St (C/E)',                 borough:'Manhattan', routes:['C','E'],                    lat:40.726391, lng:-74.003849, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A31', name:'Canal St (A/C/E)',                borough:'Manhattan', routes:['A','C','E'],                lat:40.720824, lng:-74.005229, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A32', name:'Chambers St (A/C)',               borough:'Manhattan', routes:['A','C'],                    lat:40.713282, lng:-74.008919, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A33', name:'Fulton St',                       borough:'Manhattan', routes:['A','C','2','3','4','5'],    lat:40.710374, lng:-74.007582, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'A34', name:'Howard Beach–JFK Airport',        borough:'Queens',    routes:['A'],                        lat:40.660476, lng:-73.830708, northLabel:'Far Rockaway',        southLabel:'Manhattan' },
  { id:'A36', name:'Broad Channel',                   borough:'Queens',    routes:['A'],                        lat:40.608515, lng:-73.815925, northLabel:'Lefferts',            southLabel:'Rockaway' },
  { id:'A38', name:'Far Rockaway–Mott Av',            borough:'Queens',    routes:['A'],                        lat:40.603995, lng:-73.755405, northLabel:'',                    southLabel:'Manhattan' },
  { id:'A41', name:'Ozone Park–Lefferts Blvd',        borough:'Queens',    routes:['A'],                        lat:40.685951, lng:-73.825798, northLabel:'',                    southLabel:'Manhattan' },
  { id:'A42', name:'Rockaway Blvd',                   borough:'Queens',    routes:['A'],                        lat:40.678024, lng:-73.832089, northLabel:'Lefferts',            southLabel:'Manhattan' },
  { id:'A43', name:'88 St',                           borough:'Queens',    routes:['A'],                        lat:40.670847, lng:-73.838900, northLabel:'Lefferts',            southLabel:'Manhattan' },
  { id:'A44', name:'80 St',                           borough:'Queens',    routes:['A'],                        lat:40.662614, lng:-73.845836, northLabel:'Lefferts',            southLabel:'Manhattan' },
  { id:'A46', name:'Aqueduct–N Conduit Av',           borough:'Queens',    routes:['A'],                        lat:40.668172, lng:-73.834890, northLabel:'Lefferts',            southLabel:'Manhattan' },
  { id:'A47', name:'Aqueduct Racetrack',              borough:'Queens',    routes:['A'],                        lat:40.672097, lng:-73.834890, northLabel:'Lefferts',            southLabel:'Manhattan' },
  { id:'A48', name:'Rockaway Park–Beach 116 St',      borough:'Queens',    routes:['A'],                        lat:40.580903, lng:-73.835592, northLabel:'',                    southLabel:'Manhattan' },
  { id:'A49', name:'Beach 105 St',                    borough:'Queens',    routes:['A'],                        lat:40.584622, lng:-73.847036, northLabel:'Rockaway Park',       southLabel:'Manhattan' },
  { id:'A50', name:'Beach 98 St',                     borough:'Queens',    routes:['A'],                        lat:40.585307, lng:-73.856544, northLabel:'Rockaway Park',       southLabel:'Manhattan' },
  { id:'A51', name:'Beach 90 St',                     borough:'Queens',    routes:['A'],                        lat:40.588639, lng:-73.864792, northLabel:'Rockaway Park',       southLabel:'Manhattan' },
  { id:'A52', name:'Beach 67 St',                     borough:'Queens',    routes:['A'],                        lat:40.589706, lng:-73.890358, northLabel:'Rockaway Park',       southLabel:'Manhattan' },
  { id:'A53', name:'Beach 60 St',                     borough:'Queens',    routes:['A'],                        lat:40.592374, lng:-73.897645, northLabel:'Rockaway Park',       southLabel:'Manhattan' },
  // ── B/D ──
  { id:'D01', name:'Norwood–205 St',                  borough:'Bronx',     routes:['D'],                        lat:40.874561, lng:-73.878750, northLabel:'',                    southLabel:'Manhattan' },
  { id:'D03', name:'Bedford Park Blvd (B/D)',         borough:'Bronx',     routes:['B','D'],                    lat:40.873412, lng:-73.887734, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D04', name:'Kingsbridge Rd (B/D)',            borough:'Bronx',     routes:['B','D'],                    lat:40.866897, lng:-73.893509, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D05', name:'Fordham Rd (B/D)',                borough:'Bronx',     routes:['B','D'],                    lat:40.860543, lng:-73.897174, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D06', name:'182–183 Sts',                     borough:'Bronx',     routes:['B','D'],                    lat:40.857840, lng:-73.901548, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D07', name:'Tremont Av',                      borough:'Bronx',     routes:['B','D'],                    lat:40.850302, lng:-73.904834, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D08', name:'174–175 Sts',                     borough:'Bronx',     routes:['B','D'],                    lat:40.847433, lng:-73.908991, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D09', name:'170 St (B/D)',                    borough:'Bronx',     routes:['B','D'],                    lat:40.840295, lng:-73.916559, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D10', name:'167 St (B/D)',                    borough:'Bronx',     routes:['B','D'],                    lat:40.835488, lng:-73.919950, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D11', name:'161 St–Yankee Stadium (B/D)',     borough:'Bronx',     routes:['B','D','4'],                lat:40.827905, lng:-73.925651, northLabel:'Norwood',             southLabel:'Manhattan' },
  { id:'D12', name:'155 St (B/D)',                    borough:'Manhattan', routes:['B','D'],                    lat:40.830476, lng:-73.944809, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D13', name:'145 St (B/D)',                    borough:'Manhattan', routes:['B','D'],                    lat:40.824783, lng:-73.944809, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D14', name:'135 St (B/D)',                    borough:'Manhattan', routes:['B','D'],                    lat:40.817765, lng:-73.947649, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D16', name:'116 St (B/D)',                    borough:'Manhattan', routes:['B','D'],                    lat:40.810476, lng:-73.961995, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D17', name:'110 St (B/D)',                    borough:'Manhattan', routes:['B','D'],                    lat:40.803967, lng:-73.966013, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D18', name:'103 St (B)',                      borough:'Manhattan', routes:['B'],                        lat:40.799446, lng:-73.968386, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D19', name:'96 St (B)',                       borough:'Manhattan', routes:['B'],                        lat:40.793919, lng:-73.972323, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D20', name:'86 St (B)',                       borough:'Manhattan', routes:['B'],                        lat:40.788644, lng:-73.976218, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D21', name:'81 St–Museum of Natural History (B)', borough:'Manhattan', routes:['B'],                   lat:40.781740, lng:-73.979472, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D22', name:'72 St (B)',                       borough:'Manhattan', routes:['B'],                        lat:40.778453, lng:-73.982209, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D26', name:'34 St–Herald Sq',                 borough:'Manhattan', routes:['B','D','F','M','N','Q','R','W'], lat:40.749567, lng:-73.987823, northLabel:'Uptown',        southLabel:'Downtown' },
  { id:'D27', name:'23 St (F/M)',                     borough:'Manhattan', routes:['F','M'],                    lat:40.742878, lng:-73.992821, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D28', name:'14 St (F/M)',                     borough:'Manhattan', routes:['F','M'],                    lat:40.738228, lng:-73.996209, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D29', name:'W 4 St–Washington Sq',            borough:'Manhattan', routes:['A','B','C','D','E','F','M'], lat:40.732338, lng:-74.000495, northLabel:'Uptown',             southLabel:'Downtown' },
  { id:'D30', name:'Broadway–Lafayette St',           borough:'Manhattan', routes:['B','D','F','M'],            lat:40.725297, lng:-73.996209, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'D31', name:'Grand St (B/D)',                  borough:'Manhattan', routes:['B','D'],                    lat:40.718803, lng:-73.993765, northLabel:'Uptown',              southLabel:'Downtown' },
  // ── Brooklyn B/D/N/Q ──
  { id:'B04', name:'Coney Island–Stillwell Av',       borough:'Brooklyn',  routes:['D','F','N','Q'],            lat:40.577422, lng:-73.981233, northLabel:'Manhattan',           southLabel:'' },
  { id:'B06', name:'W 8 St–NY Aquarium',              borough:'Brooklyn',  routes:['F','Q'],                    lat:40.576127, lng:-73.975939, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'B08', name:'Brighton Beach',                  borough:'Brooklyn',  routes:['B','Q'],                    lat:40.577260, lng:-73.961656, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'B10', name:'Ocean Pkwy',                      borough:'Brooklyn',  routes:['B','Q'],                    lat:40.576127, lng:-73.968512, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B12', name:'Kings Hwy (B/Q)',                 borough:'Brooklyn',  routes:['B','Q'],                    lat:40.582829, lng:-73.974048, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B13', name:'Beverley Rd',                     borough:'Brooklyn',  routes:['B','Q'],                    lat:40.589824, lng:-73.979265, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B14', name:'Cortelyou Rd',                    borough:'Brooklyn',  routes:['B','Q'],                    lat:40.596696, lng:-73.981199, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B15', name:'Newkirk Av',                      borough:'Brooklyn',  routes:['B','Q'],                    lat:40.604556, lng:-73.981520, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B16', name:'Church Av (B/Q)',                 borough:'Brooklyn',  routes:['B','Q'],                    lat:40.612566, lng:-73.980305, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B17', name:'Parkside Av',                     borough:'Brooklyn',  routes:['B','Q'],                    lat:40.620358, lng:-73.980305, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B18', name:'Prospect Park (B/Q)',             borough:'Brooklyn',  routes:['B','Q'],                    lat:40.630614, lng:-73.962456, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B19', name:'7 Av (B/Q)',                      borough:'Brooklyn',  routes:['B','Q'],                    lat:40.645386, lng:-73.979189, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B20', name:'Grand Army Plaza',                borough:'Brooklyn',  routes:['B','Q'],                    lat:40.660614, lng:-73.970385, northLabel:'Manhattan',           southLabel:'Brighton Beach' },
  { id:'B22', name:'Atlantic Av–Barclays Ctr',        borough:'Brooklyn',  routes:['B','D','N','Q','R','2','3','4','5'], lat:40.684358, lng:-73.977666, northLabel:'Manhattan',  southLabel:'Brooklyn' },
  // ── E/F/M/R Queens Blvd ──
  { id:'F09', name:'Court Sq–23 St',                  borough:'Queens',    routes:['E','M','G'],                lat:40.747846, lng:-73.945950, northLabel:'Queens',              southLabel:'Manhattan' },
  { id:'F11', name:'Lexington Av/53 St',              borough:'Manhattan', routes:['E','M'],                    lat:40.757552, lng:-73.969055, northLabel:'Queens',              southLabel:'Downtown' },
  { id:'F12', name:'5 Av/53 St',                      borough:'Manhattan', routes:['E','M'],                    lat:40.760167, lng:-73.975224, northLabel:'Queens',              southLabel:'Downtown' },
  { id:'F14', name:'Jamaica–179 St',                  borough:'Queens',    routes:['F'],                        lat:40.712646, lng:-73.783817, northLabel:'',                    southLabel:'Manhattan' },
  { id:'F15', name:'169 St',                          borough:'Queens',    routes:['F'],                        lat:40.717581, lng:-73.791617, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F16', name:'Parsons Blvd',                    borough:'Queens',    routes:['F'],                        lat:40.723402, lng:-73.796006, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F18', name:'Sutphin Blvd (F)',                borough:'Queens',    routes:['F'],                        lat:40.730170, lng:-73.800188, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F20', name:'Briarwood',                       borough:'Queens',    routes:['E','F'],                    lat:40.709620, lng:-73.820558, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F21', name:'Kew Gardens–Union Tpke',          borough:'Queens',    routes:['E','F'],                    lat:40.714554, lng:-73.831550, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F22', name:'75 Av',                           borough:'Queens',    routes:['F','M'],                    lat:40.718331, lng:-73.837594, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F23', name:'Forest Hills–71 Av',              borough:'Queens',    routes:['E','F','M','R'],            lat:40.721691, lng:-73.844521, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F24', name:'67 Av',                           borough:'Queens',    routes:['F','M','R'],                lat:40.726551, lng:-73.852042, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'F25', name:'63 Dr–Rego Park',                 borough:'Queens',    routes:['M','R'],                    lat:40.729846, lng:-73.861604, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'F26', name:'Woodhaven Blvd (M/R)',            borough:'Queens',    routes:['M','R'],                    lat:40.733106, lng:-73.869229, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'F27', name:'Grand Av–Newtown',                borough:'Queens',    routes:['M','R'],                    lat:40.737015, lng:-73.877223, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'F29', name:'Elmhurst Av',                     borough:'Queens',    routes:['M','R'],                    lat:40.742454, lng:-73.882017, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'G08', name:'Jamaica Center–Parsons/Archer',   borough:'Queens',    routes:['E','J','Z'],                lat:40.702566, lng:-73.801109, northLabel:'',                    southLabel:'Manhattan' },
  { id:'G14', name:'Jackson Hts–Roosevelt Av',        borough:'Queens',    routes:['E','F','M','R'],            lat:40.746644, lng:-73.891338, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'G16', name:'Northern Blvd',                   borough:'Queens',    routes:['M','R'],                    lat:40.752885, lng:-73.906006, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'G18', name:'46 St (M/R)',                     borough:'Queens',    routes:['M','R'],                    lat:40.756312, lng:-73.913333, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'G19', name:'Steinway St',                     borough:'Queens',    routes:['M','R'],                    lat:40.756879, lng:-73.920740, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'G20', name:'36 St (M/R)',                     borough:'Queens',    routes:['M','R'],                    lat:40.752039, lng:-73.928781, northLabel:'Forest Hills',        southLabel:'Manhattan' },
  { id:'G21', name:'Queens Plaza',                    borough:'Queens',    routes:['E','F','R'],                lat:40.748973, lng:-73.937243, northLabel:'Forest Hills–Jamaica', southLabel:'Manhattan' },
  // ── G train ──
  { id:'G22', name:'Court Sq (G)',                    borough:'Queens',    routes:['G'],                        lat:40.747846, lng:-73.945950, northLabel:'',                    southLabel:'Church Av' },
  { id:'G26', name:'Greenpoint Av',                   borough:'Brooklyn',  routes:['G'],                        lat:40.731352, lng:-73.954449, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G28', name:'Nassau Av',                       borough:'Brooklyn',  routes:['G'],                        lat:40.724635, lng:-73.951277, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G29', name:'Metropolitan Av (G)',             borough:'Brooklyn',  routes:['G'],                        lat:40.713282, lng:-73.951277, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G30', name:'Broadway (G)',                    borough:'Brooklyn',  routes:['G'],                        lat:40.706607, lng:-73.950527, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G31', name:'Flushing Av (G)',                 borough:'Brooklyn',  routes:['G'],                        lat:40.700377, lng:-73.950527, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G32', name:'Myrtle–Willoughby Avs',           borough:'Brooklyn',  routes:['G'],                        lat:40.694568, lng:-73.949046, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G33', name:'Bedford–Nostrand Avs',            borough:'Brooklyn',  routes:['G'],                        lat:40.689627, lng:-73.953522, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G34', name:'Classon Av',                      borough:'Brooklyn',  routes:['G'],                        lat:40.688246, lng:-73.959893, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G35', name:'Clinton–Washington Avs',          borough:'Brooklyn',  routes:['G'],                        lat:40.688246, lng:-73.966270, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'G36', name:'Fulton St (G)',                   borough:'Brooklyn',  routes:['G'],                        lat:40.688246, lng:-73.975924, northLabel:'Court Sq',            southLabel:'Church Av' },
  { id:'F35', name:'Church Av (F/G)',                 borough:'Brooklyn',  routes:['F','G'],                    lat:40.644041, lng:-73.979493, northLabel:'Manhattan',           southLabel:'' },
  // ── J/Z ──
  { id:'J12', name:'Jamaica Center–Parsons/Archer (J/Z)', borough:'Queens', routes:['E','J','Z'],              lat:40.702566, lng:-73.801109, northLabel:'',                    southLabel:'Manhattan' },
  { id:'J15', name:'Sutphin Blvd–Archer Av–JFK',      borough:'Queens',    routes:['E','J','Z'],                lat:40.700377, lng:-73.808123, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J16', name:'121 St',                          borough:'Queens',    routes:['J','Z'],                    lat:40.700474, lng:-73.815925, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J17', name:'111 St',                          borough:'Queens',    routes:['J'],                        lat:40.699687, lng:-73.826760, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J19', name:'104 St',                          borough:'Queens',    routes:['J'],                        lat:40.699687, lng:-73.837594, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J20', name:'Woodhaven Blvd (J)',              borough:'Queens',    routes:['J'],                        lat:40.693865, lng:-73.851974, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J21', name:'85 St–Forest Pkwy',               borough:'Queens',    routes:['J'],                        lat:40.693865, lng:-73.860816, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J22', name:'75 St–Elderts Ln',                borough:'Queens',    routes:['J'],                        lat:40.691324, lng:-73.869527, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J23', name:'Cypress Hills',                   borough:'Brooklyn',  routes:['J'],                        lat:40.689627, lng:-73.878030, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J24', name:'Crescent St',                     borough:'Brooklyn',  routes:['J','Z'],                    lat:40.683814, lng:-73.873090, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J27', name:'Halsey St (J)',                   borough:'Brooklyn',  routes:['J'],                        lat:40.676992, lng:-73.904518, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J28', name:'Gates Av',                        borough:'Brooklyn',  routes:['J'],                        lat:40.676992, lng:-73.910808, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J29', name:'Kosciuszko St',                   borough:'Brooklyn',  routes:['J'],                        lat:40.676992, lng:-73.918561, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J30', name:'Myrtle Av (J/M/Z)',               borough:'Brooklyn',  routes:['J','M','Z'],                lat:40.697715, lng:-73.935657, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J31', name:'Flushing Av (J/M)',               borough:'Brooklyn',  routes:['J','M'],                    lat:40.700377, lng:-73.941528, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J32', name:'Marcy Av',                        borough:'Brooklyn',  routes:['J','M','Z'],                lat:40.708359, lng:-73.957619, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J33', name:'Hewes St',                        borough:'Brooklyn',  routes:['J','M'],                    lat:40.714553, lng:-73.953947, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J34', name:'Lorimer St (J/M)',                borough:'Brooklyn',  routes:['J','M'],                    lat:40.714553, lng:-73.947601, northLabel:'Jamaica',             southLabel:'Manhattan' },
  { id:'J37', name:'Essex St',                        borough:'Manhattan', routes:['J','M','Z'],                lat:40.718315, lng:-73.987423, northLabel:'Jamaica',             southLabel:'Brooklyn' },
  { id:'J38', name:'Bowery',                          borough:'Manhattan', routes:['J','Z'],                    lat:40.720124, lng:-73.993415, northLabel:'Jamaica',             southLabel:'Brooklyn' },
  { id:'J39', name:'Canal St (J/N/Q/R/W/Z)',         borough:'Manhattan', routes:['J','N','Q','R','W','Z'],    lat:40.718803, lng:-74.000193, northLabel:'Jamaica',             southLabel:'Brooklyn' },
  { id:'J41', name:'Chambers St (J/Z)',               borough:'Manhattan', routes:['J','Z'],                    lat:40.713282, lng:-74.008919, northLabel:'Jamaica',             southLabel:'Brooklyn' },
  { id:'J42', name:'Fulton St (J/Z)',                 borough:'Manhattan', routes:['J','Z'],                    lat:40.710374, lng:-74.007582, northLabel:'Jamaica',             southLabel:'Brooklyn' },
  // ── L train ──
  { id:'L01', name:'8 Av',                            borough:'Manhattan', routes:['L'],                        lat:40.739360, lng:-74.002535, northLabel:'',                    southLabel:'Canarsie' },
  { id:'L02', name:'6 Av (L)',                        borough:'Manhattan', routes:['L'],                        lat:40.738172, lng:-73.997870, northLabel:'8 Av',              southLabel:'Canarsie' },
  { id:'L03', name:'14 St–Union Sq (L)',              borough:'Manhattan', routes:['L','4','5','6','N','Q','R','W'], lat:40.734673, lng:-73.989951, northLabel:'8 Av',           southLabel:'Canarsie' },
  { id:'L05', name:'3 Av (L)',                        borough:'Manhattan', routes:['L'],                        lat:40.732849, lng:-73.986122, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L06', name:'1 Av',                            borough:'Manhattan', routes:['L'],                        lat:40.730953, lng:-73.981628, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L08', name:'Bedford Av',                      borough:'Brooklyn',  routes:['L'],                        lat:40.717304, lng:-73.956872, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L10', name:'Lorimer St (L)',                  borough:'Brooklyn',  routes:['L'],                        lat:40.714563, lng:-73.950456, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L11', name:'Graham Av',                       borough:'Brooklyn',  routes:['L'],                        lat:40.714563, lng:-73.944318, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L12', name:'Grand St (L)',                    borough:'Brooklyn',  routes:['L'],                        lat:40.711416, lng:-73.936006, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L13', name:'Montrose Av',                     borough:'Brooklyn',  routes:['L'],                        lat:40.707806, lng:-73.930958, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L14', name:'Morgan Av',                       borough:'Brooklyn',  routes:['L'],                        lat:40.706186, lng:-73.919752, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L15', name:'Jefferson St',                    borough:'Brooklyn',  routes:['L'],                        lat:40.706186, lng:-73.912821, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L16', name:'DeKalb Av (L)',                   borough:'Brooklyn',  routes:['L'],                        lat:40.703811, lng:-73.918850, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L17', name:'Myrtle–Wyckoff Avs',              borough:'Brooklyn',  routes:['L','M'],                    lat:40.699814, lng:-73.911145, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L19', name:'Halsey St (L)',                   borough:'Brooklyn',  routes:['L'],                        lat:40.695602, lng:-73.904518, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L20', name:'Wilson Av',                       borough:'Brooklyn',  routes:['L'],                        lat:40.689627, lng:-73.904518, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L21', name:'Bushwick Av–Aberdeen St',         borough:'Brooklyn',  routes:['L'],                        lat:40.683814, lng:-73.904518, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L22', name:'Broadway Junction',               borough:'Brooklyn',  routes:['A','C','J','L','Z'],        lat:40.678024, lng:-73.904518, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L25', name:'New Lots Av',                     borough:'Brooklyn',  routes:['L'],                        lat:40.660614, lng:-73.898926, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L26', name:'East 105 St',                     borough:'Brooklyn',  routes:['L'],                        lat:40.650074, lng:-73.899773, northLabel:'8 Av',               southLabel:'Canarsie' },
  { id:'L27', name:'Canarsie–Rockaway Pkwy',          borough:'Brooklyn',  routes:['L'],                        lat:40.646654, lng:-73.901447, northLabel:'8 Av',               southLabel:'' },
  // ── N/W Astoria ──
  { id:'N02', name:'Astoria–Ditmars Blvd',            borough:'Queens',    routes:['N','W'],                    lat:40.775036, lng:-73.912034, northLabel:'',                    southLabel:'Manhattan' },
  { id:'N03', name:'Astoria Blvd',                    borough:'Queens',    routes:['N','W'],                    lat:40.770258, lng:-73.917843, northLabel:'Ditmars Blvd',        southLabel:'Manhattan' },
  { id:'N04', name:'30 Av',                           borough:'Queens',    routes:['N','W'],                    lat:40.766779, lng:-73.921479, northLabel:'Ditmars Blvd',        southLabel:'Manhattan' },
  { id:'N05', name:'Broadway (N/W)',                  borough:'Queens',    routes:['N','W'],                    lat:40.761820, lng:-73.925508, northLabel:'Ditmars Blvd',        southLabel:'Manhattan' },
  { id:'N06', name:'36 Av',                           borough:'Queens',    routes:['N','W'],                    lat:40.756804, lng:-73.929575, northLabel:'Ditmars Blvd',        southLabel:'Manhattan' },
  { id:'N07', name:'39 Av–Dutch Kills',               borough:'Queens',    routes:['N','W'],                    lat:40.752882, lng:-73.932755, northLabel:'Ditmars Blvd',        southLabel:'Manhattan' },
  { id:'N09', name:'Lexington Av/59 St (N/R/W)',      borough:'Manhattan', routes:['N','R','W','4','5','6'],    lat:40.762526, lng:-73.967967, northLabel:'Queens',              southLabel:'Downtown' },
  { id:'N10', name:'5 Av/59 St',                      borough:'Manhattan', routes:['N','R','W'],                lat:40.764811, lng:-73.973347, northLabel:'Queens',              southLabel:'Downtown' },
  // ── Q ──
  { id:'Q01', name:'96 St (Q)',                       borough:'Manhattan', routes:['Q'],                        lat:40.793919, lng:-73.972323, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'Q03', name:'72 St (Q)',                       borough:'Manhattan', routes:['Q'],                        lat:40.778453, lng:-73.982209, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'Q04', name:'57 St–7 Av',                      borough:'Manhattan', routes:['N','Q','R','W'],            lat:40.764811, lng:-73.980492, northLabel:'Uptown',              southLabel:'Downtown' },
  { id:'Q05', name:'49 St',                           borough:'Manhattan', routes:['N','Q','R','W'],            lat:40.759861, lng:-73.984183, northLabel:'Uptown',              southLabel:'Downtown' },
  // ── R Manhattan/Brooklyn ──
  { id:'R11', name:'Lexington Av/59 St (R)',          borough:'Manhattan', routes:['N','R','W'],                lat:40.762526, lng:-73.967967, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R14', name:'57 St–7 Av (R)',                  borough:'Manhattan', routes:['N','Q','R','W'],            lat:40.764811, lng:-73.980492, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R15', name:'49 St (R)',                       borough:'Manhattan', routes:['N','Q','R','W'],            lat:40.759861, lng:-73.984183, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R16', name:'Times Sq–42 St (R)',              borough:'Manhattan', routes:['N','Q','R','W','1','2','3','7','A','C','E'], lat:40.755983, lng:-73.987606, northLabel:'Queens', southLabel:'Brooklyn' },
  { id:'R17', name:'34 St–Herald Sq (R)',             borough:'Manhattan', routes:['B','D','F','M','N','Q','R','W'], lat:40.749567, lng:-73.987823, northLabel:'Queens',        southLabel:'Brooklyn' },
  { id:'R18', name:'28 St (N/R/W)',                   borough:'Manhattan', routes:['N','R','W'],                lat:40.747228, lng:-73.993989, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R19', name:'23 St (N/R/W)',                   borough:'Manhattan', routes:['N','R','W'],                lat:40.744549, lng:-73.995955, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R20', name:'14 St–Union Sq (N/Q/R/W)',        borough:'Manhattan', routes:['N','Q','R','W','4','5','6','L'], lat:40.734673, lng:-73.989951, northLabel:'Queens',         southLabel:'Brooklyn' },
  { id:'R21', name:'8 St–NYU',                        borough:'Manhattan', routes:['N','R','W'],                lat:40.730054, lng:-73.991057, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R22', name:'Prince St',                       borough:'Manhattan', routes:['N','R','W'],                lat:40.724328, lng:-73.997683, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R23', name:'Canal St (N/Q/R/W)',              borough:'Manhattan', routes:['N','Q','R','W'],            lat:40.718803, lng:-74.000193, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R24', name:'City Hall (R)',                   borough:'Manhattan', routes:['N','R','W'],                lat:40.713282, lng:-74.008919, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R25', name:'Cortlandt St (R)',                borough:'Manhattan', routes:['N','R','W'],                lat:40.711835, lng:-74.012188, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R26', name:'Rector St (R)',                   borough:'Manhattan', routes:['N','R','W'],                lat:40.707557, lng:-74.013585, northLabel:'Queens',              southLabel:'Brooklyn' },
  { id:'R27', name:'Whitehall St–South Ferry',        borough:'Manhattan', routes:['N','R','W'],                lat:40.703087, lng:-74.013012, northLabel:'Queens',              southLabel:'' },
  { id:'R28', name:'Court St',                        borough:'Brooklyn',  routes:['R'],                        lat:40.694280, lng:-73.990862, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R29', name:'Jay St–MetroTech',                borough:'Brooklyn',  routes:['A','C','F','R'],            lat:40.692338, lng:-73.987342, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R30', name:'DeKalb Av (B/D/N/Q/R)',          borough:'Brooklyn',  routes:['B','D','N','Q','R'],        lat:40.690635, lng:-73.981533, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R31', name:'Atlantic Av–Barclays Ctr (R)',    borough:'Brooklyn',  routes:['B','D','N','Q','R','2','3','4','5'], lat:40.684358, lng:-73.977666, northLabel:'Manhattan', southLabel:'Bay Ridge' },
  { id:'R32', name:'Union St',                        borough:'Brooklyn',  routes:['R'],                        lat:40.677316, lng:-73.983112, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R33', name:'9 St (F/G/R)',                    borough:'Brooklyn',  routes:['F','G','R'],                lat:40.670847, lng:-73.988302, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R34', name:'4 Av–9 St',                       borough:'Brooklyn',  routes:['F','G','R'],                lat:40.670847, lng:-73.988302, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R36', name:'36 St (D/N/R)',                   borough:'Brooklyn',  routes:['D','N','R'],                lat:40.655144, lng:-74.003549, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R39', name:'45 St (R)',                       borough:'Brooklyn',  routes:['R'],                        lat:40.648621, lng:-74.010006, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R40', name:'53 St (R)',                       borough:'Brooklyn',  routes:['R'],                        lat:40.645069, lng:-74.014034, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R41', name:'59 St (N/R)',                     borough:'Brooklyn',  routes:['N','R'],                    lat:40.641362, lng:-74.017881, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R01', name:'Bay Ridge–95 St',                 borough:'Brooklyn',  routes:['R'],                        lat:40.616622, lng:-74.030876, northLabel:'Manhattan',           southLabel:'' },
  { id:'R03', name:'Bay Ridge Av',                    borough:'Brooklyn',  routes:['R'],                        lat:40.620816, lng:-74.027912, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R04', name:'77 St',                           borough:'Brooklyn',  routes:['R'],                        lat:40.629742, lng:-74.024159, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R05', name:'59 St (N/R Brooklyn)',            borough:'Brooklyn',  routes:['N','R'],                    lat:40.641362, lng:-74.017881, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R06', name:'53 St (R Brooklyn)',              borough:'Brooklyn',  routes:['R'],                        lat:40.645069, lng:-74.014034, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R08', name:'45 St (R Brooklyn)',              borough:'Brooklyn',  routes:['R'],                        lat:40.648621, lng:-74.010006, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  { id:'R09', name:'36 St (D/N/R Brooklyn)',          borough:'Brooklyn',  routes:['D','N','R'],                lat:40.655144, lng:-74.003549, northLabel:'Manhattan',           southLabel:'Bay Ridge' },
  // ── F Brooklyn ──
  { id:'F38', name:'Smith–9 Sts',                     borough:'Brooklyn',  routes:['F','G'],                    lat:40.673582, lng:-73.995959, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'F39', name:'4 Av–9 St (F/G)',                 borough:'Brooklyn',  routes:['F','G','R'],                lat:40.670847, lng:-73.988302, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'F40', name:'Carroll St',                      borough:'Brooklyn',  routes:['F','G'],                    lat:40.680829, lng:-73.994960, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'F41', name:'Bergen St',                       borough:'Brooklyn',  routes:['F','G'],                    lat:40.686130, lng:-73.990862, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'F42', name:'Jay St–MetroTech (F)',            borough:'Brooklyn',  routes:['A','C','F','R'],            lat:40.692338, lng:-73.987342, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'F43', name:'York St',                         borough:'Brooklyn',  routes:['F'],                        lat:40.701207, lng:-73.986954, northLabel:'Manhattan',           southLabel:'Coney Island' },
  { id:'F44', name:'E Broadway',                      borough:'Manhattan', routes:['F'],                        lat:40.714065, lng:-73.990414, northLabel:'Uptown',              southLabel:'Brooklyn' },
  { id:'F45', name:'Delancey St–Essex St',            borough:'Manhattan', routes:['F','J','M','Z'],            lat:40.718315, lng:-73.987423, northLabel:'Uptown',              southLabel:'Brooklyn' },
  { id:'F47', name:'2 Av',                            borough:'Manhattan', routes:['F'],                        lat:40.723402, lng:-73.989910, northLabel:'Uptown',              southLabel:'Brooklyn' },
  // ── Staten Island Railway ──
  { id:'S01', name:'St George',                       borough:'Staten Island', routes:['SI'],                   lat:40.643748, lng:-74.073643, northLabel:'',                    southLabel:'Tottenville' },
  { id:'S03', name:'Tompkinsville',                   borough:'Staten Island', routes:['SI'],                   lat:40.636798, lng:-74.074835, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S04', name:'Stapleton',                       borough:'Staten Island', routes:['SI'],                   lat:40.627915, lng:-74.075574, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S05', name:'Clifton',                         borough:'Staten Island', routes:['SI'],                   lat:40.622320, lng:-74.079384, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S06', name:'Grasmere',                        borough:'Staten Island', routes:['SI'],                   lat:40.603995, lng:-74.083831, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S07', name:'Old Town',                        borough:'Staten Island', routes:['SI'],                   lat:40.596570, lng:-74.085995, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S08', name:'Dongan Hills',                    borough:'Staten Island', routes:['SI'],                   lat:40.588484, lng:-74.085549, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S09', name:'Jefferson Av',                    borough:'Staten Island', routes:['SI'],                   lat:40.583591, lng:-74.083499, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S11', name:'Grant City',                      borough:'Staten Island', routes:['SI'],                   lat:40.575072, lng:-74.108090, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S13', name:'New Dorp',                        borough:'Staten Island', routes:['SI'],                   lat:40.573655, lng:-74.117618, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S14', name:'Oakwood Hts',                     borough:'Staten Island', routes:['SI'],                   lat:40.565684, lng:-74.122316, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S15', name:'Bay Terrace',                     borough:'Staten Island', routes:['SI'],                   lat:40.556192, lng:-74.130368, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S16', name:'Great Kills',                     borough:'Staten Island', routes:['SI'],                   lat:40.551360, lng:-74.150848, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S17', name:'Eltingville',                     borough:'Staten Island', routes:['SI'],                   lat:40.544540, lng:-74.165613, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S18', name:'Annadale',                        borough:'Staten Island', routes:['SI'],                   lat:40.540790, lng:-74.178149, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S19', name:'Huguenot',                        borough:'Staten Island', routes:['SI'],                   lat:40.534488, lng:-74.194170, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S20', name:"Prince's Bay",                    borough:'Staten Island', routes:['SI'],                   lat:40.524694, lng:-74.200760, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S21', name:'Pleasant Plains',                 borough:'Staten Island', routes:['SI'],                   lat:40.516946, lng:-74.213753, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S22', name:'Richmond Valley',                 borough:'Staten Island', routes:['SI'],                   lat:40.511485, lng:-74.224843, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S23', name:'Arthur Kill',                     borough:'Staten Island', routes:['SI'],                   lat:40.504665, lng:-74.231954, northLabel:'St George',           southLabel:'Tottenville' },
  { id:'S24', name:'Tottenville',                     borough:'Staten Island', routes:['SI'],                   lat:40.512764, lng:-74.251961, northLabel:'St George',           southLabel:'' },
];

// ── Haversine distance (meters) ───────────────────────────────────────────────
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/stations ─────────────────────────────────────────────────────────
app.get('/api/stations', (req, res) => {
  res.json({ ok: true, stations: STATIONS });
});

// ── GET /api/nearby?lat=40.74&lng=-73.98 ─────────────────────────────────────
app.get('/api/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ ok: false, error: 'lat and lng required' });
  }
  const withDist = STATIONS
    .map(s => ({ ...s, distance: Math.round(distanceMeters(lat, lng, s.lat, s.lng)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
  res.json({ ok: true, stations: withDist });
});

// ── Feeds for station ─────────────────────────────────────────────────────────
function getFeedsForStation(stopId) {
  const station = STATIONS.find(s => s.id === stopId);
  if (!station) return MTA_FEEDS;
  const feedUrls = new Set(station.routes.map(r => ROUTE_TO_FEED[r]).filter(Boolean));
  return MTA_FEEDS.filter(f => feedUrls.has(f.url));
}

// ── Fetch + decode one GTFS-RT feed ──────────────────────────────────────────
async function fetchFeed(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'nyc-subway-tracker/1.0' },
    timeout: 8000,
  });
  if (!res.ok) throw new Error(`MTA feed returned ${res.status}`);
  const buffer = await res.buffer();
  return GtfsRT.transit_realtime.FeedMessage.decode(buffer);
}

// ── Extract arrivals ──────────────────────────────────────────────────────────
function extractArrivals(feed, stopIdN, stopIdS, now) {
  const northbound = [], southbound = [];
  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue;
    const rawRoute = (entity.tripUpdate.trip?.routeId || '').toUpperCase();
    // Normalise express variants: 7X → 7, 6X → 6, etc. for color lookup
    const baseRoute = rawRoute.endsWith('X') ? rawRoute.slice(0, -1) : rawRoute;
    const routeId   = rawRoute; // keep original for display
    for (const stu of (entity.tripUpdate.stopTimeUpdate || [])) {
      const sid = stu.stopId || '';
      if (sid !== stopIdN && sid !== stopIdS) continue;
      const timeObj = stu.arrival || stu.departure;
      if (!timeObj) continue;
      const arrivalTs = timeObj.time
        ? (typeof timeObj.time === 'object' ? timeObj.time.toNumber() : Number(timeObj.time))
        : null;
      if (!arrivalTs || arrivalTs < now - 30) continue;
      const entry = {
        route:       routeId,
        arrivalTime: arrivalTs,
        color:       ROUTE_COLORS[baseRoute] || ROUTE_COLORS[routeId] || '#808183',
        status:      arrivalTs - now < 60 ? 'arriving' : 'on_time',
        tripId:      entity.tripUpdate.trip?.tripId || '',
      };
      if (sid === stopIdN) northbound.push(entry);
      else                 southbound.push(entry);
      break;
    }
  }
  return { northbound, southbound };
}

// ── GET /api/arrivals?stop=G21 ────────────────────────────────────────────────
app.get('/api/arrivals', async (req, res) => {
  const stopId  = (req.query.stop || 'G21').toUpperCase();
  const now     = Math.floor(Date.now() / 1000);
  const station = STATIONS.find(s => s.id === stopId);
  const feeds   = getFeedsForStation(stopId);

  try {
    const results = await Promise.allSettled(feeds.map(f => fetchFeed(f.url)));
    let northbound = [], southbound = [], errors = [];

    // Build list of all stop ID pairs to query (primary + any extras)
    const stopPairs = [[stopId + 'N', stopId + 'S']];
    if (station?.extraStopIds) {
      for (const extra of station.extraStopIds) {
        // Also make sure we fetch the right feeds for extra stop IDs
        const extraStation = STATIONS.find(s => s.id === extra);
        if (extraStation) {
          const extraFeeds = getFeedsForStation(extra);
          for (const ef of extraFeeds) {
            if (!feeds.find(f => f.url === ef.url)) feeds.push(ef);
          }
        }
        stopPairs.push([extra + 'N', extra + 'S']);
      }
    }

    for (let i = 0; i < feeds.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') { errors.push(feeds[i].url); continue; }
      for (const [sN, sS] of stopPairs) {
        const ex = extractArrivals(r.value, sN, sS, now);
        northbound.push(...ex.northbound);
        southbound.push(...ex.southbound);
      }
    }
    northbound.sort((a, b) => a.arrivalTime - b.arrivalTime);
    southbound.sort((a, b) => a.arrivalTime - b.arrivalTime);
    res.json({
      ok:          true,
      fetchedAt:   now,
      stationId:   stopId,
      stationName: station?.name || stopId,
      northLabel:  station?.northLabel || 'Northbound',
      southLabel:  station?.southLabel || 'Southbound',
      northbound:  northbound.slice(0, 5),
      southbound:  southbound.slice(0, 5),
      feedErrors:  errors.length ? errors : undefined,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/maps-key — returns the Maps JS API key for frontend script loading
// Only returns the key (no sensitive config), and only to same-origin requests
app.get('/api/maps-key', (req, res) => {
  const key = process.env.GOOGLE_MAPS_KEY;
  res.json({ key: key || null });
});

// ── GET /api/geocode?address=... ─────────────────────────────────────────────
// Proxies Google Geocoding so the API key never reaches the browser.
// Key is read from the GOOGLE_MAPS_KEY environment variable.
app.get('/api/geocode', async (req, res) => {
  const address = req.query.address;
  if (!address) return res.status(400).json({ ok: false, error: 'address required' });

  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'Geocoding not configured on server' });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(address)}` +
      `&components=country:US|administrative_area:NY` +
      `&key=${key}`;
    const geoRes  = await fetch(url, { timeout: 6000 });
    const geoData = await geoRes.json();

    if (geoData.status !== 'OK' || !geoData.results?.length) {
      return res.json({ ok: false, error: 'Address not found' });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // Confirm result is within NYC bounding box
    if (lat < 40.4774 || lat > 40.9176 || lng < -74.2591 || lng > -73.7004) {
      return res.json({ ok: false, error: 'Address not found within NYC' });
    }

    res.json({ ok: true, lat, lng, formatted: geoData.results[0].formatted_address });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚇  NYC Subway Tracker`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
