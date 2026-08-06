"use client";

import { useState } from "react";
import { Copy, GripVertical, Plus } from "lucide-react";
import type { EventFaqItem } from "@/lib/event-presentation";
import styles from "@/components/event-faq-editor.module.css";

const MAX_ITEMS = 15;
const EMPTY_ITEM: EventFaqItem = { question: "", answer: "" };

type Props = {
  items: EventFaqItem[];
  onChange: (items: EventFaqItem[]) => void;
  questionLabel: string;
  answerLabel: string;
  help: string;
  duplicateLabel: string;
  insertLabel: string;
  dragLabel: string;
  appendLabel: string;
  limitLabel: string;
};

export function EventFaqEditor({
  items,
  onChange,
  questionLabel,
  answerLabel,
  help,
  duplicateLabel,
  insertLabel,
  dragLabel,
  appendLabel,
  limitLabel,
}: Props) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const rows = items.length ? items.slice(0, MAX_ITEMS) : [EMPTY_ITEM];
  const canAdd = rows.length < MAX_ITEMS;

  function commit(next: EventFaqItem[]) {
    onChange(next.slice(0, MAX_ITEMS));
  }

  function update(index: number, key: keyof EventFaqItem, value: string) {
    const next = rows.map((item) => ({ ...item }));
    next[index] = { ...next[index], [key]: value };
    commit(next);
  }

  function insertAfter(index: number, item: EventFaqItem = EMPTY_ITEM) {
    if (!canAdd) return;
    const next = rows.map((row) => ({ ...row }));
    next.splice(index + 1, 0, { ...item });
    commit(next);
  }

  function append() {
    if (!canAdd) return;
    commit([...rows.map((row) => ({ ...row })), { ...EMPTY_ITEM }]);
  }

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    const next = rows.map((row) => ({ ...row }));
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  }

  return <section className={styles.root}>
    <div className={styles.head}>
      <span>{help}</span>
    </div>

    <div className={styles.columnHead} aria-hidden="true">
      <span>#</span>
      <strong>{questionLabel}</strong>
      <strong>{answerLabel}</strong>
      <span/>
    </div>

    <div className={styles.table}>
      {rows.map((row, index) => <div
        className={`${styles.row} ${draggingIndex === index ? styles.dragging : ""} ${dragOverIndex === index ? styles.dragOver : ""}`}
        key={index}
        onDragOver={(event) => {
          if (draggingIndex === null) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOverIndex(index);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const source = draggingIndex ?? Number(event.dataTransfer.getData("text/plain"));
          if (Number.isInteger(source)) move(source, index);
          setDraggingIndex(null);
          setDragOverIndex(null);
        }}
      >
        <div className={styles.number}>{index + 1}</div>
        <input
          className="input"
          value={row.question}
          maxLength={180}
          aria-label={`${questionLabel} ${index + 1}`}
          onChange={(event) => update(index, "question", event.target.value)}
        />
        <textarea
          rows={3}
          value={row.answer}
          maxLength={1200}
          aria-label={`${answerLabel} ${index + 1}`}
          onChange={(event) => update(index, "answer", event.target.value)}
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => insertAfter(index, row)}
            disabled={!canAdd}
            aria-label={duplicateLabel}
            title={duplicateLabel}
          >
            <Copy size={17}/>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => insertAfter(index)}
            disabled={!canAdd}
            aria-label={insertLabel}
            title={insertLabel}
          >
            <Plus size={18}/>
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.dragHandle}`}
            draggable
            aria-label={dragLabel}
            title={dragLabel}
            onDragStart={(event) => {
              setDraggingIndex(index);
              setDragOverIndex(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragEnd={() => {
              setDraggingIndex(null);
              setDragOverIndex(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                move(index, Math.max(0, index - 1));
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                move(index, Math.min(rows.length - 1, index + 1));
              }
            }}
          >
            <GripVertical size={19}/>
          </button>
        </div>
      </div>)}
    </div>

    <div className={styles.footer}>
      {canAdd
        ? <button type="button" className={styles.appendButton} onClick={append}>
            <Plus size={18}/><span>{appendLabel}</span>
          </button>
        : <span className={styles.limit}>{limitLabel}</span>}
      <span className={styles.counter}>{rows.length}/{MAX_ITEMS}</span>
    </div>
  </section>;
}
