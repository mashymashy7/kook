import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listLeads, startConversation, type Lead } from "@/lib/odoo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects Odoo — Prospecta AI" },
      { name: "description", content: "Retrouvez les prospects de votre CRM Odoo et lancez l'agent qui décroche des démos." },
      { property: "og:title", content: "Prospects Odoo — Prospecta AI" },
      { property: "og:description", content: "Vos opportunités CRM, prêtes à être travaillées par l'agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProspectsPage,
});

function ProspectsPage() {
  const fetchLeads = useServerFn(listLeads);
  const start = useServerFn(startConversation);
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(q = "") {
    setLoading(true);
    setError(null);
    try {
      setLeads(await fetchLeads({ data: { search: q } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(lead: Lead) {
    try {
      const { id } = await start({ data: { lead } });
      navigate({ to: "/conversations/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospects détectés dans Odoo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sélectionnez un prospect pour lancer l'agent qui vise le rendez-vous de démo.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(search);
          }}
        >
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Button type="submit" variant="secondary">
            Chercher
          </Button>
        </form>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          {error}{" "}
          <Link to="/settings" className="underline">
            Configurer la connexion Odoo
          </Link>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Lecture du CRM Odoo…</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {leads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => open(lead)}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{lead.name}</p>
                {lead.stage && (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{lead.stage}</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[lead.partner_name, lead.contact_name, lead.email_from].filter(Boolean).join(" · ") ||
                  "Aucune coordonnée"}
              </p>
            </button>
          ))}
          {!leads.length && !error && (
            <p className="text-sm text-muted-foreground">Aucune opportunité trouvée dans le CRM.</p>
          )}
        </div>
      )}
    </div>
  );
}
