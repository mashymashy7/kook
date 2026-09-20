import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Prospecta AI" },
      { name: "description", content: "Créez un compte ou connectez-vous pour piloter votre agent de prospection Odoo." },
      { property: "og:title", content: "Connexion — Prospecta AI" },
      { property: "og:description", content: "Accédez à votre agent de prospection connecté à Odoo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fn =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/prospects" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-panel)" }}>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {mode === "signup" ? "Créer un compte" : "Se connecter"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accès par e-mail et mot de passe, sans confirmation.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Patientez…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
          </Button>
        </form>
        <button
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "J'ai déjà un compte" : "Créer un compte"}
        </button>
      </div>
    </div>
  );
}
