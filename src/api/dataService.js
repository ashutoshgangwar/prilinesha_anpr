// src/api/dataService.js
//
// Single entry point for all data calls used by the pages. Each function tries
// the real backend first; if the backend is unreachable (or the endpoint isn't
// ready yet) AND the demo fallback is enabled, it quietly returns mock data
// instead of throwing — so the UI shows data and doesn't spam network errors.
//
// List getters return a normalized { items, total }.
// When you connect the real backend, these automatically start using it.

import api from './axios';
import { DEMO } from '../config';
import { normalizeListResponse } from '../utils/format';
import * as mock from './mockData';

// Fall back only when the backend gave no answer at all (server down / network)
// or failed on its own side (5xx).
//
// 404 and 405 used to fall back too, which quietly turned "this endpoint does
// not exist" into a screen full of convincing mock data — and, on a DELETE, into
// a success toast for a request the server never honoured. A missing endpoint is
// a bug to surface, not to paper over.
const shouldFallback = (err) => {
  if (!DEMO.enabled) return false;
  const status = err?.response?.status;
  if (status == null) return true; // network error, no response
  return status >= 500;
};

// ---- Logs --------------------------------------------------------------------
export async function fetchLogs(params = {}) {
  try {
    const resp = await api.get('/api/logs', { params });
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getLogs(params);
    throw err;
  }
}

// There is deliberately no fetchLog(id) or deleteLog(id): the API exposes only
// GET /api/logs. The detection log is an append-only record of what a camera
// saw, and the backend offers no way to read one event or to delete one — so
// the dashboard must not pretend otherwise.

// ---- Vehicles ----------------------------------------------------------------
// Params: group_id, search, status (registered|unregistered), page, limit.
export async function fetchVehicles(params = {}) {
  try {
    const resp = await api.get('/api/vehicles', { params });
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getVehicles(params);
    throw err;
  }
}

/**
 * POST /api/vehicles — registers a vehicle, or renews one already registered
 * under that project.
 *
 * Returns { created, vehicle }: the API answers 201 with created: true for a new
 * registration and 200 with created: false for a renewal. The caller needs the
 * difference to say which one happened.
 */
export async function createVehicle(payload) {
  try {
    const resp = await api.post('/api/vehicles', payload);
    const body = resp.data ?? {};
    return {
      created: body.created ?? resp.status === 201,
      vehicle: body.data ?? body,
      message: body.message,
    };
  } catch (err) {
    if (shouldFallback(err)) return mock.createVehicle(payload);
    throw err;
  }
}

export async function fetchVehicle(id) {
  try {
    const resp = await api.get(`/api/vehicles/${id}`);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.getVehicle(id);
    throw err;
  }
}

/**
 * PATCH /api/vehicles/:id — edits only the fields sent.
 *
 * group_id and vehicle_number are not editable: together they are the row's
 * identity, so changing either is registering a different vehicle. Omitting
 * device_names leaves the gate list alone; sending [] widens it back to every
 * gate, which is why an empty array must survive as far as the request body.
 */
export async function updateVehicle(id, payload) {
  try {
    const resp = await api.patch(`/api/vehicles/${id}`, payload);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.updateVehicle(id, payload);
    throw err;
  }
}

/**
 * PATCH /api/vehicles/:id/status — the manual half of "registered".
 *
 * Status is derived from two things: valid_till (owned by time) and is_active
 * (owned by a person). This sets the second. valid_till is untouched, so a
 * suspended pass keeps running down.
 */
export async function setVehicleStatus(id, isActive) {
  try {
    const resp = await api.patch(`/api/vehicles/${id}/status`, {
      is_active: isActive,
    });
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.setVehicleStatus(id, isActive);
    throw err;
  }
}

export async function deleteVehicle(id) {
  try {
    const resp = await api.delete(`/api/vehicles/${id}`);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.deleteVehicle(id);
    throw err;
  }
}

// ---- Projects ----------------------------------------------------------------
// Super admin only — every route below is behind requireSuperAdmin.

/** Params: search, is_active, page, limit. */
export async function fetchProjects(params = {}) {
  try {
    const resp = await api.get('/api/projects', { params });
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getProjects(params);
    throw err;
  }
}

