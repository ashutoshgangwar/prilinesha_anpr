// src/api/mockData.js
//
// In-memory mock data used as a fallback when the backend at
// VITE_API_BASE_URL is not reachable. This lets the dashboard show
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

// ---- Seed: projects ---------------------------------------------------------
// Shape mirrors GET /api/projects. There is no cameras collection: gates are
// `devices` on their project.
let projects = [
  {
    id: 'p1',
    group_id: 'GRP-001',
    project_name: 'Ashiana Society',
    address: '12 MG Road, Sector 14, Gurugram',
    project_type: 'society',
    description: null,
    customer_name: 'Ashiana RWA',
    contact_email: 'ops@ashiana.example',
    contact_phone: '+91 124 4455 667',
    devices: [
      { device_name: 'entry1', direction: 'entry' },
      { device_name: 'exit1', direction: 'exit' },
      { device_name: 'ramp1', direction: 'entry' },
    ],
    is_active: true,
    api_key_last4: 'a5e9',
    api_key_rotated_at: at(40, 9, 0),
    created_at: at(60, 10, 0),
    updated_at: at(40, 9, 0),
  },
  {
    id: 'p2',
    group_id: 'GRP-002',
    project_name: 'Phoenix Mall Parking',
    address: '4 Link Road, Andheri West, Mumbai',
    project_type: 'parking',
    description: null,
    customer_name: 'Phoenix Retail',
    contact_email: null,
    contact_phone: null,
    devices: [
      { device_name: 'entry1', direction: 'entry' },
      { device_name: 'service1', direction: 'both' },
    ],
    is_active: true,
    api_key_last4: '77c2',
    api_key_rotated_at: at(20, 11, 30),
    created_at: at(35, 8, 0),
    updated_at: at(20, 11, 30),
  },
];

const withDeviceCount = (p) => ({ ...p, device_count: p.devices.length });

