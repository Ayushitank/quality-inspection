import { useState } from 'react';
import styles from './ExpandableText.module.css';

export function ExpandableText({ text, limit = 110 }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > limit;

  return (
    <div className={styles.wrapper}>
      <p className={isLong && !expanded ? styles.clamped : styles.text}>{text}</p>
      {isLong && (
        <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
