export const metadata = {
  title: "Credits",
  description: "Third-party services used by Atlas One.",
};

export default function CreditsPage() {
  return (
    <main className="shell" style={{ paddingTop: 48, paddingBottom: 72 }}>
      <section className="panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <span className="eyebrow">Atlas One</span>
        <h1>Credits</h1>
        <p className="muted">Third-party services used to improve the Atlas One experience.</p>
        <p>
          <a href="https://unavatar.io">Avatars provided by Unavatar</a>
        </p>
      </section>
    </main>
  );
}
