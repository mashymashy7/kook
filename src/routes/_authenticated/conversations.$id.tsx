import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runAgent } from "@/lib/agent.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conversations/$id")({
  head: () => ({
    meta: [
      { title: "Agent de prospection — Prospecta AI" },
      { name: "description", content: "Suivez et pilotez les échanges de l'agent avec votre prospect Odoo." },
      { property: "og:title", content: "Agent de prospection — Prospecta AI" },
      { property: "og:description", content: "E-mails, notes, relances et rendez-vous générés dans Odoo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConversationPage,
});

type Msg = { id: string; role: string; subject: string | null; content: string; created_at: string };
type Act = { id: string; action: string; detail: string | null; success: boolean; created_at: string };

function ConversationPage() {
  const { id } = useParams({ from: "/_authenticated/conversations/$id" });
  const run = useServerFn(runAgent);
  const [conv, setConv] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("conversations").select("*").eq("id", id).maybeSingle().then(({ data }) => setConv(data));
    const refresh = async () => {
      const [{ data: m }, { data: a }] = await Promise.all([
        supabase.from("messages").select("*").eq("conversation_id", id).order("created_at"),
        supabase
          .from("activity_log")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setMessages((m ?? []) as Msg[]);
      setActs((a ?? []) as Act[]);
    };
    refresh();
    const channel = supabase
      .channel(`conv-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    try {
      await run({ data: { conversationId: id, userMessage: text } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de l'agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-panel)" }}>
        <header className="border-b border-border p-5">
          <h1 className="text-lg font-semibold tracking-tight">{conv?.lead_name ?? "Prospect"}</h1>
          <p className="text-sm text-muted-foreground">
            {[conv?.partner_name, conv?.email, conv?.stage].filter(Boolean).join(" · ")}
          </p>
        </header>

        <div className="max-h-[52vh] space-y-4 overflow-y-auto p-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-xl bg-secondary p-3 text-sm"
                  : "max-w-[90%] rounded-xl border border-border bg-background p-3 text-sm"
              }
            >
              {m.role === "email" && (
                <p className="mb-2 text-xs uppercase tracking-wide text-primary">E-mail envoyé · {m.subject}</p>
              )}
              <div
                className="prose-sm whitespace-pre-wrap [&_a]:text-primary"
                dangerouslySetInnerHTML={{ __html: m.content }}
              />
            </div>
          ))}
          {!messages.length && (
            <p className="text-sm text-muted-foreground">
              Demandez à l'agent de prendre contact : il lira la fiche Odoo puis enverra un premier e-mail.
            </p>
          )}
          {busy && <p className="text-sm text-muted-foreground">L'agent travaille dans Odoo…</p>}
          <div ref={bottom} />
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => send("Analyse la fiche du prospect et envoie un premier e-mail personnalisé pour proposer une démo.")}>
              Premier contact
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => send("Envoie une relance courte au prospect et planifie une activité de suivi dans 3 jours.")}>
              Relancer
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => send("Le prospect a accepté : crée le rendez-vous de démo dans le calendrier Odoo et fais avancer l'étape du pipeline.")}>
              Planifier la démo
            </Button>
          </div>
          <Textarea
            rows={3}
            placeholder="Donnez une consigne à l'agent…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button className="mt-3" disabled={busy} onClick={() => send(input)}>
            {busy ? "En cours…" : "Envoyer à l'agent"}
          </Button>
        </div>
      </section>

      <aside className="rounded-2xl border border-border bg-sidebar p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions dans Odoo</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {acts.map((a) => (
            <li key={a.id} className="border-b border-border pb-3 last:border-0">
              <p className={a.success ? "font-medium" : "font-medium text-destructive"}>{a.action}</p>
              <p className="text-muted-foreground">{a.detail}</p>
            </li>
          ))}
          {!acts.length && <li className="text-muted-foreground">Aucune action pour le moment.</li>}
        </ul>
      </aside>
    </div>
  );
}
