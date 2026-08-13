// src/components/VisitorFormModal.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { fetchProjectDevices, fetchVehicles } from '../api/dataService';
import {
  getErrorMessage,
  toLocalDateTimeInput,
  fromLocalDateTimeInput,
} from '../utils/format';

// Mirrors validators/visitorValidator.js. The server still decides — this is so
// a typo is caught in the field that caused it rather than as a sentence at the
// top of the form.
const PLATE_RE = /^[A-Z0-9-]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;
const DEVICE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,49}$/;

// MAX_VISITOR_PASS_DAYS on the server. A ceiling, so "visitor" cannot quietly
// become a year of access that never goes through the registry's renewal review.
const MAX_PASS_DAYS = 30;

const EMPTY_FORM = {
  group_id: '',
  vehicle_number: '',
  name: '',
  phone_number: '',
  vehicle_model: '',
  purpose: '',
  host_vehicle_id: '',
  host_name: '',
  host_phone: '',
  host_unit: '',
  valid_from: '',
  valid_till: '',
  device_names: [],
};

// all_devices is the same question as device_names on this form, so its error
// belongs on the field the operator was looking at.
const FIELD_ALIASES = { all_devices: 'device_names', host_vehicle_id: 'host_name' };

const GATE_EVERY = 'every';
const GATE_SPECIFIC = 'specific';

/** How long a pass runs, offered as the lengths a gate desk actually issues. */
const PRESETS = [
  { label: '2 hours', hours: 2 },
  { label: '4 hours', hours: 4 },
  { label: 'Rest of today', endOfDay: true },
  { label: '3 days', hours: 72 },
];

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

const formFromVisitor = (pass) => ({
  group_id: pass.group_id || '',
  vehicle_number: pass.vehicle_number || '',
  name: pass.name || '',
  phone_number: pass.phone_number || '',
  vehicle_model: pass.vehicle_model || '',
  purpose: pass.purpose || '',
  host_vehicle_id: pass.host?.vehicle_id || '',
  host_name: pass.host?.name || '',
  host_phone: pass.host?.phone_number || '',
  host_unit: pass.host?.unit_number || '',
  valid_from: toLocalDateTimeInput(pass.valid_from),
  valid_till: toLocalDateTimeInput(pass.valid_till),
  device_names: pass.device_names || [],
});

const sameGates = (a, b) => {
  if (a.length !== b.length) return false;
  const sorted = (list) => [...list].map((n) => n.toLowerCase()).sort();
  const [left, right] = [sorted(a), sorted(b)];
  return left.every((name, i) => name === right[i]);
};

/**
 * Picks the host from the registry — the resident or tenant the visitor is here
 * to see.
 *
 * Linking is preferred but never required: plenty of hosts are known by flat
 * number and have no vehicle on the registry at all, and the pass would simply
 * be issued with the field blank. Either way the name, phone and unit are stored
 * on the pass itself, so it still says who admitted this vehicle after that
 * registration is renamed or deleted.
 */
