import { MODULES } from "./domain/modules";

const OFFLINE_MESSAGE =
  "Modo sin conexion: las ventas se guardaran en este equipo y se sincronizaran cuando vuelva internet.";

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CHARLY ALEXA · TERMINAL LOCAL</p>
          <h1>Punto de venta</h1>
        </div>
        <div className="connection" aria-label="Estado de conexion">
          <span /> Trabajando local
        </div>
      </header>

      <section className="offline-note">
        <strong>Sin conexion</strong>
        <p>{OFFLINE_MESSAGE}</p>
        <small>Pendiente de sincronizar: 0 movimientos</small>
      </section>

      <section className="intro">
        <div>
          <p className="eyebrow">BASE DE FASE 1</p>
          <h2>Operacion local primero. Sin perder una venta.</h2>
        </div>
        <p>
          Esta consola confirma la separacion del POS. Las pantallas operativas se
          conectaran a SQLite mediante los contratos ya preparados.
        </p>
      </section>

      <section className="module-grid" aria-label="Modulos del POS">
        {MODULES.map((module, index) => (
          <article className={index === 0 ? "module featured" : "module"} key={module.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{module.label}</h3>
            <p>{module.description}</p>
            <small>{module.phase}</small>
          </article>
        ))}
      </section>
    </main>
  );
}
