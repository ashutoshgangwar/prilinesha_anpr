// src/components/VehicleFormModal.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { fetchProjectDevices } from '../api/dataService';
import { getErrorMessage } from '../utils/format';

// Mirrors validators/vehicleValidator.js. Checking here too is not about
// trusting the client — the server still decides — it is so a typo is caught
// in the field that caused it rather than as a sentence at the top of the form.
const PLATE_RE = /^[A-Z0-9-]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;
// Spaces are allowed: gates are named as the cameras send them, e.g.
// "Netru Pro Entry". Keep this in step with DEVICE_NAME_PATTERN in the backend's
// projectValidator — it is the single source both the vehicle and log
// validators import.
const DEVICE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,49}$/;

const EMPTY_FORM = {
  group_id: '',
  vehicle_number: '',
  name: '',
  phone_number: '',
  vehicle_model: '',
  valid_till: '',
  device_names: [],
};

// The API rejects a gate that is not on the project, so all_devices comes back
// under its own name. It is the same question as device_names on this form, and
// the message belongs on the field the operator was looking at.
const FIELD_ALIASES = { all_devices: 'device_names' };

/**
 * How the registration's gates are chosen. Three options because the API means
 * three different things, and the difference only shows up months later:
 *
 *   every       — send nothing. `[]` is the wildcard, and it follows the
 *                 project: a gate added next month is covered automatically.
 *   all_named   — send all_devices: true. The server expands it to every active
 *                 gate and writes them onto the record by name, so the
 *                 registration states what it was granted. A gate added later is
 *                 NOT covered until the vehicle is saved again.
 *   specific    — send the ticked names.
 */
const GATE_EVERY = 'every';
const GATE_ALL_NAMED = 'all_named';
const GATE_SPECIFIC = 'specific';

const GATE_HINTS = {
  [GATE_EVERY]:
    'Follows the project — a gate added to it later is covered automatically.',
  [GATE_ALL_NAMED]:
    'Today’s gates are written onto the record by name. A gate added later is not covered until you save this vehicle again.',
  [GATE_SPECIFIC]: 'Valid only at the gates ticked below.',
};

/**
 * One labelled field with its error or hint.
 *
 * Defined at module level, not inside the form: a component declared inside a
 * render is a new type on every keystroke, so React would unmount and remount
 * the input underneath it and the caret would jump out of the field.
 */
function Field({ label, error, hint, children }) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-xs font-medium text-gray-600">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

/** "entry1, exit1" -> ["entry1", "exit1"]; blank -> [] */
const parseDeviceNames = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Same gates, whatever the order or casing — so an unchanged pick is not a PATCH. */
const sameGates = (a, b) => {
  if (a.length !== b.length) return false;
  const sorted = (list) => [...list].map((n) => n.toLowerCase()).sort();
  const [left, right] = [sorted(a), sorted(b)];
  return left.every((name, i) => name === right[i]);
};

/** Prefills the form from an existing row when editing. */
const formFromVehicle = (vehicle) => ({
  group_id: vehicle.group_id || '',
  vehicle_number: vehicle.vehicle_number || '',
  name: vehicle.name || '',
  phone_number: vehicle.phone_number || '',
  vehicle_model: vehicle.vehicle_model || '',
  valid_till: vehicle.valid_till ? String(vehicle.valid_till).slice(0, 10) : '',
  device_names: vehicle.device_names || [],
});

// A stored list means the registration was restricted; an empty one is the
// wildcard. "All gates by name" is never inferred from a list that happens to
// match the project today — it is only what someone explicitly chose.
const gateModeFromVehicle = (vehicle) =>
  (vehicle?.device_names || []).length ? GATE_SPECIFIC : GATE_EVERY;

/**
 * The gate list itself: the project's active gates, ticked one by one.
 *
 * Bound to `device_names` from GET /api/projects/:group_id/devices, which is the
 * flat array the API takes straight back — so what is ticked here is posted
 * verbatim, with no client-side mapping to get wrong.
 */