export function getProjects(params = {}) {
  const { page = 1, limit = 25, search, is_active: isActive } = params;
  let items = projects.map(withDeviceCount);

  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((p) =>
      [p.group_id, p.project_name, p.address]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }
  if (isActive !== undefined && isActive !== '') {
    const want = isActive === true || isActive === 'true';
    items = items.filter((p) => p.is_active === want);
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

export function getProject(groupId) {
  const found = projects.find((p) => p.group_id === groupId);
  if (!found) return null;
  return {
    ...withDeviceCount(found),
    stats: {
      registered_vehicles: vehicles.filter((v) => v.group_id === groupId).length,
      total_events: logs.filter((l) => l.group_id === groupId).length,
      assigned_users: 1,
    },
  };
}

export function createProject(payload) {
  const project = {
    id: `p${projects.length + 1}`,
    group_id: payload.group_id,
    // The API sets project_name to the group_id on create — there is no
    // separate name field to send. Mirrored here so demo mode matches.
    project_name: payload.group_id,
    address: payload.address,
    project_type: payload.project_type,
    description: payload.description ?? null,
    customer_name: payload.customer_name ?? null,
    contact_email: payload.contact_email ?? null,
    contact_phone: payload.contact_phone ?? null,
    devices: (payload.devices || []).map((d) => ({ ...d, direction: null })),
    is_active: true,
    api_key_last4: 'demo',
    api_key_rotated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  projects = [withDeviceCount(project), ...projects];
  return {
    project,
    apiKey: 'pk_demo_offline_key_not_real',
    intoziSetup: {
      group_id: project.group_id,
      post_url: '/api',
      feed_url: '/api/feed',
      authorization_header: 'Bearer pk_demo_offline_key_not_real',
    },
    warning: 'Demo session — this key is not real.',
  };
}

/**
 * GET /api/projects/:group_id/devices, and the same list without the project in
 * the path when groupId is omitted — which only answers for an account holding
 * exactly one project, as the real route does.
 */
export function getProjectDevices(groupId, { includeInactive = false } = {}) {
  const found = groupId
    ? projects.find((p) => p.group_id === groupId)
    : projects.length === 1
      ? projects[0]
      : null;

  if (!found) {
    throw new Error(
      groupId
        ? `No project found with group_id "${groupId}".`
        : 'Name a project with group_id — this account holds more than one.'
    );
  }

  const all = found.devices ?? [];
  const visible = includeInactive ? all : all.filter((d) => d.is_active !== false);

  return {
    group_id: found.group_id,
    project_name: found.project_name,
    project_is_active: found.is_active !== false,
    devices: visible.map((d) => ({ ...d, is_active: d.is_active !== false })),
    device_names: visible.map((d) => d.device_name),
    count: visible.length,
    total_count: all.length,
  };
}

/** POST /api/projects/:group_id/devices — 409 on a duplicate or the 50th gate. */
export function addProjectDevice(groupId, payload) {
  const found = projects.find((p) => p.group_id === groupId);
  if (!found) return null;

  const name = String(payload.device_name || '').trim();
  const clash = found.devices.some(
    (d) => d.device_name.toLowerCase() === name.toLowerCase()
  );
  if (clash) throw new Error(`"${name}" is already a gate on this project.`);
  if (found.devices.length >= 50) throw new Error('This project already has 50 gates.');

  found.devices = [
    ...found.devices,
    { device_name: name, direction: payload.direction || null, is_active: true },
  ];
  found.updated_at = new Date().toISOString();
  return withDeviceCount(found);
}

export function updateProjectDevice(groupId, deviceName, payload) {
  const found = projects.find((p) => p.group_id === groupId);
  if (!found) return null;
  const device = found.devices.find((d) => d.device_name === deviceName);
  if (!device) return null;
  for (const field of ['direction', 'label', 'is_active']) {
    if (payload[field] !== undefined) device[field] = payload[field];
  }
  found.updated_at = new Date().toISOString();
  return withDeviceCount(found);
}

/** The project's last gate cannot be removed — the API answers 409. */
export function removeProjectDevice(groupId, deviceName) {
  const found = projects.find((p) => p.group_id === groupId);
  if (!found) return null;
  if (found.devices.length <= 1) {
    throw new Error('A project must keep at least one gate.');
  }
  found.devices = found.devices.filter((d) => d.device_name !== deviceName);
  found.updated_at = new Date().toISOString();
  return withDeviceCount(found);
}

export function updateProject(groupId, payload) {
  const found = projects.find((p) => p.group_id === groupId);
  if (!found) return null;
  for (const field of [
    'address',
    'project_type',
    'description',
    'customer_name',
    'contact_email',
    'contact_phone',
    'is_active',
  ]) {
    if (payload[field] !== undefined) found[field] = payload[field];
  }
  found.updated_at = new Date().toISOString();
  return withDeviceCount(found);
}

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
    vehicle_number: vehicleNumber,
    vehicle_type: vehicleType,
    device_name: deviceName,
    from,
    to,
  } = params;

  let items = [...logs].sort(byNewest);

  if (groupId) {
    items = items.filter((l) => l.group_id === groupId);
  }
  if (vehicleNumber) {
    // One exact plate, every crossing — equality on the uppercased plate, not
    // the partial match `search` runs.
    const plate = String(vehicleNumber).toUpperCase();
    items = items.filter(
      (l) => String(l.vehicle_number || '').toUpperCase() === plate
    );
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
    device_name: deviceName,
    valid_from: validFrom,
    valid_to: validTo,
    expiring_in_days: expiringInDays,
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
  // An empty device_names is the wildcard meaning every gate in the project, so
  // those registrations are valid at this gate too — they simply were not
  // written down gate by gate.
  if (deviceName) {
    const gate = String(deviceName).toLowerCase();
    items = items.filter(
      (v) =>
        !v.device_names?.length ||
        v.device_names.some((d) => String(d).toLowerCase() === gate)
    );
  }
  // A window on the expiry date itself, independent of `status` — which only
  // asks whether that date has already passed.
  if (validFrom) {
    const f = new Date(validFrom);
    items = items.filter((v) => new Date(v.valid_till) >= f);
  }
  if (validTo) {
    const t = new Date(validTo);
    if (String(validTo).length <= 10) t.setHours(23, 59, 59, 999);
    items = items.filter((v) => new Date(v.valid_till) <= t);
  }
  // The renewals queue: switched on and lapsing within N days. Excludes the
  // already-expired (the window starts now) and the deactivated.
  if (expiringInDays !== undefined && expiringInDays !== '' && expiringInDays !== null) {
    const now = Date.now();
    const until = now + Number(expiringInDays) * 86400000;
    items = items.filter((v) => {
      const till = new Date(v.valid_till).getTime();
      return v.is_active && till >= now && till <= until;
    });
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

// ---- Filter options ----------------------------------------------------------
// Offline stand-ins for GET /api/logs/filters and GET /api/vehicles/filters.
// Gates come from the project registry rather than a distinct over the events,
// so a camera that has not seen anything yet is still offered — same as the API.

const EXPIRING_SOON_DAYS = 30;

/** The scoped project list, and the de-duplicated flat gate list across it. */
function scopedGates(groupId) {
  const scoped = groupId ? projects.filter((p) => p.group_id === groupId) : projects;

  const records = scoped.map((p) => ({
    group_id: p.group_id,
    project_name: p.project_name,
    is_active: p.is_active !== false,
    device_names: (p.devices ?? [])
      .filter((d) => d.is_active !== false)
      .map((d) => d.device_name)
      .sort((a, b) => a.localeCompare(b)),
  }));

  // Two projects can both have a gate called "entry1" and the filter matches by
  // name across the whole scope, so the flat list is de-duplicated.
  const seen = new Map();
  records.forEach((p) =>
    p.device_names.forEach((n) => {
      if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    })
  );

  return {
    projects: records,
    device_names: [...seen.values()].sort((a, b) => a.localeCompare(b)),
  };
}

export function getLogFilters(params = {}) {
  const { group_id: groupId } = params;
  const scoped = groupId ? logs.filter((l) => l.group_id === groupId) : logs;
  const times = scoped.map((l) => new Date(l.detected_at).getTime());

  return {
    ...scopedGates(groupId),
    vehicle_types: ['registered', 'unregistered'],
    // Null on both ends when there are no detections at all — a different thing
    // from a filter that matched nothing.
    detected_between: {
      from: times.length ? new Date(Math.min(...times)).toISOString() : null,
      to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    },
    paging: { default_limit: 25, max_limit: 200 },
  };
}

export function getVehicleFilters(params = {}) {
  const { group_id: groupId } = params;
  const scoped = (groupId ? vehicles.filter((v) => v.group_id === groupId) : vehicles).map(
    decorate
  );

  const now = Date.now();
  const soon = now + EXPIRING_SOON_DAYS * 86400000;
  const till = (v) => new Date(v.valid_till).getTime();

  // Kept apart because they are fixed differently: one needs renewing, the
  // other switching back on. registered + expired + deactivated = total.
  const registered = scoped.filter((v) => v.is_active && till(v) >= now);
  const expired = scoped.filter((v) => v.is_active && till(v) < now);
  const deactivated = scoped.filter((v) => !v.is_active);

  const actors = new Map();
  scoped.forEach((v) => {
    if (v.registered_by?.id) actors.set(v.registered_by.id, v.registered_by);
  });

  return {
    ...scopedGates(groupId),
    statuses: ['registered', 'unregistered'],
    registered_by: [...actors.values()]
      .map((a) => ({ id: a.id, name: a.name ?? null, email: a.email ?? null }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    counts: {
      total: scoped.length,
      registered: registered.length,
      unregistered: expired.length + deactivated.length,
      expired: expired.length,
      deactivated: deactivated.length,
    },
    expiring_soon: {
      within_days: EXPIRING_SOON_DAYS,
      count: scoped.filter((v) => v.is_active && till(v) >= now && till(v) <= soon).length,
    },
    paging: { default_limit: 25, max_limit: 100 },
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



// ---- Analytics ---------------------------------------------------------------
// Offline stand-ins for GET /api/analytics/{filters,summary,traffic}.
//
// One deliberate simplification against the real API: buckets here are built in
// the BROWSER's timezone rather than in the requested IANA zone. The server owns
// that arithmetic (it cross-checks its bucket keys against MongoDB's own
// $dateToString); reimplementing zone conversion in a fallback that only runs
// when the backend is unreachable would be a second source of truth to keep
// honest. The `timezone` a caller sends is echoed back so the UI still labels
// itself correctly.

const ANALYTICS_GRANULARITIES = ['hour', 'day', 'week', 'month'];
const ANALYTICS_MAX_BUCKETS = 750;
const ANALYTICS_DEFAULT_SPAN_DAYS = 30;
const REPORT_TIMEZONE = 'Asia/Kolkata';

const pad = (n) => String(n).padStart(2, '0');

/** ISO week number — the week the server's `%G-W%V` key counts in. */
const isoWeekParts = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Thursday decides which year an ISO week belongs to.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7)
  );
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return { year: d.getFullYear(), week };
};

/** Mirrors the server's BUCKET_FORMATS, in local time. */
const bucketKeyOf = (value, granularity) => {
  const d = new Date(value);
  switch (granularity) {
    case 'hour':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
    case 'week': {
      const { year, week } = isoWeekParts(d);
      return `${year}-W${pad(week)}`;
    }
    case 'month':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    default:
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
};

const startOfBucket = (value, granularity) => {
  const d = new Date(value);
  switch (granularity) {
    case 'hour':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
    case 'week': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // ISO: Monday
      return start;
    }
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1);
    default:
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
};

const nextBucket = (date, granularity) => {
  const d = new Date(date);
  if (granularity === 'hour') d.setHours(d.getHours() + 1);
  else if (granularity === 'week') d.setDate(d.getDate() + 7);
  else if (granularity === 'month') d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 1);
  return d;
};

/** Every bucket the window covers, in order — the zero-fill the chart plots. */
const enumerateBuckets = (from, to, granularity) => {
  const keys = [];
  let cursor = startOfBucket(from, granularity);
  while (cursor <= to && keys.length <= ANALYTICS_MAX_BUCKETS) {
    keys.push({ bucket: bucketKeyOf(cursor, granularity), starts_at: cursor.toISOString() });
    cursor = nextBucket(cursor, granularity);
  }
  return keys;
};

const startOfLocalDay = (value) => {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const endOfLocalDay = (value) => {
  const d = startOfLocalDay(value);
  d.setDate(d.getDate() + 1);
  return new Date(d.getTime() - 1);
};

/** A bare YYYY-MM-DD covers the whole of that local day, as the API's does. */
const boundary = (value, edge) => {
  if (!value) return null;
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)) - 1, Number(raw.slice(8, 10)))
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return edge === 'end' ? endOfLocalDay(date) : startOfLocalDay(date);
};

const resolveWindow = ({ from, to, granularity }) => {
  const bucket = ANALYTICS_GRANULARITIES.includes(granularity) ? granularity : 'day';
  const now = new Date();

  const end = boundary(to, 'end') ?? endOfLocalDay(now);
  const fallbackStart = startOfLocalDay(end);
  fallbackStart.setDate(fallbackStart.getDate() - (ANALYTICS_DEFAULT_SPAN_DAYS - 1));
  const start = boundary(from, 'start') ?? fallbackStart;

  return { from: start, to: end, granularity: bucket };
};

// Name hints, conservative in the same way the server's are: a name has to point
// one way and only one way to be attributed at all.
const ENTRY_HINTS = [/entr/, /ingress/, /inward/, /incoming/, /(^|[^a-z])in[\s_.-]?\d*([^a-z]|$)/];
const EXIT_HINTS = [/exit/, /egress/, /outward/, /outgoing/, /(^|[^a-z])out[\s_.-]?\d*([^a-z]|$)/];

const inferDirection = (deviceName) => {
  const name = String(deviceName ?? '').toLowerCase();
  if (!name) return null;
  const looksEntry = ENTRY_HINTS.some((p) => p.test(name));
  const looksExit = EXIT_HINTS.some((p) => p.test(name));
  if (looksEntry && !looksExit) return 'entry';
  if (looksExit && !looksEntry) return 'exit';
  return null;
};

const deviceKey = (groupId, deviceName) =>
  `${String(groupId ?? '').toUpperCase()}::${String(deviceName ?? '').trim().toLowerCase()}`;

/**
 * Gate → direction for every project in scope, plus where each direction came
 * from. A gate configured `both` is deliberately left unresolved: it sees
 * traffic in both directions and cannot be attributed either way.
 */
const buildDirectionIndex = (groupId) => {
  const scoped = groupId ? projects.filter((p) => p.group_id === groupId) : projects;
  const index = new Map();

  const devices = scoped.flatMap((project) =>
    (project.devices ?? []).map((device) => {
      const configured = device.direction ?? null;
      const usable = configured === 'entry' || configured === 'exit';
      const direction = usable ? configured : inferDirection(device.device_name);

      const entry = {
        group_id: project.group_id,
        device_name: device.device_name,
        label: device.label ?? null,
        configured_direction: configured,
        direction: configured === 'both' ? null : direction,
        direction_source: usable
          ? 'configured'
          : direction
            ? 'inferred_from_name'
            : 'unknown',
        is_active: device.is_active !== false,
      };
      index.set(deviceKey(project.group_id, device.device_name), entry);
      return entry;
    })
  );

  const resolve = (group, name) =>
    index.get(deviceKey(group, name)) ?? { direction: null, direction_source: 'unknown' };

  return { resolve, devices };
};

const blankCounts = () => ({
  entries: 0,
  exits: 0,
  unattributed: 0,
  registered: 0,
  unregistered: 0,
  total: 0,
});

const addDetection = (counts, log, direction) => {
  counts.total += 1;
  if (direction === 'entry') counts.entries += 1;
  else if (direction === 'exit') counts.exits += 1;
  else counts.unattributed += 1;
  if (log.vehicle_type === 'registered') counts.registered += 1;
  else counts.unregistered += 1;
};

/** The events a report covers, after the shared filters. */
const scopedEvents = (params, window, resolve) => {
  const {
    group_id: groupId,
    device_name: deviceName,
    vehicle_type: vehicleType,
    vehicle_number: vehicleNumber,
    direction,
  } = params;

  return logs.filter((log) => {
    const at = new Date(log.detected_at);
    if (at < window.from || at > window.to) return false;
    if (groupId && log.group_id !== groupId) return false;
    if (deviceName && log.device_name.toLowerCase() !== String(deviceName).toLowerCase()) {
      return false;
    }
    if (vehicleType && log.vehicle_type !== vehicleType) return false;
    if (
      vehicleNumber &&
      log.vehicle_number.toUpperCase() !== String(vehicleNumber).toUpperCase()
    ) {
      return false;
    }
    // Direction filters the GATE, so an unattributed gate is excluded by any
    // direction filter rather than being counted under the one asked for.
    if (direction && resolve(log.group_id, log.device_name).direction !== direction) {
      return false;
    }
    return true;
  });
};

/** Standing registry counts — a count of the register, never of a window. */
const registryTotals = (groupId) => {
  const scoped = groupId ? vehicles.filter((v) => v.group_id === groupId) : vehicles;
  const now = Date.now();

  const total = { total: 0, active: 0, expired: 0, deactivated: 0 };
  const byProject = new Map();

  scoped.forEach((v) => {
    const counts =
      byProject.get(v.group_id) ??
      byProject.set(v.group_id, { total: 0, active: 0, expired: 0, deactivated: 0 }).get(v.group_id);

    const bucket =
      v.is_active === false
        ? 'deactivated'
        : new Date(v.valid_till).getTime() >= now
          ? 'active'
          : 'expired';

    counts.total += 1;
    counts[bucket] += 1;
    total.total += 1;
    total[bucket] += 1;
  });

  return { total, byProject };
};

const unattributedDevices = (devices) =>
  devices
    .filter((d) => d.direction === null || d.configured_direction === 'both')
    .map(({ group_id, device_name, configured_direction }) => ({
      group_id,
      device_name,
      configured_direction,
    }));

/** Per-project and per-gate breakdowns, shared by both reports. */
const foldTraffic = (events, resolve) => {
  const totals = blankCounts();
  const byProject = new Map();
  const byDevice = new Map();

  events.forEach((log) => {
    const gate = resolve(log.group_id, log.device_name);

    addDetection(totals, log, gate.direction);

    const project =
      byProject.get(log.group_id) ??
      byProject.set(log.group_id, blankCounts()).get(log.group_id);
    addDetection(project, log, gate.direction);

    const key = deviceKey(log.group_id, log.device_name);
    const device =
      byDevice.get(key) ??
      byDevice
        .set(key, {
          group_id: log.group_id,
          device_name: log.device_name,
          direction: gate.direction,
          direction_source: gate.direction_source,
          count: 0,
        })
        .get(key);
    device.count += 1;
  });

  return { totals, byProject, byDevice };
};

export function getAnalyticsSummary(params = {}) {
  const groupId = params.group_id;
  const window = resolveWindow({ ...params, granularity: 'day' });
  const { resolve, devices } = buildDirectionIndex(groupId);
  const registry = registryTotals(groupId);

  const now = new Date();
  const todayWindow = { from: startOfLocalDay(now), to: endOfLocalDay(now) };

  const range = foldTraffic(scopedEvents(params, window, resolve), resolve);
  const today = foldTraffic(scopedEvents(params, todayWindow, resolve), resolve);

  // Quiet projects are rows of zeros, not missing rows.
  const groupIds = new Set([
    ...registry.byProject.keys(),
    ...range.byProject.keys(),
    ...devices.map((d) => d.group_id),
  ]);

  return {
    range: {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      timezone: params.timezone || REPORT_TIMEZONE,
    },
    filters: {
      direction: params.direction ?? null,
      device_name: params.device_name ?? null,
      vehicle_type: params.vehicle_type ?? null,
      vehicle_number: params.vehicle_number ?? null,
    },
    registered_vehicles: registry.total,
    traffic: range.totals,
    today: { date: bucketKeyOf(now, 'day'), ...today.totals },
    by_project: [...groupIds]
      .map((id) => ({
        group_id: id,
        registered_vehicles:
          registry.byProject.get(id) ?? { total: 0, active: 0, expired: 0, deactivated: 0 },
        traffic: range.byProject.get(id) ?? blankCounts(),
        today: today.byProject.get(id) ?? blankCounts(),
      }))
      .sort((a, b) => b.traffic.total - a.traffic.total),
    by_device: [...range.byDevice.values()].sort((a, b) => b.count - a.count),
    unattributed_devices: unattributedDevices(devices),
  };
}

export function getTrafficSeries(params = {}) {
  const groupId = params.group_id;
  const window = resolveWindow(params);
  const { resolve, devices } = buildDirectionIndex(groupId);

  const events = scopedEvents(params, window, resolve);
  const { totals, byProject, byDevice } = foldTraffic(events, resolve);

  const buckets = new Map(
    enumerateBuckets(window.from, window.to, window.granularity).map((b) => [
      b.bucket,
      { ...b, ...blankCounts() },
    ])
  );

  events.forEach((log) => {
    const key = bucketKeyOf(log.detected_at, window.granularity);
    const point = buckets.get(key);
    if (point) addDetection(point, log, resolve(log.group_id, log.device_name).direction);
  });

  return {
    range: {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      timezone: params.timezone || REPORT_TIMEZONE,
      granularity: window.granularity,
    },
    series: [...buckets.values()],
    totals: {
      entries: totals.entries,
      exits: totals.exits,
      unattributed: totals.unattributed,
      total: totals.total,
    },
    by_project: [...byProject.entries()]
      .map(([id, counts]) => ({ group_id: id, ...counts }))
      .sort((a, b) => b.total - a.total),
    by_device: [...byDevice.values()].sort((a, b) => b.count - a.count),
    unattributed_devices: unattributedDevices(devices),
  };
}

export function getAnalyticsFilters(params = {}) {
  const groupId = params.group_id;
  const { devices } = buildDirectionIndex(groupId);
  const registry = registryTotals(groupId);

  const scoped = groupId ? logs.filter((l) => l.group_id === groupId) : logs;
  const times = scoped.map((l) => new Date(l.detected_at).getTime());

  const now = new Date();
  const asDate = (value) => bucketKeyOf(value, 'day');
  const shiftDays = (days) => {
    const d = startOfLocalDay(now);
    d.setDate(d.getDate() + days);
    return d;
  };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  return {
    ...scopedGates(groupId),
    devices,
    directions: ['entry', 'exit'],
    granularities: [...ANALYTICS_GRANULARITIES],
    vehicle_types: ['registered', 'unregistered'],
    detected_between: {
      from: times.length ? new Date(Math.min(...times)).toISOString() : null,
      to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    },
    // The date chips. from/to/granularity go back to the reports verbatim.
    quick_ranges: [
      { key: 'today', label: 'Today', from: asDate(now), to: asDate(now), granularity: 'hour' },
      {
        key: 'last_7_days',
        label: 'Last 7 days',
        from: asDate(shiftDays(-6)),
        to: asDate(now),
        granularity: 'day',
      },
      {
        key: 'last_30_days',
        label: 'Last 30 days',
        from: asDate(shiftDays(-29)),
        to: asDate(now),
        granularity: 'day',
      },
      {
        key: 'this_month',
        label: 'This month',
        from: asDate(monthStart),
        to: asDate(now),
        granularity: 'day',
      },
      {
        key: 'last_12_months',
        label: 'Last 12 months',
        from: asDate(twelveMonthsAgo),
        to: asDate(now),
        granularity: 'month',
      },
    ],
    registered_vehicles: registry.total,
    defaults: {
      timezone: REPORT_TIMEZONE,
      granularity: 'day',
      span_days: ANALYTICS_DEFAULT_SPAN_DAYS,
    },
    limits: { max_buckets: ANALYTICS_MAX_BUCKETS },
    timezone: params.timezone || REPORT_TIMEZONE,
  };
}
