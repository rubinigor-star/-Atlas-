"use client";

import { useState } from "react";
import styles from "@/app/events/[slug]/event-about.module.css";

type Props = {
  heading: string;
  title: string;
  description: string;
  posterUrl: string;
  readMore: string;
  readLess: string;
};

export function EventAboutCard({
  heading,
  title,
  description,
  posterUrl,
  readMore,
  readLess,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = description.replace(/\s+/g, " ").trim().length > 360;

  return <>
    <div className={styles.intro}>
      <img className={styles.poster} src={posterUrl} alt=""/>
      <div className={styles.copy}>
        <h2 className={styles.heading}>{heading}</h2>
        <p className={`${styles.description} ${!expanded && canExpand ? styles.collapsed : ""}`}>
          {description}
        </p>
        {canExpand && <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? readLess : readMore}: ${title}`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? readLess : readMore}
        </button>}
      </div>
    </div>
    <div className={styles.divider}/>
  </>;
}
