import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { odooLogin, odooCall, type OdooCreds } from "./odoo.server";

export type OdooSettings = {
  url: string;
  db_name: string;
  username: string;
  api_key: string;
  sender_name: string | null;
  agent_instructions: string | null;
};

export type Lead = {
  id: number;
  name: string;
  partner_name: string | null;
  contact_name: string | null;
  email_from: string | null;
  phone: string | null;
  stage: string | null;
  expected_revenue: number | null;
};

export const getOdooSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("odoo_settings")
      .select("url, db_name, username, api_key, sender_name, agent_instructions")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (data as OdooSettings | null) ?? null;
  });

export const saveOdooSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OdooSettings) => input)
  .handler(async ({ data, context }) => {
    const creds: OdooCreds = {
      url: data.url,
      db_name: data.db_name,
      username: data.username,
      api_key: data.api_key,
    };
    const uid = await odooLogin(creds);
    const { error } = await context.supabase.from("odoo_settings").upsert({
      user_id: context.userId,
      ...creds,
      sender_name: data.sender_name,
      agent_instructions: data.agent_instructions,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { uid };
  });

async function credsFor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("odoo_settings")
    .select("url, db_name, username, api_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Connexion Odoo non configurée.");
  return data as OdooCreds;
}

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const creds = await credsFor(context.supabase, context.userId);
    const uid = await odooLogin(creds);
    const domain: unknown[] = [["type", "=", "opportunity"]];
    if (data.search) domain.push("|", ["name", "ilike", data.search], ["partner_name", "ilike", data.search]);
    const rows = await odooCall<any[]>(creds, uid, "crm.lead", "search_read", [domain], {
      fields: ["name", "partner_name", "contact_name", "email_from", "phone", "stage_id", "expected_revenue"],
      limit: 60,
      order: "create_date desc",
    });
    return rows.map<Lead>((r) => ({
      id: r.id,
      name: r.name,
      partner_name: r.partner_name || null,
      contact_name: r.contact_name || null,
      email_from: r.email_from || null,
      phone: r.phone || null,
      stage: Array.isArray(r.stage_id) ? r.stage_id[1] : null,
      expected_revenue: r.expected_revenue ?? null,
    }));
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lead: Lead }) => input)
  .handler(async ({ data, context }) => {
    const { lead } = data;
    const { data: row, error } = await context.supabase
      .from("conversations")
      .upsert(
        {
          user_id: context.userId,
          odoo_lead_id: lead.id,
          lead_name: lead.name,
          partner_name: lead.partner_name ?? lead.contact_name,
          email: lead.email_from,
          stage: lead.stage,
        },
        { onConflict: "user_id,odoo_lead_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
