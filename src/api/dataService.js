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

// ---- Cameras -----------------------------------------------------------------
export async function fetchCameras() {
  try {
    const resp = await api.get('/api/cameras');
    return normalizeListResponse(resp.data);
  } catch (err) {
    if (shouldFallback(err)) return mock.getCameras();
    throw err;
  }
}

export async function createCamera(payload) {
  try {
    const resp = await api.post('/api/cameras', payload);
    return resp.data;
  } catch (err) {
    if (shouldFallback(err)) return mock.createCamera(payload);
    throw err;
  }
}

export async function deleteCamera(id) {
  try {
    await api.delete(`/api/cameras/${id}`);
  } catch (err) {
    if (shouldFallback(err)) {
      mock.deleteCamera(id);
      return;
    }
    throw err;
  }
}
