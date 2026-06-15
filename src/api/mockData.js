// src/api/mockData.js
//
// In-memory mock data used as a fallback when the backend at
// http://localhost:5050 is not running yet. This lets the dashboard show
// realistic data and lets add/delete work locally. Once the real APIs are
// connected, this file is never hit (see dataService.js).

// ---- ID counters -------------------------------------------------------------
let logIdSeq = 1000;
let vehicleIdSeq = 200;
let cameraIdSeq = 10;

// ---- Helpers -----------------------------------------------------------------
// Build an ISO timestamp `daysAgo` days back at a given hour/minute.
const at = (daysAgo, h, m) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// Lightweight inline SVG "snapshots" so the image modal has something to show.
const vehicleSnapshot = (plate) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
       <rect width="640" height="360" fill="#1f2937"/>
       <text x="320" y="120" fill="#9ca3af" font-family="sans-serif" font-size="26" text-anchor="middle">Vehicle snapshot</text>
       <rect x="210" y="210" width="220" height="64" rx="8" fill="#fbbf24"/>
       <text x="320" y="252" fill="#111827" font-family="monospace" font-size="28" text-anchor="middle">${plate}</text>
     </svg>`
  );

const plateSnapshot = (plate) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120">
       <rect width="420" height="120" rx="10" fill="#fbbf24"/>
       <rect x="6" y="6" width="408" height="108" rx="8" fill="none" stroke="#111827" stroke-width="3"/>
       <text x="210" y="62" fill="#111827" font-family="monospace" font-size="42" text-anchor="middle" dominant-baseline="middle">${plate}</text>
     </svg>`
  );

// ---- Seed: vehicles ----------------------------------------------------------
let vehicles = [
  {
    id: ++vehicleIdSeq,
    vehicle_number: 'MH12AB1234',
    owner_name: 'Rohit Sharma',
    vehicle_class: 'car',
    notes: 'Resident — Tower A',
    createdAt: at(40, 9, 15),
  },
  {
    id: ++vehicleIdSeq,
    vehicle_number: 'DL8CAF5030',
    owner_name: 'Anita Verma',
    vehicle_class: 'car',
    notes: '',
    createdAt: at(30, 11, 0),
  },
  {
    id: ++vehicleIdSeq,
    vehicle_number: 'KA05MJ6789',
    owner_name: 'Suresh Rao',
    vehicle_class: 'bike',
    notes: 'Visitor pass',
    createdAt: at(22, 14, 30),
  },
  {
    id: ++vehicleIdSeq,
    vehicle_number: 'TN09BC4521',
    owner_name: 'Logistics Co.',
    vehicle_class: 'truck',
    notes: 'Delivery vendor',
    createdAt: at(15, 8, 45),
  },
  {
    id: ++vehicleIdSeq,
    vehicle_number: 'GJ01CD7788',
    owner_name: 'City Transit',
    vehicle_class: 'bus',
    notes: 'Staff shuttle',
    createdAt: at(10, 7, 5),
  },
];

const registeredSet = () =>
  new Set(vehicles.map((v) => v.vehicle_number.toUpperCase()));

// ---- Seed: cameras -----------------------------------------------------------
let cameras = [
  {
    id: ++cameraIdSeq,
    cam_id: 101,
    device_name: 'Main Gate Entry Cam',
    gate_type: 'entry',
    location: 'North entrance',
  },
  {
    id: ++cameraIdSeq,
    cam_id: 102,
    device_name: 'Main Gate Exit Cam',
    gate_type: 'exit',
    location: 'North entrance',
  },
  {
    id: ++cameraIdSeq,
    cam_id: 201,
    device_name: 'Basement Ramp Cam',
    gate_type: 'entry',
    location: 'Basement P1',
  },
  {
    id: ++cameraIdSeq,
    cam_id: 202,
    device_name: 'Service Gate Cam',
    gate_type: 'exit',
    location: 'East service road',
  },
];