function GatePicker({
  needsProject,
  loading,
  error,
  options,
  selected,
  onToggle,
  manualValue,
  onManualChange,
  hiddenCount,
}) {
  const note = (text, tone = 'text-gray-500') => (
    <p
      className={`rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs ${tone}`}
    >
      {text}
    </p>
  );

  if (needsProject) return note('Choose a project first — gates belong to one.');
  if (loading) return note('Loading this project’s gates…');

  // The gate list is a convenience, not the only way in: if it cannot be read,
  // the names can still be typed, which is what this form did before.
  if (error) {
    return (
      <div>
        <p className="mb-1 text-xs text-amber-600">
          {error} — type the gate names instead, separated by commas.
        </p>
        <input
          type="text"
          value={manualValue}
          onChange={(e) => onManualChange(e.target.value)}
          placeholder="entry1, exit1"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
    );
  }

  if (!options.length)
    return note('This project has no active gates to choose from.', 'text-amber-600');

  return (
    <div className="rounded-md border border-gray-200">
      <ul className="max-h-44 overflow-y-auto p-1">
        {options.map((option) => (
          <li key={option.name}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.includes(option.name)}
                onChange={() => onToggle(option.name)}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="font-mono text-xs text-gray-900">{option.name}</span>
              {option.direction && (
                <span className="text-xs text-gray-400">{option.direction}</span>
              )}
              {option.missing && (
                <span className="text-xs text-amber-600">
                  switched off or removed
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
          {hiddenCount} switched-off gate{hiddenCount === 1 ? '' : 's'} not offered.
        </p>
      )}
    </div>
  );
}

/**
 * Add / edit dialog for POST /api/vehicles and PATCH /api/vehicles/:id.
 *
 * Props:
 *  - open, onClose
 *  - vehicle: the row being edited; omit to add a new one
 *  - projects: [{ group_id, project_name }] the caller may write to
 *  - requireProject: whether group_id must be sent. True for a super admin and
 *    for anyone with several projects; false for a user with exactly one, whose
 *    project the server fills in.
 *  - onSubmit: (payload) => Promise  resolves on success, rejects with the axios
 *    error so field-level messages can be shown
 */
export default function VehicleFormModal({
  open,
  onClose,
  vehicle = null,
  projects = [],
  requireProject = false,
  onSubmit,
}) {
  const isEdit = !!vehicle;
  // Seeded from the row on the very first render rather than in the effect
  // below, so an edit never paints empty fields for a frame before filling in.
  // The effect still runs on every open, which is what handles re-opening the
  // dialog on a different row without remounting it.
  const [form, setForm] = useState(() =>
    vehicle ? formFromVehicle(vehicle) : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gateMode, setGateMode] = useState(() => gateModeFromVehicle(vehicle));
  // Only used when the gate list cannot be read and the names are typed instead.
  // Held as raw text so a half-typed "entry1, " keeps its comma while you type.
  const [manualGates, setManualGates] = useState(() =>
    (vehicle?.device_names || []).join(', ')
  );

  // The gate list for the project in question — GET /api/projects/:group_id/devices.
  const [gates, setGates] = useState(null);
  const [gatesLoading, setGatesLoading] = useState(false);
  const [gatesError, setGatesError] = useState('');
  const gatesSeq = useRef(0);

  // Reset whenever the dialog is opened, so a previous attempt's values and
  // errors never bleed into a new one.
  useEffect(() => {
    if (open) {
      setForm(
        vehicle
          ? formFromVehicle(vehicle)
          : {
              ...EMPTY_FORM,
              // One writable project and no choice to make: preselect it.
              group_id: projects.length === 1 ? projects[0].group_id : '',
            }
      );
      setGateMode(gateModeFromVehicle(vehicle));
      setManualGates((vehicle?.device_names || []).join(', '));
      setErrors({});
      setFormError('');
      setSubmitting(false);
    }
  }, [open, vehicle, projects]);

  // Which project's gates to show. On an edit it is the row's own project, which
  // cannot be changed; on a new registration it is whatever is selected.
  const gatesGroupId = isEdit ? vehicle.group_id || '' : form.group_id;

  // Several projects and none picked yet — there is nothing to ask the API for.
  const gatesNeedProject = !gatesGroupId && projects.length > 1;

  useEffect(() => {
    if (!open || gatesNeedProject) {
      setGates(null);
      setGatesError('');
      setGatesLoading(false);
      return;
    }

    const seq = ++gatesSeq.current;
    setGatesLoading(true);
    setGatesError('');

    // No group_id at all is a real call: the endpoint infers the project when
    // the account holds exactly one.
    fetchProjectDevices(gatesGroupId || undefined)
      .then((data) => {
        if (seq !== gatesSeq.current) return;
        setGates(data);
      })
      .catch((err) => {
        if (seq !== gatesSeq.current) return;
        setGates(null);
        setGatesError(getErrorMessage(err, 'Could not load this project’s gates'));
      })
      .finally(() => {
        if (seq === gatesSeq.current) setGatesLoading(false);
      });
  }, [open, gatesGroupId, gatesNeedProject]);

  /**
   * What can be ticked: the project's active gates, plus any gate this vehicle
   * is already registered at that the project no longer offers.
   *
   * The second half matters — a gate switched off after the vehicle was
   * registered is not in the list, and without it saving an unrelated edit would
   * quietly drop that gate from the record.
   */
  const gateOptions = useMemo(() => {
    const options = (gates?.devices ?? []).map((device) => ({
      name: device.device_name,
      direction: device.direction,
      missing: false,
    }));

    const known = new Set(options.map((o) => o.name.toLowerCase()));
    for (const name of vehicle?.device_names ?? []) {
      if (!known.has(name.toLowerCase())) {
        options.push({ name, direction: null, missing: true });
        known.add(name.toLowerCase());
      }
    }

    return options;
  }, [gates, vehicle]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  // A gate name only means anything within its project, so switching project
  // starts the choice again rather than carrying names across to one that has
  // never heard of them.
  const changeProject = (groupId) => {
    setForm((prev) => ({ ...prev, group_id: groupId, device_names: [] }));
    setGateMode(GATE_EVERY);
    setErrors((prev) => ({ ...prev, group_id: undefined, device_names: undefined }));
    setFormError('');
  };

  const toggleGate = (name) => {
    setForm((prev) => ({
      ...prev,
      device_names: prev.device_names.includes(name)
        ? prev.device_names.filter((n) => n !== name)
        : [...prev.device_names, name],
    }));
    setErrors((prev) => ({ ...prev, device_names: undefined }));
    setFormError('');
  };

  const validate = () => {
    const next = {};

    if (!isEdit && requireProject && !form.group_id) {
      next.group_id = 'Choose which project this vehicle belongs to';
    }

    const plate = form.vehicle_number.trim().toUpperCase();
    if (!plate) next.vehicle_number = 'Vehicle number is required';
    else if (plate.length < 3 || plate.length > 20)
      next.vehicle_number = 'Must be between 3 and 20 characters';
    else if (!PLATE_RE.test(plate))
      next.vehicle_number = 'Only letters, digits and hyphens';

    const name = form.name.trim();
    if (!name) next.name = 'Name is required';
    else if (name.length > 150) next.name = 'Must be at most 150 characters';

    const phone = form.phone_number.trim();
    if (!phone) next.phone_number = 'Phone number is required';
    else if (!PHONE_RE.test(phone))
      next.phone_number = '6–20 digits, optionally starting with +';

    if (form.vehicle_model.trim().length > 100)
      next.vehicle_model = 'Must be at most 100 characters';

    if (!form.valid_till) next.valid_till = 'Expiry date is required';

    if (gateMode === GATE_SPECIFIC) {
      const devices = form.device_names;
      const badDevice = devices.find((d) => !DEVICE_NAME_RE.test(d));
      if (!devices.length)
        next.device_names = 'Tick at least one gate, or choose every gate above';
      else if (badDevice)
        next.device_names = `"${badDevice}" — letters, digits, spaces, dots, underscores or hyphens, up to 50 characters`;
      else if (devices.length > 100) next.device_names = 'At most 100 gates';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    // Only a specific pick carries names; the other two modes are said with
    // all_devices or with nothing at all.
    const devices = gateMode === GATE_SPECIFIC ? form.device_names : [];
    let payload;

    if (isEdit) {
      // PATCH touches only what is sent, so send only what actually changed —
      // and an unchanged submit must not go out at all, since an empty body is
      // a 400 by design. group_id and vehicle_number are never included: they
      // are the row's identity and are not editable.
      payload = {};
      if (form.name.trim() !== (vehicle.name || '')) payload.name = form.name.trim();
      if (form.phone_number.trim() !== (vehicle.phone_number || ''))
        payload.phone_number = form.phone_number.trim();
      if (form.valid_till !== String(vehicle.valid_till || '').slice(0, 10))
        payload.valid_till = form.valid_till;
      // Sent even when emptied: "" is how the API clears a model, and it
      // normalises to null server-side.
      if (form.vehicle_model.trim() !== (vehicle.vehicle_model || ''))
        payload.vehicle_model = form.vehicle_model.trim();

      if (gateMode === GATE_ALL_NAMED) {
        // Counts as an edit on its own. The server expands it to the gates that
        // exist right now, and nothing on the record says whether that list has
        // moved since — so asking for it is always meant.
        payload.all_devices = true;
      } else if (!sameGates(devices, vehicle.device_names || [])) {
        // Sent even when empty: [] is a real edit that widens the registration
        // back to every gate.
        payload.device_names = devices;
      }

      if (Object.keys(payload).length === 0) {
        setFormError('Nothing has changed yet.');
        return;
      }
    } else {
      payload = {
        vehicle_number: form.vehicle_number.trim().toUpperCase(),
        name: form.name.trim(),
        phone_number: form.phone_number.trim(),
        valid_till: form.valid_till,
      };
      if (form.vehicle_model.trim()) payload.vehicle_model = form.vehicle_model.trim();
      // Omitted entirely when the server is to infer it — sending "" would be a
      // validation error rather than the "use my only project" it looks like.
      if (form.group_id) payload.group_id = form.group_id;
      if (gateMode === GATE_ALL_NAMED) payload.all_devices = true;
      // An empty list means "valid at every gate", which is also what omitting
      // it means — so leave it out rather than sending [].
      else if (devices.length) payload.device_names = devices;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      // The API returns errors: [{ field, message }] — put each back on its own
      // field, and anything unrecognised at the top.
      const data = err?.response?.data;
      const fieldErrors = {};
      let leftover = '';
      for (const item of data?.errors || []) {
        // device_names[0] -> device_names, and all_devices onto the same field
        const raw = String(item.field || '').replace(/\[\d+\].*$/, '');
        const field = FIELD_ALIASES[raw] ?? raw;
        if (field && field in EMPTY_FORM) fieldErrors[field] = item.message;
        else leftover = item.message;
      }
      setErrors(fieldErrors);
      setFormError(
        leftover ||
          (Object.keys(fieldErrors).length ? '' : data?.message || 'Failed to add vehicle')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
      errors[field]
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
    }`;

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit ${vehicle.vehicle_number}` : 'Add vehicle'}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vehicle-form"
            disabled={submitting}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add vehicle'}
          </button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        {/* Project and plate together identify the registration, so on an edit
            they are shown for context but cannot be changed — the API rejects
            them, and changing either would mean a different vehicle. */}
        {isEdit ? (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono font-medium text-gray-900">
              {vehicle.vehicle_number}
            </span>
            <span className="ml-2 font-mono text-xs text-gray-500">
              {vehicle.group_id}
            </span>
            <p className="mt-0.5 text-xs text-gray-400">
              Vehicle number and project cannot be changed.
            </p>
          </div>
        ) : (
          <>
            {requireProject && (
              <Field label="Project *" error={errors.group_id}>
                <select
                  value={form.group_id}
                  onChange={(e) => changeProject(e.target.value)}
                  className={inputClass('group_id')}
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.group_id} value={p.group_id}>
                      {p.project_name || p.group_id}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Vehicle number *" error={errors.vehicle_number}>
              <input
                type="text"
                value={form.vehicle_number}
                // Uppercased as you type, because the server stores it
                // uppercased — better to show the value that will be saved.
                onChange={(e) =>
                  update('vehicle_number', e.target.value.toUpperCase())
                }
                className={`${inputClass('vehicle_number')} font-mono`}
                placeholder="HR26DK8337"
                maxLength={20}
                autoFocus
              />
            </Field>
          </>
        )}

        <Field label="Owner name *" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={inputClass('name')}
            placeholder="Ravi Sharma"
            maxLength={150}
          />
        </Field>

        <Field
          label="Vehicle model"
          error={errors.vehicle_model}
          hint="Optional — free text, e.g. Swift Dzire."
        >
          <input
            type="text"
            value={form.vehicle_model}
            onChange={(e) => update('vehicle_model', e.target.value)}
            className={inputClass('vehicle_model')}
            placeholder="Swift Dzire"
            maxLength={100}
          />
        </Field>

        <Field label="Phone number *" error={errors.phone_number}>
          <input
            type="tel"
            value={form.phone_number}
            onChange={(e) => update('phone_number', e.target.value)}
            className={inputClass('phone_number')}
            placeholder="+91 9876543210"
          />
        </Field>

        <Field
          label="Valid till *"
          error={errors.valid_till}
          hint="Registration covers the whole of this day."
        >
          <input
            type="date"
            value={form.valid_till}
            onChange={(e) => update('valid_till', e.target.value)}
            className={inputClass('valid_till')}
          />
        </Field>

        <Field
          label="Gates"
          error={errors.device_names}
          hint={GATE_HINTS[gateMode]}
        >
          <select
            value={gateMode}
            onChange={(e) => {
              setGateMode(e.target.value);
              setErrors((prev) => ({ ...prev, device_names: undefined }));
              setFormError('');
            }}
            className={inputClass('device_names')}
          >
            <option value={GATE_EVERY}>Every gate in the project</option>
            <option value={GATE_ALL_NAMED}>All gates</option>
            <option value={GATE_SPECIFIC}>Only the gates I choose…</option>
          </select>
        </Field>

        {gateMode === GATE_SPECIFIC && (
          <GatePicker
            needsProject={gatesNeedProject}
            loading={gatesLoading}
            error={gatesError}
            options={gateOptions}
            selected={form.device_names}
            onToggle={toggleGate}
            manualValue={manualGates}
            onManualChange={(value) => {
              setManualGates(value);
              update('device_names', parseDeviceNames(value));
            }}
            hiddenCount={
              gates ? Math.max(0, (gates.total_count ?? 0) - (gates.count ?? 0)) : 0
            }
          />
        )}

        {gateMode === GATE_ALL_NAMED && gates?.count === 0 && (
          <p className="text-xs text-amber-600">
            This project has no active gates, so “all gates” would select nothing.
          </p>
        )}
      </form>
    </Modal>
  );
}
