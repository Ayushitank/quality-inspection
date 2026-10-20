import { useEffect, useRef, useState } from 'react';
import { useResolveInspection } from '../hooks/useInspections.js';
import { DEFECT_TYPES, labelOf, MAX_TEXT_LENGTH } from '../lib/constants.js';
import { validateResolutionNote } from '../lib/validation.js';
import { SeverityBadge } from './Badges.jsx';
import { useToast } from './Toast.jsx';
import styles from './ResolveSheet.module.css';

export function ResolveSheet({ inspection, onClose }) {
  const dialogRef = useRef(null);
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);
  const resolve = useResolveInspection();
  const toast = useToast();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  const noteError = validateResolutionNote(note);
  const serverError = resolve.error?.code === 'ALREADY_RESOLVED' ? null : resolve.error;

  const submit = (event) => {
    event.preventDefault();
    if (noteError) {
      setShowError(true);
      return;
    }

    resolve.mutate(
      { id: inspection.id, resolutionNote: note.trim() },
      {
        onSuccess: () => {
          toast('Inspection marked as resolved');
          onClose();
        },
        onError: (error) => {
          if (error.code !== 'ALREADY_RESOLVED') return;
          toast('This inspection was already resolved', { tone: 'info' });
          onClose();
        },
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby="resolve-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && dialogRef.current.close()}
    >
      <form className={styles.content} onSubmit={submit} noValidate>
        <h2 id="resolve-title" className={styles.title}>
          Resolve inspection
        </h2>

        <p className={styles.context}>
          <strong>{inspection.machineId}</strong> · {labelOf(DEFECT_TYPES, inspection.defectType)}{' '}
          <SeverityBadge severity={inspection.severity} />
        </p>

        <div className="field">
          <label className="field__label" htmlFor="resolution-note">
            What was done to resolve it? (required)
          </label>
          <textarea
            id="resolution-note"
            className="input"
            value={note}
            maxLength={MAX_TEXT_LENGTH}
            rows={4}
            autoFocus
            aria-invalid={showError && Boolean(noteError)}
            aria-describedby="resolution-note-error"
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => setShowError(true)}
          />
          <p id="resolution-note-error" className="field__error" role="alert">
            {showError ? noteError : ''}
          </p>
        </div>

        {serverError && (
          <p className="field__error" role="alert">
            {serverError.message}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn btn--secondary" onClick={() => dialogRef.current.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!note.trim() || resolve.isPending}>
            {resolve.isPending ? 'Saving…' : 'Mark resolved'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
