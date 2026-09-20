import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getOdooSettings, saveOdooSettings } from "@/lib/odoo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Connexion Odoo — Prospecta AI" },
      { name: "description", content: "Connectez votre base Odoo pour que l'agent accède au CRM et aux contacts." },
      { property: "og:title", content: "Connexion Odoo — Prospecta AI" },
      { property: "og:description", content: "Reliez votre base Odoo à votre agent de prospection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const ACCESS = [
  ["CRM — Prospects & opportunités", "crm.lead : lecture, création, modification, changement d'étape"],
  ["CRM — Pipeline", "crm.stage : lecture des étapes pour faire avancer l'opportunité"],
  ["Contacts", "res.partner : lecture et mise à jour des coordonnées"],
  ["Messagerie", "mail.mail & mail.message : envoi d'e-mails et historique des échanges"],
  ["Activités", "mail.activity & mail.activity.type : planification des relances"],
  ["Calendrier", "calendar.event : création du rendez-vous de démonstration"],
];

function SettingsPage() {
  const load = useServerFn(getOdooSettings);
  const save = useServerFn(saveOdooSettings);
  const [form, setForm] = useState({
    url: "",
    db_name: "",
    username: "",
    api_key: "",
    sender_name: "",
    agent_instructions: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load({}).then((s: any) => {
      if (s) setForm({ ...s, sender_name: s.sender_name ?? "", agent_instructions: s.agent_instructions ?? "" });
    });
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: form as any });
      toast.success("Connexion Odoo vérifiée et enregistrée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-panel)" }}>
        <h1 className="text-xl font-semibold tracking-tight">Connexion à votre base Odoo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La clé API se crée dans Odoo : Préférences → Sécurité du compte → Nouvelle clé API.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Adresse Odoo</Label>
            <Input id="url" placeholder="https://mon-entreprise.odoo.com" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="db">Nom de la base</Label>
              <Input id="db" required value={form.db_name} onChange={(e) => setForm({ ...form, db_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">Utilisateur (e-mail)</Label>
              <Input id="user" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Clé API</Label>
            <Input id="key" type="password" required value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sender">Signature de l'expéditeur</Label>
            <Input id="sender" placeholder="Camille, Responsable partenariats" value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instr">Consignes données à l'agent</Label>
            <Textarea id="instr" rows={4} placeholder="Ton à adopter, offre à mettre en avant, créneaux de démo disponibles…" value={form.agent_instructions} onChange={(e) => setForm({ ...form, agent_instructions: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Vérification…" : "Vérifier et enregistrer"}
          </Button>
        </div>
      </form>

      <aside className="rounded-2xl border border-border bg-sidebar p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accès utilisés dans Odoo</h2>
        <ul className="mt-4 space-y-4 text-sm">
          {ACCESS.map(([title, detail]) => (
            <li key={title}>
              <p className="font-medium">{title}</p>
              <p className="text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">
          L'utilisateur Odoo dont vous fournissez la clé doit disposer des droits Ventes et Contacts.
        </p>
      </aside>
    </div>
  );
}
