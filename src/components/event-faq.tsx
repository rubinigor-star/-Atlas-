"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EventFaqItem } from "@/lib/event-presentation";
import styles from "@/components/event-faq.module.css";

export function EventFaq({ title, items }: { title: string; items: EventFaqItem[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  if (!items.length) return null;

  return <section className={styles.card} aria-labelledby="event-faq-title">
    <h2 id="event-faq-title" className={styles.title}>{title}</h2>
    <div className={styles.list}>
      {items.map((item, index) => {
        const open = index === openIndex;
        return <div className={styles.item} key={`${item.question}-${index}`}>
          <button
            type="button"
            className={styles.question}
            aria-expanded={open}
            aria-controls={`event-faq-answer-${index}`}
            onClick={() => setOpenIndex(open ? -1 : index)}
          >
            <span>{item.question}</span>
            <ChevronDown className={open ? styles.chevronOpen : styles.chevron} size={22}/>
          </button>
          <div
            id={`event-faq-answer-${index}`}
            className={open ? styles.answerOpen : styles.answer}
            hidden={!open}
          >
            <p>{item.answer}</p>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