/** One project with its devices and live counts (stats). */
export async function fetchProject(groupId) {
  try {
    const resp = await api.get(`/api/projects/${groupId}`);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.getProject(groupId);
    throw err;
  }
}

/**
 * POST /api/projects.
 *
 * The response carries the Intozi API key in full, and this is the only time it
 * is ever readable — the server keeps a hash. Returned separately from the
 * project so callers cannot miss it.
 */
export async function createProject(payload) {
  try {
    const resp = await api.post('/api/projects', payload);
    const body = resp.data ?? {};
    const data = body.data ?? {};
    return {
      project: data.project ?? null,
      apiKey: data.api_key ?? null,
      // Present only when create_login was asked for. Carries the generated
      // password when the server chose it — shown once, like the key.
      login: data.login ?? null,
      intoziSetup: data.intozi_setup ?? null,
      warning: body.warning ?? null,
    };
  } catch (err) {
    if (shouldFallback(err)) return mock.createProject(payload);
    throw err;
  }
}

/** PATCH /api/projects/:group_id — group_id itself is immutable. */
export async function updateProject(groupId, payload) {
  try {
    const resp = await api.patch(`/api/projects/${groupId}`, payload);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.updateProject(groupId, payload);
    throw err;
  }
}

// ---- Project devices (gates) -------------------------------------------------
// Gates are managed one at a time rather than by rewriting the list, so adding
// one can never silently drop another. All three return the whole updated
// project, which callers can drop straight into state.

/** POST /api/projects/:group_id/devices — { device_name, direction?, label? } */
export async function addProjectDevice(groupId, payload) {
  try {
    const resp = await api.post(`/api/projects/${groupId}/devices`, payload);
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.addProjectDevice(groupId, payload);
    throw err;
  }
}

/** PATCH /api/projects/:group_id/devices/:device_name — { direction?, label?, is_active? } */
export async function updateProjectDevice(groupId, deviceName, payload) {
  try {
    const resp = await api.patch(
      `/api/projects/${groupId}/devices/${encodeURIComponent(deviceName)}`,
      payload
    );
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.updateProjectDevice(groupId, deviceName, payload);
    throw err;
  }
}

/**
 * GET /api/projects/:group_id/devices — the gates of one project and nothing
 * else. This is what the vehicle form's gate picker reads.
 *
 * Not behind requireSuperAdmin, unlike fetchProject: any dashboard token may
 * call it for a project in its own scope, so a customer admin registering a
 * vehicle can see their own gates.
 *
 * Omitting groupId uses GET /api/projects/devices, which infers the project
 * when the account holds exactly one — declared before /:group_id server-side,
 * so "devices" is not read as a group_id.
 *
 * Switched-off gates are left out: a decommissioned camera must not be offered
 * as a choice. `include_inactive` brings them back, and total_count always
 * reports everything the project holds.
 *
 * Returns the response's data block as it stands — devices, the flat
 * device_names array a picker binds to and posts straight back, count and
 * total_count — with device_names derived if an older backend omits it.
 */
export async function fetchProjectDevices(groupId, { includeInactive = false } = {}) {
  const params = includeInactive ? { include_inactive: true } : {};
  try {
    const resp = groupId
      ? await api.get(`/api/projects/${encodeURIComponent(groupId)}/devices`, { params })
      : await api.get('/api/projects/devices', { params });

    const data = resp.data?.data ?? {};
    const devices = data.devices ?? [];
    return {
      ...data,
      devices,
      device_names: data.device_names ?? devices.map((d) => d.device_name),
    };
  } catch (err) {
    if (shouldFallback(err)) return mock.getProjectDevices(groupId, { includeInactive });
    throw err;
  }
}

/**
 * DELETE /api/projects/:group_id/devices/:device_name.
 *
 * The last gate cannot be removed (409). Detections already recorded from a
 * removed gate are unaffected — the log stores the name, not a reference.
 */
export async function removeProjectDevice(groupId, deviceName) {
  try {
    const resp = await api.delete(
      `/api/projects/${groupId}/devices/${encodeURIComponent(deviceName)}`
    );
    return resp.data?.data ?? resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.removeProjectDevice(groupId, deviceName);
    throw err;
  }
}

// There is no Cameras section: the API has no /api/cameras. Gates live on their
// project as `devices` (see above), which is where they are created and managed.
