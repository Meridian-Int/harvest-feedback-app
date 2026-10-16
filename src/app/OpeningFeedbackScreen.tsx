import styles from './OpeningFeedbackScreen.module.css';

export function OpeningFeedbackScreen() {
  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-labelledby="feedback-opening-title">
        <div className={styles.brand}>HARVEST</div>
        <div className={styles.byline}>BY MERIDIAN INTELLIGENCE</div>
        <h1 className={styles.title} id="feedback-opening-title">Feedback</h1>
        <div className={styles.rule} aria-hidden="true" />
        <div className={styles.loadingRow} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <div>
            <p className={styles.status}>Opening HARVEST Feedback</p>
            <p className={styles.substatus}>Loading your workspace…</p>
          </div>
        </div>
      </section>
    </main>
  );
}
