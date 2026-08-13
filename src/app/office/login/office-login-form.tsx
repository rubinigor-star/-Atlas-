"use client";

import { useEffect, useState } from "react";
import styles from "./office-login.module.css";

export function OfficeLoginForm({ emailLabel, passwordLabel, loginLabel, lockSeconds, lockMessage }: {
  emailLabel: string;
  passwordLabel: string;
  loginLabel: string;
  lockSeconds: number;
  lockMessage: string;
}) {
  const [remaining, setRemaining] = useState(lockSeconds);

  useEffect(() => {
    setRemaining(lockSeconds);
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  return <>
    {remaining > 0 && <div className={styles.notice} style={{background:"#fff1f0",color:"#b42318"}} role="alert">{lockMessage} <strong>{countdown}</strong></div>}
    <form method="post" action="/api/office/auth/login" className={styles.form}>
      <div className={styles.field}><label>{emailLabel}</label><input className={styles.input} type="email" name="email" autoComplete="email" disabled={remaining > 0} required /></div>
      <div className={styles.field}><label>{passwordLabel}</label><input className={styles.input} type="password" name="password" autoComplete="current-password" disabled={remaining > 0} required /></div>
      <button className={styles.primaryButton} disabled={remaining > 0}>{remaining > 0 ? countdown : loginLabel}</button>
    </form>
  </>;
}
