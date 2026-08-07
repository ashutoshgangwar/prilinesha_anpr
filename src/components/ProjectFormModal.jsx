// src/components/ProjectFormModal.jsx
import { useState, useEffect } from 'react';
import Modal from './Modal';

// Mirrors validators/projectValidator.js.
const GROUP_ID_RE = /^[A-Z0-9][A-Z0-9_-]{1,49}$/;
// Spaces allowed — gates are named as the cameras send them, e.g "Netru Pro Entry".
const DEVICE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,49}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROJECT_TYPES = ['parking', 'society'];
// Mirrors passwordRules in the backend's authValidator.
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
// Matches MIN/MAX_DEVICES_PER_PROJECT in the backend's constants.
const MIN_DEVICES = 1;
const MAX_DEVICES = 50;

const EMPTY_FORM = {
  group_id: '',
  address: '',
  project_type: 'parking',
  devices: [''],
  description: '',
  customer_name: '',
  contact_email: '',
  contact_phone: '',
  create_login: false,
  password: '',
  // Only used when editing: gates to add to a project that already exists.
  newDevices: [],
};

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

/**
 * Resizes the gate list to `count`, keeping what has already been typed.
 * Growing appends blanks; shrinking drops from the end, so reducing the count
 * after a typo does not scramble the names above it.
 */
const resizeDevices = (devices, count) => {
  const next = devices.slice(0, count);
  while (next.length < count) next.push('');
  return next;
};

const formFromProject = (p) => ({
  group_id: p.group_id || '',
  address: p.address || '',
  project_type: p.project_type || 'parking',
  devices: (p.devices || []).map((d) => d.device_name),
  description: p.description || '',
  customer_name: p.customer_name || '',
  contact_email: p.contact_email || '',
  contact_phone: p.contact_phone || '',
  // A login is provisioned with the project, never on an edit.
  create_login: false,
  password: '',
  // Gates to add to an existing project, one POST /devices each.
  newDevices: [],
});

/**
 * Create / edit dialog for POST /api/projects and PATCH /api/projects/:group_id.
 *
 * On edit, group_id and the gate list are read-only: group_id is stamped on
 * every event already ingested and configured on the cameras, and gates are
 * managed through their own /devices routes rather than by rewriting the list.
 */
