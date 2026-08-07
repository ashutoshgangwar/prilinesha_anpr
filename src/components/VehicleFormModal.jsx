// src/components/VehicleFormModal.jsx
import { useState, useEffect } from 'react';
import Modal from './Modal';

// Mirrors validators/vehicleValidator.js. Checking here too is not about
// trusting the client — the server still decides — it is so a typo is caught
// in the field that caused it rather than as a sentence at the top of the form.
const PLATE_RE = /^[A-Z0-9-]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;
const DEVICE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,49}$/;

const EMPTY_FORM = {
  group_id: '',
  vehicle_number: '',
  name: '',
  phone_number: '',
  vehicle_model: '',
  valid_till: '',
  device_names: '',
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

/** Prefills the form from an existing row when editing. */
const formFromVehicle = (vehicle) => ({
  group_id: vehicle.group_id || '',
  vehicle_number: vehicle.vehicle_number || '',
  name: vehicle.name || '',
  phone_number: vehicle.phone_number || '',
  vehicle_model: vehicle.vehicle_model || '',
  valid_till: vehicle.valid_till ? String(vehicle.valid_till).slice(0, 10) : '',
  device_names: (vehicle.device_names || []).join(', '),
});

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
      setErrors({});
      setFormError('');
      setSubmitting(false);
    }
  }, [open, vehicle, projects]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
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

    const devices = parseDeviceNames(form.device_names);
    const badDevice = devices.find((d) => !DEVICE_NAME_RE.test(d));
    if (badDevice)
      next.device_names = `"${badDevice}" — letters, digits, dots, underscores or hyphens only, no spaces`;
    else if (devices.length > 100)
      next.device_names = 'At most 100 gates';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    const devices = parseDeviceNames(form.device_names);
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

      const before = vehicle.device_names || [];
      const changedGates =
        devices.length !== before.length ||
        devices.some((d, i) => d !== before[i]);
      // Sent even when empty: [] is a real edit that widens the registration
      // back to every gate.
      if (changedGates) payload.device_names = devices;

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
      // An empty list means "valid at every gate", which is also what omitting
      // it means — so leave it out rather than sending [].
      if (devices.length) payload.device_names = devices;
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
        // device_names[0] -> device_names
        const field = String(item.field || '').replace(/\[\d+\].*$/, '');
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
                  onChange={(e) => update('group_id', e.target.value)}
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
          hint="Comma-separated, e.g. entry1, exit1. Leave blank for every gate in the project."
        >
          <input
            type="text"
            value={form.device_names}
            onChange={(e) => update('device_names', e.target.value)}
            className={inputClass('device_names')}
            placeholder="entry1, exit1"
          />
        </Field>
      </form>
    </Modal>
  );
}
