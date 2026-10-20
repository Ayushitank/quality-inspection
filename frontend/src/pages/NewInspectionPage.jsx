import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/http.js';
import { useToast } from '../components/Toast.jsx';
import { useLogInspection } from '../hooks/useInspections.js';
import { DEFECT_TYPES, MAX_MACHINE_ID_LENGTH, MAX_TEXT_LENGTH, SEVERITIES } from '../lib/constants.js';
import { todayISO } from '../lib/format.js';
import { validateInspection } from '../lib/validation.js';
import styles from './Page.module.css';

const FIELD_ORDER = ['inspectionDate', 'machineId', 'defectType', 'severity', 'remarks'];

const emptyForm = () => ({ inspectionDate: todayISO(), machineId: '', defectType: '', severity: '', remarks: '' });

const fieldErrorsFrom = (details) => Object.fromEntries(details.map(({ field, message }) => [field, message]));

export function NewInspectionPage() {
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const log = useLogInspection();
  const navigate = useNavigate();
  const toast = useToast();

  const change = (name) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const invalid = (name) => Boolean(errors[name]);
  const describedBy = (name) => (errors[name] ? `error-${name}` : undefined);
  const fieldError = (name) =>
    errors[name] && (
      <p id={`error-${name}`} className="field__error" role="alert">
        {errors[name]}
      </p>
    );

  const submit = (event) => {
    event.preventDefault();

    const found = validateInspection(values);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((name) => found[name]);
    if (firstInvalid) {
      document.getElementById(`field-${firstInvalid}`)?.focus();
      return;
    }

    log.mutate(values, {
      onSuccess: (result) => {
        toast(
          result.queued ? 'Saved offline. It will sync when you are back online.' : 'Inspection logged',
          { tone: result.queued ? 'info' : 'success' },
        );
        navigate('/');
      },
      onError: (error) => {
        if (error instanceof ApiError && error.details.length > 0) setErrors(fieldErrorsFrom(error.details));
      },
    });
  };

  const formLevelError = log.error && !(log.error instanceof ApiError && log.error.details.length > 0) ? log.error : null;

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Log an inspection</h2>

      <form className={`card ${styles.form}`} onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="field-inspectionDate">
            Inspection date
          </label>
          <input
            id="field-inspectionDate"
            type="date"
            className="input"
            value={values.inspectionDate}
            max={todayISO()}
            aria-invalid={invalid('inspectionDate')}
            aria-describedby={describedBy('inspectionDate')}
            onChange={change('inspectionDate')}
          />
          {fieldError('inspectionDate')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="field-machineId">
            Machine / line ID
          </label>
          <input
            id="field-machineId"
            type="text"
            className="input"
            value={values.machineId}
            maxLength={MAX_MACHINE_ID_LENGTH}
            placeholder="e.g. LOOM-07"
            autoComplete="off"
            autoCapitalize="characters"
            aria-invalid={invalid('machineId')}
            aria-describedby={describedBy('machineId')}
            onChange={change('machineId')}
          />
          {fieldError('machineId')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="field-defectType">
            Defect type
          </label>
          <select
            id="field-defectType"
            className="input"
            value={values.defectType}
            aria-invalid={invalid('defectType')}
            aria-describedby={describedBy('defectType')}
            onChange={change('defectType')}
          >
            <option value="">Select defect type</option>
            {DEFECT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {fieldError('defectType')}
        </div>

        <fieldset className="field" aria-describedby={describedBy('severity')}>
          <legend className="field__label">Severity</legend>
          <div className={styles.severityOptions}>
            {SEVERITIES.map((severity, index) => (
              <label
                key={severity.value}
                className={`${styles.severityOption} ${styles[`severity${severity.label}`]}`}
              >
                <input
                  id={index === 0 ? 'field-severity' : undefined}
                  type="radio"
                  name="severity"
                  value={severity.value}
                  checked={values.severity === severity.value}
                  onChange={change('severity')}
                />
                <span>{severity.label}</span>
              </label>
            ))}
          </div>
          {fieldError('severity')}
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor="field-remarks">
            Remarks <span className="field__hint">(optional)</span>
          </label>
          <textarea
            id="field-remarks"
            className="input"
            rows={3}
            value={values.remarks}
            maxLength={MAX_TEXT_LENGTH}
            aria-invalid={invalid('remarks')}
            aria-describedby={describedBy('remarks')}
            onChange={change('remarks')}
          />
          {fieldError('remarks')}
        </div>

        {formLevelError && (
          <p className="field__error" role="alert">
            {formLevelError.message}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className="btn btn--primary btn--block" disabled={log.isPending}>
            {log.isPending ? 'Saving…' : 'Log inspection'}
          </button>
        </div>
      </form>
    </div>
  );
}