export default function ProjectFormModal({ open, onClose, project = null, onSubmit }) {
  const isEdit = !!project;
  const [form, setForm] = useState(() =>
    project ? formFromProject(project) : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  // Errors keyed by gate index, so a bad name is flagged on its own input
  // rather than as one sentence about a list.
  const [deviceErrors, setDeviceErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(project ? formFromProject(project) : EMPTY_FORM);
      setErrors({});
      setDeviceErrors({});
      setFormError('');
      setSubmitting(false);
    }
  }, [open, project]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError('');
  };

  /** Dropdown: how many gates this project has. */
  const setDeviceCount = (count) => {
    setForm((prev) => ({ ...prev, devices: resizeDevices(prev.devices, count) }));
    setDeviceErrors({});
    setErrors((prev) => ({ ...prev, devices: undefined }));
    setFormError('');
  };

  /** Edit mode: how many gates to add to the existing project. */
  const setNewDeviceCount = (count) => {
    setForm((prev) => ({ ...prev, newDevices: resizeDevices(prev.newDevices, count) }));
    setDeviceErrors({});
    setFormError('');
  };

  const setNewDeviceName = (index, value) => {
    setForm((prev) => {
      const newDevices = [...prev.newDevices];
      newDevices[index] = value;
      return { ...prev, newDevices };
    });
    setDeviceErrors((prev) => ({ ...prev, [index]: undefined }));
    setFormError('');
  };

  /** One gate's name. */
  const setDeviceName = (index, value) => {
    setForm((prev) => {
      const devices = [...prev.devices];
      devices[index] = value;
      return { ...prev, devices };
    });
    setDeviceErrors((prev) => ({ ...prev, [index]: undefined }));
    setErrors((prev) => ({ ...prev, devices: undefined }));
    setFormError('');
  };

  const validate = () => {
    const next = {};

    if (!isEdit) {
      const gid = form.group_id.trim().toUpperCase();
      if (!gid) next.group_id = 'Project ID is required';
      else if (!GROUP_ID_RE.test(gid))
        next.group_id =
          '2–50 characters: capitals, digits, underscore or hyphen (e.g. NETRU_PRO)';

      const perDevice = {};
      const seen = new Map();
      form.devices.forEach((raw, i) => {
        const name = raw.trim();
        if (!name) {
          perDevice[i] = 'Gate name is required';
          return;
        }
        if (!DEVICE_NAME_RE.test(name)) {
          perDevice[i] =
            'Letters, digits, spaces, dots, underscores or hyphens; up to 50 characters';
          return;
        }
        // The API rejects duplicates within a project, so catch it here and
        // point at the second one rather than failing the whole submit.
        const key = name.toLowerCase();
        if (seen.has(key)) perDevice[i] = `Same as gate ${seen.get(key) + 1}`;
        else seen.set(key, i);
      });
      setDeviceErrors(perDevice);
      if (Object.keys(perDevice).length) next.devices = '';
    }

    if (isEdit && form.newDevices.length) {
      const perDevice = {};
      const taken = new Map(
        (project.devices || []).map((d) => [d.device_name.toLowerCase(), 'existing'])
      );
      form.newDevices.forEach((raw, i) => {
        const name = raw.trim();
        if (!name) {
          perDevice[i] = 'Gate name is required';
          return;
        }
        if (!DEVICE_NAME_RE.test(name)) {
          perDevice[i] =
            'Letters, digits, spaces, dots, underscores or hyphens; up to 50 characters';
          return;
        }
        const key = name.toLowerCase();
        if (taken.has(key)) {
          perDevice[i] =
            taken.get(key) === 'existing'
              ? 'This project already has a gate with that name'
              : `Same as camera ${taken.get(key) + 1}`;
          return;
        }
        taken.set(key, i);
      });
      setDeviceErrors(perDevice);
      if (Object.keys(perDevice).length) next.devices = '';
    }

    const address = form.address.trim();
    if (!address) next.address = 'Address is required';
    else if (address.length < 5 || address.length > 300)
      next.address = 'Must be between 5 and 300 characters';

    if (!PROJECT_TYPES.includes(form.project_type))
      next.project_type = 'Choose a project type';

    const email = form.contact_email.trim();
    if (email && !EMAIL_RE.test(email))
      next.contact_email = 'Enter a valid email address';

    if (!isEdit && form.create_login) {
      // The address becomes the customer's username, so the server refuses a
      // login request without one — say so here rather than after a round trip.
      if (!email)
        next.contact_email =
          'Required to create a login — this address becomes their username';

      const pw = form.password;
      if (pw) {
        if (pw.length < MIN_PASSWORD || pw.length > MAX_PASSWORD)
          next.password = `Must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters`;
        else if (!/[A-Za-z]/.test(pw)) next.password = 'Must contain at least one letter';
        else if (!/[0-9]/.test(pw)) next.password = 'Must contain at least one number';
      }
    }
    if (form.description.trim().length > 500)
      next.description = 'Must be at most 500 characters';
    if (form.customer_name.trim().length > 150)
      next.customer_name = 'Must be at most 150 characters';
    if (form.contact_phone.trim().length > 20)
      next.contact_phone = 'Must be at most 20 characters';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    const optional = ['description', 'customer_name', 'contact_email', 'contact_phone'];
    let payload;

    if (isEdit) {
      // PATCH carries only what changed; group_id is immutable and never sent.
      payload = {};
      if (form.address.trim() !== (project.address || ''))
        payload.address = form.address.trim();
      if (form.project_type !== project.project_type)
        payload.project_type = form.project_type;
      for (const field of optional) {
        if (form[field].trim() !== (project[field] || ''))
          payload[field] = form[field].trim();
      }
      const devicesToAdd = form.newDevices.map((n) => n.trim()).filter(Boolean);
      if (Object.keys(payload).length === 0 && devicesToAdd.length === 0) {
        setFormError('Nothing has changed yet.');
        return;
      }
      // The page runs the PATCH and one POST /devices per gate — they are
      // separate endpoints, so they cannot go in a single request.
      payload = { patch: payload, devices: devicesToAdd };
    } else {
      payload = {
        group_id: form.group_id.trim().toUpperCase(),
        address: form.address.trim(),
        project_type: form.project_type,
        devices: form.devices.map((name) => ({ device_name: name.trim() })),
      };
      for (const field of optional) {
        if (form[field].trim()) payload[field] = form[field].trim();
      }
      if (form.create_login) {
        payload.create_login = true;
        // Omitted when blank: the server then generates one and returns it once.
        if (form.password) payload.password = form.password;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      const data = err?.response?.data;
      const fieldErrors = {};
      let leftover = '';
      const perDevice = {};
      for (const item of data?.errors || []) {
        const raw = String(item.field || '');
        // devices[0].device_name -> that gate's own input
        const at = raw.match(/^devices\[(\d+)\]/);
        if (at) {
          perDevice[Number(at[1])] = item.message;
          fieldErrors.devices = '';
          continue;
        }
        const field = raw.replace(/[[.].*$/, '');
        if (field && field in EMPTY_FORM) fieldErrors[field] = item.message;
        else leftover = item.message;
      }
      setDeviceErrors(perDevice);
      setErrors(fieldErrors);
      setFormError(
        leftover ||
          (Object.keys(fieldErrors).length
            ? ''
            : data?.message || 'Failed to save project')
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
      title={isEdit ? `Edit ${project.group_id}` : 'New project'}
      onClose={submitting ? () => {} : onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="project-form"
            disabled={submitting}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        {isEdit ? (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono font-medium text-gray-900">
              {project.group_id}
            </span>
            <p className="mt-0.5 text-xs text-gray-400">
              The project ID is stamped on every event already ingested and is
              configured on the cameras, so it cannot be changed.
            </p>
          </div>
        ) : (
          <Field
            label="Project ID *"
            error={errors.group_id}
            hint="The project's only name — also what the cameras send. e.g. NETRU_PRO"
          >
            <input
              type="text"
              value={form.group_id}
              onChange={(e) => update('group_id', e.target.value.toUpperCase())}
              className={`${inputClass('group_id')} font-mono`}
              placeholder="NETRU_PRO"
              maxLength={50}
              autoFocus
            />
          </Field>
        )}

        <Field label="Address *" error={errors.address}>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            className={inputClass('address')}
            placeholder="12 MG Road, Sector 14, Gurugram"
            maxLength={300}
          />
        </Field>

        <Field label="Project type *" error={errors.project_type}>
          <select
            value={form.project_type}
            onChange={(e) => update('project_type', e.target.value)}
            className={inputClass('project_type')}
          >
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </Field>

        {isEdit ? (
          <div className="rounded-md border border-gray-200 p-3">
            <p className="mb-1 text-xs font-medium text-gray-600">
              Existing gates ({(project.devices || []).length})
            </p>
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {(project.devices || []).length
                ? project.devices.map((d) => d.device_name).join(', ')
                : 'No gates'}
            </p>

            {/* Adding works exactly as it does when creating a project: choose
                how many, then name each one. Removing a gate, and the last-gate
                rule, live in the project's detail view. */}
            <div className="mt-3">
              <Field
                label="Add cameras"
                hint={`Up to ${MAX_DEVICES - (project.devices || []).length} more on this project.`}
              >
                <select
                  value={form.newDevices.length}
                  onChange={(e) => setNewDeviceCount(Number(e.target.value))}
                  className={inputClass('newDeviceCount')}
                >
                  {Array.from(
                    { length: MAX_DEVICES - (project.devices || []).length + 1 },
                    (_, i) => i
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'None' : `${n} ${n === 1 ? 'camera' : 'cameras'}`}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="mt-2 space-y-2">
                {form.newDevices.map((name, i) => (
                  <div key={i} className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs font-medium text-gray-500">
                        Camera {i + 1}
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setNewDeviceName(i, e.target.value)}
                        className={`w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                          deviceErrors[i]
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
                        }`}
                        placeholder="Netru Pro Ramp"
                        maxLength={50}
                      />
                    </div>
                    {deviceErrors[i] && (
                      <p className="mt-1 pl-[72px] text-xs text-red-600">
                        {deviceErrors[i]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-gray-200 p-3">
            <Field
              label="Number of cameras *"
              hint="Pick how many gates this site has, then name each one below."
            >
              <select
                value={form.devices.length}
                onChange={(e) => setDeviceCount(Number(e.target.value))}
                className={inputClass('deviceCount')}
              >
                {Array.from(
                  { length: MAX_DEVICES - MIN_DEVICES + 1 },
                  (_, i) => i + MIN_DEVICES
                ).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'camera' : 'cameras'}
                  </option>
                ))}
              </select>
            </Field>

            {/* One editable name per camera chosen above. Names are free text
                because they must match exactly what the camera sends. */}
            <div className="mt-3 space-y-2">
              {form.devices.map((name, i) => (
                <div key={i} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-medium text-gray-500">
                      Camera {i + 1}
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setDeviceName(i, e.target.value)}
                      className={`w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                        deviceErrors[i]
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
                      }`}
                      placeholder={i === 0 ? 'Netru Pro Entry' : 'Netru Pro Exit'}
                      maxLength={50}
                    />
                  </div>
                  {deviceErrors[i] && (
                    <p className="mt-1 pl-[72px] text-xs text-red-600">
                      {deviceErrors[i]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Name each gate exactly as its camera sends it, e.g. Netru Pro Entry.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer name" error={errors.customer_name}>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => update('customer_name', e.target.value)}
              className={inputClass('customer_name')}
              maxLength={150}
            />
          </Field>
          <Field label="Contact phone" error={errors.contact_phone}>
            <input
              type="tel"
              value={form.contact_phone}
              onChange={(e) => update('contact_phone', e.target.value)}
              className={inputClass('contact_phone')}
              maxLength={20}
            />
          </Field>
        </div>

        <Field label="Contact email" error={errors.contact_email}>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
            className={inputClass('contact_email')}
            placeholder="ops@example.com"
          />
        </Field>

        {!isEdit && (
          <div className="rounded-md border border-gray-200 p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={form.create_login}
                onChange={(e) => update('create_login', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <span>
                <span className="text-sm font-medium text-gray-700">
                  Create a dashboard login for this customer
                </span>
                <span className="mt-0.5 block text-xs text-gray-400">
                  The contact email becomes their username. If that address
                  already has an account, this project is added to it instead and
                  their password is left alone.
                </span>
              </span>
            </label>

            {form.create_login && (
              <div className="mt-3">
                <Field
                  label="Password"
                  error={errors.password}
                  hint={`Leave blank to have one generated and shown once. Otherwise ${MIN_PASSWORD}+ characters with a letter and a number.`}
                >
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    className={inputClass('password')}
                    placeholder="Netru2026pass"
                    maxLength={MAX_PASSWORD}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <Field label="Description" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className={`${inputClass('description')} min-h-[60px]`}
            maxLength={500}
            rows={2}
          />
        </Field>
      </form>
    </Modal>
  );
}
