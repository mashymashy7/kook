import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prospecta AI — L'agent qui décroche vos démos depuis Odoo" },
      {
        name: "description",
        content:
          "Connectez votre CRM Odoo : l'agent détecte vos prospects, rédige et envoie les e-mails, relance et planifie le rendez-vous de démonstration.",
      },
      { property: "og:title", content: "Prospecta AI — L'agent qui décroche vos démos depuis Odoo" },
      {
        property: "og:description",
        content: "Un agent commercial branché sur votre CRM Odoo, du premier e-mail au rendez-vous planifié.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEPS = [
  ["1. Connexion Odoo", "Adresse, base et clé API : l'agent lit votre pipeline CRM et vos contacts."],
  ["2. Conversation", "Il rédige et envoie les e-mails depuis la messagerie native d'Odoo, puis relance."],
  ["3. Rendez-vous", "Il crée la démo dans le calendrier et fait avancer l'étape du pipeline."],
];

function Index() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <span className="font-semibold tracking-tight">
          Prospecta<span className="text-primary">AI</span>
        </span>
        <Link
          to="/auth"
          className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-primary"
        >
          Accéder à l'outil
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Prospection autonome · Odoo</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          L'agent qui discute avec vos prospects jusqu'au rendez-vous de démo.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Branché sur votre CRM Odoo, il détecte les opportunités, écrit des e-mails personnalisés, consigne chaque
          échange et planifie la démonstration à votre place.
        </p>
        <Link
          to="/auth"
          className="mt-8 inline-flex rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Créer mon compte
        </Link>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
              <p className="font-medium">{title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
