"use client";

import type { EventFaqItem } from "@/lib/event-presentation";
import styles from "@/components/event-faq-editor.module.css";

const MAX_ITEMS = 7;

function padded(items: EventFaqItem[]) {
  return Array.from({ length: MAX_ITEMS }, (_, index) => items[index] || { question: "", answer: "" });
}

export function EventFaqEditor({
  items,
  onChange,
  questionLabel,
  answerLabel,
  help,
}: {
  items: EventFaqItem[];
  onChange: (items: EventFaqItem[]) => void;
  questionLabel: string;
  answerLabel: string;
  help: string;
}) {
  const rows = padded(items);

  function update(index: number, key: keyof EventFaqItem, value: string) {
    const next = padded(items);
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  return <section className={styles.root}>
    <div className={styles.head}>
      <span>{help}</span>
    </div>
    <div className={styles.columnHead} aria-hidden="true">
      <span>#</span><strong>{questionLabel}</strong><strong>{answerLabel}</strong>
    </div>
    <div className={styles.table}>
      {rows.map((row, index) => <div className={styles.row} key={index}>
        <div className={styles.number}>{index + 1}</div>
        <input
          className="input"
          value={row.question}
          maxLength={180}
          aria-label={`${questionLabel} ${index + 1}`}
          onChange={(event) => update(index, "question", event.target.value)}
        />
        <textarea
          rows={2}
          value={row.answer}
          maxLength={1200}
          aria-label={`${answerLabel} ${index + 1}`}
          onChange={(event) => update(index, "answer", event.target.value)}
        />
      </div>)}
    </div>
  </section>;
}