// ---- Seed: logs --------------------------------------------------------------
// A spread of events across today and the past few days, mixing event types,
// classes, devices and registration status so filters/pagination/stats work.
const seedSpec = [
  ['MH12AB1234', 'entry', 'car', 'Main Gate Entry Cam', 0, 8, 5],
  ['MH12AB1234', 'exit', 'car', 'Main Gate Exit Cam', 0, 18, 40],
  ['DL8CAF5030', 'entry', 'car', 'Main Gate Entry Cam', 0, 9, 12],
  ['KA05MJ6789', 'entry', 'bike', 'Basement Ramp Cam', 0, 9, 50],
  ['UNKNOWN', 'unknown', 'car', 'Main Gate Entry Cam', 0, 10, 22],
  ['TN09BC4521', 'entry', 'truck', 'Service Gate Cam', 0, 11, 5],
  ['GJ01CD7788', 'entry', 'bus', 'Main Gate Entry Cam', 0, 12, 30],
  ['DL8CAF5030', 'exit', 'car', 'Main Gate Exit Cam', 0, 13, 15],
  ['RJ14XY9090', 'exit', 'car', 'Service Gate Cam', 0, 14, 0],
  ['KA05MJ6789', 'exit', 'bike', 'Service Gate Cam', 0, 17, 35],
  ['TN09BC4521', 'exit', 'truck', 'Service Gate Cam', 0, 19, 10],
  ['MH14GH3322', 'entry', 'auto', 'Basement Ramp Cam', 0, 20, 25],

  ['MH12AB1234', 'entry', 'car', 'Main Gate Entry Cam', 1, 8, 30],
  ['DL8CAF5030', 'exit', 'car', 'Main Gate Exit Cam', 1, 18, 5],
  ['UNKNOWN', 'unknown', 'bike', 'Basement Ramp Cam', 1, 15, 45],
  ['GJ01CD7788', 'exit', 'bus', 'Main Gate Exit Cam', 1, 19, 0],
  ['UP32KL1212', 'entry', 'car', 'Main Gate Entry Cam', 1, 10, 10],

  ['KA05MJ6789', 'entry', 'bike', 'Basement Ramp Cam', 2, 9, 0],
  ['TN09BC4521', 'entry', 'truck', 'Service Gate Cam', 2, 12, 20],
  ['MH12AB1234', 'exit', 'car', 'Main Gate Exit Cam', 2, 18, 50],
  ['RJ14XY9090', 'unknown', 'car', 'Main Gate Entry Cam', 2, 16, 30],

  ['DL8CAF5030', 'entry', 'car', 'Main Gate Entry Cam', 3, 8, 15],
  ['GJ01CD7788', 'entry', 'bus', 'Main Gate Entry Cam', 3, 7, 40],
  ['MH14GH3322', 'exit', 'auto', 'Service Gate Cam', 3, 21, 5],
];

let logs = seedSpec.map(([plate, type, vclass, device, daysAgo, h, m]) => {
  const reg = registeredSet().has(plate.toUpperCase());
  return {
    id: ++logIdSeq,
    vehicle_number: plate,
    event_type: type,
    vehicle_class: vclass,
    device_name: device,
    is_registered: reg,
    intozi_datetime: at(daysAgo, h, m),
    event_image: vehicleSnapshot(plate),
    plate_image: plateSnapshot(plate),
  };
});

// ---- Query / mutation API ----------------------------------------------------
const byNewest = (a, b) =>
  new Date(b.intozi_datetime) - new Date(a.intozi_datetime);

export function getLogs(params = {}) {
  const { page = 1, limit = 20, vehicle_number, event_type, from, to } = params;

  let items = [...logs].sort(byNewest);

  if (vehicle_number) {
    const q = String(vehicle_number).toLowerCase();
    items = items.filter((l) =>
      String(l.vehicle_number || '').toLowerCase().includes(q)
    );
  }
  if (event_type) {
    items = items.filter((l) => l.event_type === event_type);
  }
  if (from) {
    const f = new Date(from);
    items = items.filter((l) => new Date(l.intozi_datetime) >= f);
  }
  if (to) {
    const t = new Date(to);
    // If a bare date was passed, include the whole day.
    if (String(to).length <= 10) t.setHours(23, 59, 59, 999);
    items = items.filter((l) => new Date(l.intozi_datetime) <= t);
  }

  const total = items.length;
  const start = (Number(page) - 1) * Number(limit);
  const paged = items.slice(start, start + Number(limit));
  return { items: paged, total };
}

export function getLog(id) {
  return logs.find((l) => String(l.id) === String(id)) || null;
}

export function deleteLog(id) {
  logs = logs.filter((l) => String(l.id) !== String(id));
}

export function getVehicles() {
  const items = [...vehicles].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  return { items, total: items.length };
}

export function createVehicle(payload) {
  const created = {
    id: ++vehicleIdSeq,
    vehicle_number: payload.vehicle_number,
    owner_name: payload.owner_name || '',
    vehicle_class: payload.vehicle_class || 'car',
    notes: payload.notes || '',
    createdAt: new Date().toISOString(),
  };
  vehicles = [created, ...vehicles];
  return created;
}

export function deleteVehicle(id) {
  vehicles = vehicles.filter((v) => String(v.id) !== String(id));
}

export function getCameras() {
  const items = [...cameras];
  return { items, total: items.length };
}

export function createCamera(payload) {
  const created = {
    id: ++cameraIdSeq,
    cam_id: Number(payload.cam_id),
    device_name: payload.device_name || '',
    gate_type: payload.gate_type || 'entry',
    location: payload.location || '',
  };
  cameras = [...cameras, created];
  return created;
}

export function deleteCamera(id) {
  cameras = cameras.filter((c) => String(c.id) !== String(id));
}
