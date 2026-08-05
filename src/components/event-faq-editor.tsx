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
      <strong>FAQ</strong>
      <span>{help}</span>
    </div>
    <div className={styles.table}>
      {rows.map((row, index) => <div className={styles.row} key={index}>
        <div className={styles.number}>{index + 1}</div>
        <div className={styles.fields}>
          <label>
            <span>{questionLabel}</span>
            <input
              className="input"
              value={row.question}
              maxLength={180}
              onChange={(event) => update(index, "question", event.target.value)}
            />
          </label>
          <label>
            <span>{answerLabel}</span>
            <textarea
              rows={3}
              value={row.answer}
              maxLength={1200}
              onChange={(event) => update(index, "answer", event.target.value)}
            />
          </label>
        </div>
      </div>)}
    </div>
  </section>;
}
