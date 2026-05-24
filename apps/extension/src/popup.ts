const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main class="popup">
      <span class="badge">Milestone 0</span>
      <h1 class="title">WhatsApp Food Order AI Copilot</h1>
      <section class="status">
        Extension shell is installed. Chat reading, reply insertion, and sending are not active.
      </section>
    </main>
  `;
}
