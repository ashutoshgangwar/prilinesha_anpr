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
// Shape mirrors GET /api/vehicles: id, group_id, vehicle_number, device_names,
// name, phone_number, valid_till, created_at, updated_at. `status` and
// `days_remaining` are derived on read, exactly as the server derives them.

/** A bare date covers the whole of that day, as the API's valid_till does. */
const toInclusiveEndOfDay = (value) => {
  const raw = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T23:59:59.999Z`).toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

/**
 * Status is derived, never stored — mirroring the server's statusOf(). Two
 * things decide it and both must hold: the pass must still be in date (owned by
 * time) and the vehicle must not be switched off (owned by a dashboard user).
 */
const vehicleStatus = (v) =>
  v.is_active === false || new Date(v.valid_till).getTime() < Date.now()
    ? 'unregistered'
    : 'registered';

/** Why it is unregistered — null while registered. */
const inactiveReason = (v) =>
  v.is_active === false
    ? 'deactivated'
    : new Date(v.valid_till).getTime() < Date.now()
      ? 'expired'
      : null;

/** Negative once expired, so the UI can say "expired 3 days ago". */
const daysRemaining = (v) =>
  Math.ceil((new Date(v.valid_till).getTime() - Date.now()) / 86400000);

/** Adds the three derived fields to a stored row. */
const decorate = (v) => ({
  ...v,
  is_active: v.is_active !== false,
  status: vehicleStatus(v),
  inactive_reason: inactiveReason(v),
  days_remaining: daysRemaining(v),
});

const DEMO_ACTOR = { id: 'demo-user', name: 'Demo User', email: 'demo@anpr.com' };

/** Days from now, as an inclusive end-of-day ISO string. */
const validFor = (days) =>
  toInclusiveEndOfDay(
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  );

let vehicles = [
  {
    id: String(++vehicleIdSeq).padStart(24, '0'),
    group_id: 'GRP-001',
    vehicle_number: 'MH12AB1234',
    vehicle_model: 'Maruti Swift',
    device_names: [],
    name: 'Rohit Sharma',
    phone_number: '+91 98200 11223',
    valid_till: validFor(120),
    registered_by: DEMO_ACTOR,
    updated_by: DEMO_ACTOR,
    created_at: at(40, 9, 15),
    updated_at: at(40, 9, 15),
  },
  {
    id: String(++vehicleIdSeq).padStart(24, '0'),
    group_id: 'GRP-001',
    vehicle_number: 'DL8CAF5030',
    vehicle_model: 'Hyundai i20',
    device_names: ['entry1', 'exit1'],
    name: 'Anita Verma',
    phone_number: '+91 98111 44556',
    valid_till: validFor(9),
    registered_by: DEMO_ACTOR,
    updated_by: DEMO_ACTOR,
    created_at: at(30, 11, 0),
    updated_at: at(30, 11, 0),
  },
  {
    id: String(++vehicleIdSeq).padStart(24, '0'),
    group_id: 'GRP-001',
    vehicle_number: 'KA05MJ6789',
    vehicle_model: 'Honda Activa',
    device_names: ['ramp1'],
    name: 'Suresh Rao',
    phone_number: '+91 99001 23456',
    valid_till: validFor(240),
    registered_by: DEMO_ACTOR,
    updated_by: DEMO_ACTOR,
    created_at: at(22, 14, 30),
    updated_at: at(22, 14, 30),
  },
  {
    id: String(++vehicleIdSeq).padStart(24, '0'),
    group_id: 'GRP-002',
    vehicle_number: 'TN09BC4521',
    vehicle_model: 'Tata Ace',
    device_names: [],
    name: 'Logistics Co.',
    phone_number: '+91 44 2233 4455',
    valid_till: validFor(45),
    // Suspended by hand: in date, but switched off — so it reads as
    // unregistered for a different reason than the lapsed row below.
    is_active: false,
    registered_by: DEMO_ACTOR,
    updated_by: DEMO_ACTOR,
    created_at: at(15, 8, 45),
    updated_at: at(2, 10, 0),
  },
  {
    // Lapsed, so the expired styling and the status filter have a subject.
    id: String(++vehicleIdSeq).padStart(24, '0'),
    group_id: 'GRP-002',
    vehicle_number: 'GJ01CD7788',
    vehicle_model: 'Ashok Leyland Viking',
    device_names: [],
    name: 'City Transit',
    phone_number: '+91 79 4455 6677',
    valid_till: validFor(-12),
    registered_by: DEMO_ACTOR,
    updated_by: DEMO_ACTOR,
    created_at: at(10, 7, 5),
    updated_at: at(10, 7, 5),
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
// Detections spread across today and the past few days, over two projects, both
// vehicle types and several gates, so filters, pagination and the stat tiles all
// have something to bite on.
//
// Shape mirrors GET /api/logs exactly: id, group_id, device_name,
// vehicle_number, vehicle_type, vehicle_model, owner_name, owner_name_source,
// detected_at, received_at.
const MODELS = {
  MH12AB1234: 'Maruti Swift',
  DL8CAF5030: 'Hyundai i20',
  KA05MJ6789: 'Honda Activa',
  TN09BC4521: 'Tata Ace',
  GJ01CD7788: 'Ashok Leyland Viking',
};

// [plate, group_id, device_name, daysAgo, hour, minute, ownerFromEvent]
const seedSpec = [
  ['MH12AB1234', 'GRP-001', 'entry1', 0, 8, 5, false],
  ['MH12AB1234', 'GRP-001', 'exit1', 0, 18, 40, false],
  ['DL8CAF5030', 'GRP-001', 'entry1', 0, 9, 12, true],
  ['KA05MJ6789', 'GRP-001', 'ramp1', 0, 9, 50, false],
  ['UP16XY9999', 'GRP-001', 'entry1', 0, 10, 22, false],
  ['TN09BC4521', 'GRP-002', 'service1', 0, 11, 5, false],
  ['GJ01CD7788', 'GRP-002', 'entry1', 0, 12, 30, false],
  ['DL8CAF5030', 'GRP-001', 'exit1', 0, 13, 15, true],
  ['RJ14XY9090', 'GRP-002', 'service1', 0, 14, 0, false],
  ['KA05MJ6789', 'GRP-001', 'exit1', 0, 17, 35, false],
  ['TN09BC4521', 'GRP-002', 'service1', 0, 19, 10, false],
  ['MH14GH3322', 'GRP-001', 'ramp1', 0, 20, 25, false],

  ['MH12AB1234', 'GRP-001', 'entry1', 1, 8, 30, false],
  ['DL8CAF5030', 'GRP-001', 'exit1', 1, 18, 5, true],
  ['UP16XY9999', 'GRP-001', 'ramp1', 1, 15, 45, false],
  ['GJ01CD7788', 'GRP-002', 'exit1', 1, 19, 0, false],
  ['UP32KL1212', 'GRP-002', 'entry1', 1, 10, 10, false],

  ['KA05MJ6789', 'GRP-001', 'ramp1', 2, 9, 0, false],
  ['TN09BC4521', 'GRP-002', 'service1', 2, 12, 20, false],
  ['MH12AB1234', 'GRP-001', 'exit1', 2, 18, 50, false],
  ['RJ14XY9090', 'GRP-002', 'entry1', 2, 16, 30, false],

  ['DL8CAF5030', 'GRP-001', 'entry1', 3, 8, 15, true],
  ['GJ01CD7788', 'GRP-002', 'entry1', 3, 7, 40, false],
  ['MH14GH3322', 'GRP-001', 'service1', 3, 21, 5, false],
];

const logs = seedSpec.map(
  ([plate, groupId, device, daysAgo, h, m, ownerFromEvent]) => {
    const registered = registeredSet().has(plate.toUpperCase());
    // The registry holds the holder's name under `name`, matching the API.
    const registryOwner = vehicles.find(
      (v) => v.vehicle_number.toUpperCase() === plate.toUpperCase()
    )?.name;

    // Mirrors the server's resolution order: the value the camera sent wins,
    // and the registry answers only when the event carried nothing.
    let ownerName = null;
    let ownerSource = null;
    if (ownerFromEvent && registryOwner) {
      ownerName = registryOwner;
      ownerSource = 'event';
    } else if (registryOwner) {
      ownerName = registryOwner;
      ownerSource = 'registry';
    }

    const detectedAt = at(daysAgo, h, m);
    return {
      id: String(++logIdSeq).padStart(24, '0'),
      group_id: groupId,
      device_name: device,
      vehicle_number: plate,
      vehicle_type: registered ? 'registered' : 'unregistered',
      vehicle_model: MODELS[plate] || null,
      owner_name: ownerName,
      owner_name_source: ownerSource,
      detected_at: detectedAt,
      // A few seconds behind the detection, as the real feed is.
      received_at: new Date(new Date(detectedAt).getTime() + 4000).toISOString(),
    };
  }
);

// ---- Query API ---------------------------------------------------------------
const byNewest = (a, b) => new Date(b.detected_at) - new Date(a.detected_at);

/**
 * Offline stand-in for GET /api/logs. Applies the same filters the API does and
 * returns the same { items, total, pagination } that normalizeListResponse
 * produces, so the pages cannot tell the two apart.
 */
export function getLogs(params = {}) {
  const {
    page = 1,
    limit = 25,
    group_id: groupId,
    search,
    vehicle_type: vehicleType,
    device_name: deviceName,
    from,
    to,
  } = params;

  let items = [...logs].sort(byNewest);

  if (groupId) {
    items = items.filter((l) => l.group_id === groupId);
  }
  if (search) {
    // Partial and case-insensitive across plate, owner and model.
    const q = String(search).toLowerCase();
    items = items.filter((l) =>
      [l.vehicle_number, l.owner_name, l.vehicle_model]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }
  if (vehicleType) {
    items = items.filter((l) => l.vehicle_type === vehicleType);
  }
  if (deviceName) {
    // Exact, case-insensitive.
    const d = String(deviceName).toLowerCase();
    items = items.filter((l) => String(l.device_name || '').toLowerCase() === d);
  }
  if (from) {
    const f = new Date(from);
    items = items.filter((l) => new Date(l.detected_at) >= f);
  }
  if (to) {
    const t = new Date(to);
    // A bare date covers the whole day, as the API's `to` does.
    if (String(to).length <= 10) t.setHours(23, 59, 59, 999);
    items = items.filter((l) => new Date(l.detected_at) <= t);
  }

  const total = items.length;
  const perPage = Number(limit);
  const currentPage = Number(page);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (currentPage - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    total,
    pagination: {
      page: currentPage,
      limit: perPage,
      total,
      total_pages: totalPages,
      has_next: currentPage < totalPages,
      has_previous: currentPage > 1,
    },
  };
}

/**
 * Offline stand-in for GET /api/vehicles. Same { items, total, pagination } the
 * real call produces after normalizeListResponse.
 */
export function getVehicles(params = {}) {
  const {
    page = 1,
    limit = 25,
    group_id: groupId,
    search,
    status,
    is_active: isActive,
    registered_by: registeredBy,
  } = params;

  let items = [...vehicles]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(decorate);

  if (groupId) items = items.filter((v) => v.group_id === groupId);
  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((v) =>
      [v.vehicle_number, v.name, v.phone_number, v.vehicle_model]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }
  // status and is_active intersect rather than overwrite each other, so
  // is_active=true&status=unregistered means "merely lapsed, not suspended"
  // and is_active=false&status=registered correctly matches nothing.
  if (status) items = items.filter((v) => v.status === status);
  if (isActive !== undefined && isActive !== '') {
    const want = isActive === true || isActive === 'true';
    items = items.filter((v) => v.is_active === want);
  }
  if (registeredBy) {
    items = items.filter((v) => v.registered_by?.id === registeredBy);
  }

  const total = items.length;
  const perPage = Number(limit);
  const currentPage = Number(page);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (currentPage - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    total,
    pagination: {
      page: currentPage,
      limit: perPage,
      total,
      total_pages: totalPages,
      has_next: currentPage < totalPages,
      has_previous: currentPage > 1,
    },
  };
}

const findVehicle = (id) => vehicles.find((v) => String(v.id) === String(id));

export function getVehicle(id) {
  const found = findVehicle(id);
  return found ? decorate(found) : null;
}

/** PATCH /api/vehicles/:id — only the fields present are touched. */
export function updateVehicle(id, payload) {
  const found = findVehicle(id);
  if (!found) return null;

  for (const field of ['name', 'phone_number', 'is_active']) {
    if (payload[field] !== undefined) found[field] = payload[field];
  }
  // "" is a real edit meaning "no model", normalised to null like the API does.
  if (payload.vehicle_model !== undefined) {
    found.vehicle_model = payload.vehicle_model || null;
  }
  if (payload.valid_till !== undefined) {
    found.valid_till = toInclusiveEndOfDay(payload.valid_till);
  }
  // An explicit [] widens back to every gate, so absence is the only "leave
  // alone" — checking truthiness here would silently ignore that edit.
  if (payload.device_names !== undefined) {
    found.device_names = payload.device_names || [];
  }
  found.updated_at = new Date().toISOString();
  found.updated_by = DEMO_ACTOR;
  return decorate(found);
}

/** PATCH /api/vehicles/:id/status — valid_till is deliberately untouched. */
export function setVehicleStatus(id, isActive) {
  const found = findVehicle(id);
  if (!found) return null;
  found.is_active = isActive;
  found.updated_at = new Date().toISOString();
  found.updated_by = DEMO_ACTOR;
  return decorate(found);
}

export function deleteVehicle(id) {
  const found = findVehicle(id);
  vehicles = vehicles.filter((v) => String(v.id) !== String(id));
  return found ? decorate(found) : null;
}

/**
 * Offline stand-in for POST /api/vehicles. Mirrors the server's upsert: an
 * existing plate in the same project is renewed (created: false) rather than
 * duplicated.
 */
export function createVehicle(payload) {
  const groupId = payload.group_id || vehicles[0]?.group_id || 'GRP-001';
  const plate = String(payload.vehicle_number || '').toUpperCase();
  const validTill = toInclusiveEndOfDay(payload.valid_till);

  const existing = vehicles.find(
    (v) => v.vehicle_number === plate && v.group_id === groupId
  );

  if (existing) {
    Object.assign(existing, {
      vehicle_model: payload.vehicle_model || null,
      name: payload.name,
      phone_number: payload.phone_number,
      valid_till: validTill,
      device_names: payload.device_names || [],
      updated_at: new Date().toISOString(),
    });
    return { created: false, vehicle: decorate(existing) };
  }

  const now = new Date().toISOString();
  const vehicle = {
    id: String(++vehicleIdSeq).padStart(24, '0'),
    group_id: groupId,
    vehicle_number: plate,
    vehicle_model: payload.vehicle_model || null,
    device_names: payload.device_names || [],
    name: payload.name,
    phone_number: payload.phone_number,
    valid_till: validTill,
    is_active: true,
    registered_by: DEMO_ACTOR,
    updated_by: DEMO_ACTOR,
    created_at: now,
    updated_at: now,
  };
  vehicles = [vehicle, ...vehicles];
  return {
    created: true,
    vehicle: decorate(vehicle),
  };
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