function HostPicker({ groupId, disabled, selected, onSelect, onClear }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const search = async () => {
    const query = term.trim();
    if (!query) return;

    const mine = ++seq.current;
    setSearching(true);
    setError('');
    try {
      const params = { search: query, limit: 8 };
      if (groupId) params.group_id = groupId;
      const { items } = await fetchVehicles(params);
      if (mine !== seq.current) return;
      setResults(items);
    } catch (err) {
      if (mine !== seq.current) return;
      setResults([]);
      setError(getErrorMessage(err, 'Could not search the registry'));
    } finally {
      if (mine === seq.current) setSearching(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-sm">
          <p className="font-medium text-gray-900">{selected.name}</p>
          <p className="mt-0.5 font-mono text-xs text-gray-500">
            {selected.vehicle_number}
            {selected.unit_number ? ` · ${selected.unit_number}` : ''}
            {selected.occupant_type ? ` · ${selected.occupant_type}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="shrink-0 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={term}
          disabled={disabled}
          onChange={(e) => setTerm(e.target.value)}
          // Enter inside a form would submit the whole dialog, which is not what
          // a search box in the middle of it means.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Search the registry by plate, name or unit"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={search}
          disabled={disabled || searching || !term.trim()}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-amber-600">{error}</p>}

      {results && (
        results.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">
            Nobody on the registry matches that — type the host&apos;s details below instead.
          </p>
        ) : (
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-200">
            {results.map((vehicle) => (
              <li key={vehicle.id}>
                <button
                  type="button"
                  onClick={() => onSelect(vehicle)}
                  className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{vehicle.name}</span>
                  <span className="font-mono text-xs text-gray-500">
                    {vehicle.vehicle_number}
                  </span>
                  {vehicle.unit_number && (
                    <span className="text-xs text-gray-500">{vehicle.unit_number}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/**
 * Issue / edit dialog for POST /api/visitors and PATCH /api/visitors/:id.
 *
 * Props:
 *  - open, onClose
 *  - visitor: the pass being edited; omit to issue a new one
 *  - projects: [{ group_id, project_name }] the caller may write to
 *  - requireProject: whether group_id must be sent
 *  - onSubmit: (payload) => Promise — resolves on success, rejects with the
 *    axios error so field-level messages can be shown
 */
export default function VisitorFormModal({
  open,
  onClose,
  visitor = null,
  projects = [],
  requireProject = false,
  onSubmit,
}) {
  const isEdit = !!visitor;

  const [form, setForm] = useState(() =>
    visitor ? formFromVisitor(visitor) : EMPTY_FORM
  );
  const [host, setHost] = useState(null); // the registry row, once linked
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gateMode, setGateMode] = useState(() =>
    (visitor?.device_names || []).length ? GATE_SPECIFIC : GATE_EVERY
  );

  const [gates, setGates] = useState(null);
  const [gatesLoading, setGatesLoading] = useState(false);
  const [gatesError, setGatesError] = useState('');
  const gatesSeq = useRef(0);

  useEffect(() => {
    if (!open) return;

    setForm(
      visitor
        ? formFromVisitor(visitor)
        : {
            ...EMPTY_FORM,
            group_id: projects.length === 1 ? projects[0].group_id : '',
          }
    );
    // The linked registration is only known by id on the pass; showing it as a
    // picked card would mean fetching it, so an edit starts from the stored
    // name and re-links only if the operator searches again.
    setHost(null);
    setGateMode((visitor?.device_names || []).length ? GATE_SPECIFIC : GATE_EVERY);
    setErrors({});
    setFormError('');
    setSubmitting(false);
  }, [open, visitor, projects]);

  const gatesGroupId = isEdit ? visitor.group_id || '' : form.group_id;
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

    fetchProjectDevices(gatesGroupId || undefined)
      .then((data) => {
        if (seq === gatesSeq.current) setGates(data);
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

  const gateOptions = useMemo(() => {
    const options = (gates?.devices ?? []).map((device) => ({
      name: device.device_name,
      direction: device.direction,
      missing: false,
    }));

    // A gate switched off after the pass was issued is not in the list, and
    // without it saving an unrelated edit would quietly drop it from the record.
    const known = new Set(options.map((o) => o.name.toLowerCase()));
    for (const name of visitor?.device_names ?? []) {
      if (!known.has(name.toLowerCase())) {
        options.push({ name, direction: null, missing: true });
        known.add(name.toLowerCase());
      }
    }
    return options;
  }, [gates, visitor]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  const changeProject = (groupId) => {
    // A gate name and a host both only mean something within their project.
    setForm((prev) => ({
      ...prev,
      group_id: groupId,
      device_names: [],
      host_vehicle_id: '',
    }));
    setHost(null);
    setGateMode(GATE_EVERY);
    setErrors({});
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

  /** Starts the window now and runs it for the chosen length. */
  const applyPreset = (preset) => {
    const start = new Date();
    const end = preset.endOfDay
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59)
      : new Date(start.getTime() + preset.hours * 3600000);

    setForm((prev) => ({
      ...prev,
      valid_from: toLocalDateTimeInput(start),
      valid_till: toLocalDateTimeInput(end),
    }));
    setErrors((prev) => ({ ...prev, valid_from: undefined, valid_till: undefined }));
    setFormError('');
  };

  const validate = () => {
    const next = {};

    if (!isEdit && requireProject && !form.group_id) {
      next.group_id = 'Choose which project this pass is for';
    }

    if (!isEdit) {
      const plate = form.vehicle_number.trim().toUpperCase();
      if (!plate) next.vehicle_number = 'Vehicle number is required';
      else if (plate.length < 3 || plate.length > 20)
        next.vehicle_number = 'Must be between 3 and 20 characters';
      else if (!PLATE_RE.test(plate))
        next.vehicle_number = 'Only letters, digits and hyphens';
    }

    const name = form.name.trim();
    if (!name) next.name = 'The visitor’s name is required';
    else if (name.length > 150) next.name = 'Must be at most 150 characters';

    const phone = form.phone_number.trim();
    if (phone && !PHONE_RE.test(phone))
      next.phone_number = '6–20 digits, optionally starting with +';

    const hostPhone = form.host_phone.trim();
    if (hostPhone && !PHONE_RE.test(hostPhone))
      next.host_phone = '6–20 digits, optionally starting with +';

    if (form.vehicle_model.trim().length > 100)
      next.vehicle_model = 'Must be at most 100 characters';
    if (form.purpose.trim().length > 200)
      next.purpose = 'Must be at most 200 characters';
    if (form.host_unit.trim().length > 50)
      next.host_unit = 'Must be at most 50 characters';

    // A pass is always somebody's: either a linked registration, or a name.
    if (!form.host_vehicle_id && !form.host_name.trim()) {
      next.host_name = 'Say who the visitor is here to see';
    } else if (form.host_name.trim().length > 150) {
      next.host_name = 'Must be at most 150 characters';
    }

    if (!form.valid_from) next.valid_from = 'A start time is required';
    if (!form.valid_till) next.valid_till = 'An end time is required';

    if (form.valid_from && form.valid_till) {
      const from = new Date(form.valid_from);
      const till = new Date(form.valid_till);
      if (till <= from) next.valid_till = 'Must be after the start time';
      else if (till - from > MAX_PASS_DAYS * 86400000)
        next.valid_till = `A pass may run for at most ${MAX_PASS_DAYS} days`;
    }

    if (gateMode === GATE_SPECIFIC) {
      const devices = form.device_names;
      const badDevice = devices.find((d) => !DEVICE_NAME_RE.test(d));
      if (!devices.length)
        next.device_names = 'Tick at least one gate, or choose every gate above';
      else if (badDevice) next.device_names = `"${badDevice}" is not a valid gate name`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    const devices = gateMode === GATE_SPECIFIC ? form.device_names : [];
    // The inputs are wall-clock in the operator's zone; the API reads a
    // timestamp without an offset as UTC, so both ends go out as real instants.
    const validFrom = fromLocalDateTimeInput(form.valid_from);
    const validTill = fromLocalDateTimeInput(form.valid_till);

    let payload;

    if (isEdit) {
      // PATCH touches only what is sent, and an empty body is a 400 by design —
      // so send only what actually changed. group_id and vehicle_number are the
      // pass's identity and are not editable.
      payload = {};
      const changed = (key, value, current) => {
        if (value !== (current ?? '')) payload[key] = value;
      };

      changed('name', form.name.trim(), visitor.name);
      changed('phone_number', form.phone_number.trim(), visitor.phone_number);
      changed('vehicle_model', form.vehicle_model.trim(), visitor.vehicle_model);
      changed('purpose', form.purpose.trim(), visitor.purpose);
      changed('host_name', form.host_name.trim(), visitor.host?.name);
      changed('host_phone', form.host_phone.trim(), visitor.host?.phone_number);
      changed('host_unit', form.host_unit.trim(), visitor.host?.unit_number);

      // Only when a different registration was picked. Null is meaningful here —
      // it is how a linked host is unlinked — so an emptied link is sent as null
      // rather than left out.
      if ((form.host_vehicle_id || '') !== (visitor.host?.vehicle_id || '')) {
        payload.host_vehicle_id = form.host_vehicle_id || null;
      }

      if (validFrom !== new Date(visitor.valid_from).toISOString()) {
        payload.valid_from = validFrom;
      }
      if (validTill !== new Date(visitor.valid_till).toISOString()) {
        payload.valid_till = validTill;
      }

      // Sent even when empty: [] is a real edit that widens the pass back to
      // every gate in the project.
      if (!sameGates(devices, visitor.device_names || [])) {
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
        valid_from: validFrom,
        valid_till: validTill,
      };
      if (form.group_id) payload.group_id = form.group_id;
      if (form.phone_number.trim()) payload.phone_number = form.phone_number.trim();
      if (form.vehicle_model.trim()) payload.vehicle_model = form.vehicle_model.trim();
      if (form.purpose.trim()) payload.purpose = form.purpose.trim();
      if (form.host_vehicle_id) payload.host_vehicle_id = form.host_vehicle_id;
      if (form.host_name.trim()) payload.host_name = form.host_name.trim();
      if (form.host_phone.trim()) payload.host_phone = form.host_phone.trim();
      if (form.host_unit.trim()) payload.host_unit = form.host_unit.trim();
      // An empty list means every gate, which is also what omitting it means.
      if (devices.length) payload.device_names = devices;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      const data = err?.response?.data;
      const fieldErrors = {};
      let leftover = '';
      for (const item of data?.errors || []) {
        const raw = String(item.field || '').replace(/\[\d+\].*$/, '');
        const field = FIELD_ALIASES[raw] ?? raw;
        if (field && field in EMPTY_FORM) fieldErrors[field] = item.message;
        else leftover = item.message;
      }
      setErrors(fieldErrors);
      setFormError(
        leftover ||
          (Object.keys(fieldErrors).length
            ? ''
            : data?.message || 'Failed to issue the pass')
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
      title={isEdit ? `Edit pass · ${visitor.vehicle_number}` : 'Issue visitor pass'}
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
            form="visitor-form"
            disabled={submitting}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Issue pass'}
          </button>
        </>
      }
    >
      <form id="visitor-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        {isEdit ? (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono font-medium text-gray-900">
              {visitor.vehicle_number}
            </span>
            <span className="ml-2 font-mono text-xs text-gray-500">
              {visitor.group_id}
            </span>
            <p className="mt-0.5 text-xs text-gray-400">
              Vehicle number and project cannot be changed — a different plate is a
              different visit.
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
                onChange={(e) => update('vehicle_number', e.target.value.toUpperCase())}
                className={`${inputClass('vehicle_number')} font-mono`}
                placeholder="DL9CX4477"
                maxLength={20}
                autoFocus
              />
            </Field>
          </>
        )}

        <Field label="Visitor name *" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={inputClass('name')}
            placeholder="Amit Verma"
            maxLength={150}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phone number" error={errors.phone_number}>
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => update('phone_number', e.target.value)}
              className={inputClass('phone_number')}
              placeholder="+91 9876543210"
            />
          </Field>

          <Field
            label="Vehicle model"
            error={errors.vehicle_model}
            hint="Helps the guard recognise the vehicle."
          >
            <input
              type="text"
              value={form.vehicle_model}
              onChange={(e) => update('vehicle_model', e.target.value)}
              className={inputClass('vehicle_model')}
              placeholder="Hyundai Creta"
              maxLength={100}
            />
          </Field>
        </div>

        <Field
          label="Purpose"
          error={errors.purpose}
          hint="Optional — for the gate log a human reads, e.g. “AC service”."
        >
          <input
            type="text"
            value={form.purpose}
            onChange={(e) => update('purpose', e.target.value)}
            className={inputClass('purpose')}
            placeholder="Guest of B-402"
            maxLength={200}
          />
        </Field>

        {/* The host — who is accountable for this vehicle being on site. */}
        <fieldset className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-700">
            Who are they visiting?
          </legend>

          <HostPicker
            groupId={gatesGroupId}
            disabled={submitting}
            selected={host}
            onSelect={(vehicle) => {
              // The server copies these across from the registration; filling
              // them in here is what makes the form show what will be stored.
              setHost(vehicle);
              setForm((prev) => ({
                ...prev,
                host_vehicle_id: vehicle.id,
                host_name: vehicle.name || '',
                host_phone: vehicle.phone_number || '',
                host_unit: vehicle.unit_number || '',
              }));
              setErrors((prev) => ({ ...prev, host_name: undefined }));
            }}
            onClear={() => {
              setHost(null);
              setForm((prev) => ({ ...prev, host_vehicle_id: '' }));
            }}
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Host name *" error={errors.host_name}>
              <input
                type="text"
                value={form.host_name}
                onChange={(e) => update('host_name', e.target.value)}
                className={inputClass('host_name')}
                placeholder="Ravi Sharma"
                maxLength={150}
              />
            </Field>

            <Field label="Host phone" error={errors.host_phone}>
              <input
                type="tel"
                value={form.host_phone}
                onChange={(e) => update('host_phone', e.target.value)}
                className={inputClass('host_phone')}
                placeholder="+91 9876543210"
              />
            </Field>

            <Field label="Flat / unit" error={errors.host_unit}>
              <input
                type="text"
                value={form.host_unit}
                onChange={(e) => update('host_unit', e.target.value)}
                className={inputClass('host_unit')}
                placeholder="B-402"
                maxLength={50}
              />
            </Field>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            Linking the host&apos;s own registration is optional — these details are
            stored on the pass either way, so it still says who admitted the vehicle
            later on.
          </p>
        </fieldset>

        {/* The window. This is the whole point of a pass: outside it the plate
            reads as unregistered again, with nothing to switch off. */}
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valid from *" error={errors.valid_from}>
              <input
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => update('valid_from', e.target.value)}
                className={inputClass('valid_from')}
              />
            </Field>

            <Field
              label="Valid till *"
              error={errors.valid_till}
              hint={`At most ${MAX_PASS_DAYS} days.`}
            >
              <input
                type="datetime-local"
                value={form.valid_till}
                onChange={(e) => update('valid_till', e.target.value)}
                min={form.valid_from || undefined}
                className={inputClass('valid_till')}
              />
            </Field>
          </div>
        </div>

        <Field
          label="Gates"
          error={errors.device_names}
          hint={
            gateMode === GATE_EVERY
              ? 'The pass counts at every gate in the project.'
              : 'Valid only at the gates ticked below.'
          }
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
            <option value={GATE_SPECIFIC}>Only the gates I choose…</option>
          </select>
        </Field>

        {gateMode === GATE_SPECIFIC && (
          <div>
            {gatesNeedProject ? (
              <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
                Choose a project first — gates belong to one.
              </p>
            ) : gatesLoading ? (
              <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
                Loading this project’s gates…
              </p>
            ) : gatesError ? (
              <p className="rounded-md border border-dashed border-amber-300 px-3 py-2 text-xs text-amber-600">
                {gatesError}
              </p>
            ) : gateOptions.length === 0 ? (
              <p className="rounded-md border border-dashed border-amber-300 px-3 py-2 text-xs text-amber-600">
                This project has no active gates to choose from.
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-gray-200 p-1">
                {gateOptions.map((option) => (
                  <li key={option.name}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.device_names.includes(option.name)}
                        onChange={() => toggleGate(option.name)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="font-mono text-xs text-gray-900">
                        {option.name}
                      </span>
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
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
