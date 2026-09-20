import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { odooLogin, odooCall, type OdooCreds } from "./odoo.server";

const MODEL = "openai/gpt-5.6-sol";

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_lead_context",
      description: "Lire la fiche complète du prospect dans Odoo (CRM + contact + historique récent).",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Rédiger et envoyer un e-mail au prospect via la messagerie native d'Odoo.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body_html: { type: "string", description: "Corps de l'e-mail en HTML simple." },
        },
        required: ["subject", "body_html"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_note",
      description: "Consigner une note interne sur la fiche du prospect dans Odoo.",
      parameters: {
        type: "object",
        properties: { note: { type: "string" } },
        required: ["note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_activity",
      description: "Planifier une activité de relance sur la fiche Odoo.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          date_deadline: { type: "string", description: "Date au format YYYY-MM-DD" },
        },
        required: ["summary", "date_deadline"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Créer le rendez-vous de démo dans le calendrier Odoo.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          start: { type: "string", description: "Début UTC au format YYYY-MM-DD HH:MM:SS" },
          duration_hours: { type: "number" },
        },
        required: ["name", "start", "duration_hours"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_stage",
      description: "Faire avancer le prospect vers une étape du pipeline CRM.",
      parameters: {
        type: "object",
        properties: { stage_name: { type: "string" } },
        required: ["stage_name"],
        additionalProperties: false,
      },
    },
  },
];

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; userMessage: string }) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Clé IA manquante.");
    const supabase = context.supabase;

    const { data: conv } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", data.conversationId)
      .single();
    if (!conv) throw new Error("Conversation introuvable.");

    const { data: settings } = await supabase
      .from("odoo_settings")
      .select("url, db_name, username, api_key, sender_name, agent_instructions")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!settings) throw new Error("Connexion Odoo non configurée.");
    const creds: OdooCreds = settings as unknown as OdooCreds;
    const uid = await odooLogin(creds);
    const leadId = conv.odoo_lead_id as number;

    const log = async (action: string, detail: string, success = true) => {
      await supabase.from("activity_log").insert({
        user_id: context.userId,
        conversation_id: conv.id,
        action,
        detail,
        success,
      });
    };

    async function execTool(name: string, args: any): Promise<string> {
      switch (name) {
        case "get_lead_context": {
          const [lead] = await odooCall<any[]>(creds, uid, "crm.lead", "read", [[leadId]], {
            fields: [
              "name",
              "partner_name",
              "contact_name",
              "email_from",
              "phone",
              "function",
              "description",
              "stage_id",
              "expected_revenue",
              "user_id",
              "team_id",
            ],
          });
          const msgs = await odooCall<any[]>(creds, uid, "mail.message", "search_read", [
            [
              ["model", "=", "crm.lead"],
              ["res_id", "=", leadId],
            ],
          ], { fields: ["subject", "body", "date", "message_type"], limit: 10, order: "date desc" });
          return JSON.stringify({ lead, historique: msgs });
        }
        case "send_email": {
          const to = conv.email as string | null;
          if (!to) return "Erreur : ce prospect n'a pas d'adresse e-mail dans Odoo.";
          const mailId = await odooCall<number>(creds, uid, "mail.mail", "create", [
            {
              subject: args.subject,
              body_html: args.body_html,
              email_to: to,
              model: "crm.lead",
              res_id: leadId,
              auto_delete: false,
            },
          ]);
          await odooCall(creds, uid, "mail.mail", "send", [[mailId]]);
          await odooCall(creds, uid, "crm.lead", "message_post", [[leadId]], {
            body: args.body_html,
            subject: args.subject,
            message_type: "email",
          });
          await supabase.from("messages").insert({
            conversation_id: conv.id,
            user_id: context.userId,
            role: "email",
            subject: args.subject,
            content: args.body_html,
            sent_at: new Date().toISOString(),
          });
          await log("email", `E-mail envoyé à ${to} : ${args.subject}`);
          return `E-mail envoyé à ${to}.`;
        }
        case "log_note": {
          await odooCall(creds, uid, "crm.lead", "message_post", [[leadId]], {
            body: args.note,
            message_type: "comment",
          });
          await log("note", args.note);
          return "Note enregistrée dans Odoo.";
        }
        case "schedule_activity": {
          const [modelRec] = await odooCall<any[]>(creds, uid, "ir.model", "search_read", [
            [["model", "=", "crm.lead"]],
          ], { fields: ["id"], limit: 1 });
          const types = await odooCall<any[]>(creds, uid, "mail.activity.type", "search_read", [
            [["name", "ilike", "call"]],
          ], { fields: ["id"], limit: 1 });
          const anyType = types.length
            ? types
            : await odooCall<any[]>(creds, uid, "mail.activity.type", "search_read", [[]], {
                fields: ["id"],
                limit: 1,
              });
          await odooCall(creds, uid, "mail.activity", "create", [
            {
              res_model_id: modelRec.id,
              res_id: leadId,
              summary: args.summary,
              date_deadline: args.date_deadline,
              activity_type_id: anyType[0]?.id,
              user_id: uid,
            },
          ]);
          await log("activite", `${args.summary} (${args.date_deadline})`);
          return "Activité planifiée dans Odoo.";
        }
        case "create_meeting": {
          const start = args.start as string;
          const stop = new Date(
            new Date(start.replace(" ", "T") + "Z").getTime() + (args.duration_hours || 1) * 3600000,
          )
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
          const eventId = await odooCall<number>(creds, uid, "calendar.event", "create", [
            {
              name: args.name,
              start,
              stop,
              duration: args.duration_hours,
              res_model: "crm.lead",
              res_id: leadId,
            },
          ]);
          await supabase
            .from("conversations")
            .update({ status: "rdv" })
            .eq("id", conv.id);
          await log("rdv", `${args.name} le ${start} (Odoo #${eventId})`);
          return "Rendez-vous créé dans le calendrier Odoo.";
        }
        case "move_stage": {
          const stages = await odooCall<any[]>(creds, uid, "crm.stage", "search_read", [
            [["name", "ilike", args.stage_name]],
          ], { fields: ["id", "name"], limit: 1 });
          if (!stages.length) return "Étape introuvable dans le pipeline.";
          await odooCall(creds, uid, "crm.lead", "write", [[leadId], { stage_id: stages[0].id }]);
          await supabase.from("conversations").update({ stage: stages[0].name }).eq("id", conv.id);
          await log("etape", `Étape passée à ${stages[0].name}`);
          return `Étape mise à jour : ${stages[0].name}.`;
        }
        default:
          return "Outil inconnu.";
      }
    }

    const { data: history } = await supabase
      .from("messages")
      .select("role, subject, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(40);

    const systemPrompt = [
      "Tu es un commercial senior francophone. Mission unique : décrocher un rendez-vous de démonstration avec le prospect.",
      `Prospect : ${conv.lead_name}${conv.partner_name ? ` (${conv.partner_name})` : ""}, e-mail : ${conv.email ?? "inconnu"}, étape actuelle : ${conv.stage ?? "inconnue"}.`,
      `Expéditeur : ${settings.sender_name ?? "l'utilisateur"}.`,
      "Tu agis réellement dans Odoo via les outils : lis la fiche, envoie des e-mails courts et personnalisés, consigne des notes, planifie des relances, crée le rendez-vous et fais avancer l'étape quand un rendez-vous est obtenu.",
      "Réponds toujours en français, de façon concise, en expliquant ce que tu as fait.",
      settings.agent_instructions ? `Consignes de l'utilisateur : ${settings.agent_instructions}` : "",
      `Date du jour : ${new Date().toISOString().slice(0, 10)}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m: any) =>
        m.role === "user"
          ? { role: "user", content: m.content }
          : { role: "assistant", content: (m.subject ? `[E-mail] ${m.subject}\n` : "") + m.content },
      ),
      { role: "user", content: data.userMessage },
    ];

    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: context.userId,
      role: "user",
      content: data.userMessage,
    });

    let finalText = "";
    for (let step = 0; step < 8; step++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({ model: MODEL, messages, tools, reasoning_effort: "none" }),
      });
      if (res.status === 429) throw new Error("Trop de requêtes IA, réessayez dans un instant.");
      if (res.status === 402) throw new Error("Crédits IA épuisés : ajoutez des crédits pour continuer.");
      if (!res.ok) throw new Error(`Erreur IA (${res.status}) : ${await res.text()}`);
      const json: any = await res.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error("Réponse IA vide.");
      messages.push(msg);
      const calls: ToolCall[] = msg.tool_calls ?? [];
      if (!calls.length) {
        finalText = msg.content ?? "";
        break;
      }
      for (const call of calls) {
        let result: string;
        try {
          result = await execTool(call.function.name, JSON.parse(call.function.arguments || "{}"));
        } catch (e) {
          result = `Erreur : ${e instanceof Error ? e.message : String(e)}`;
          await log(call.function.name, result, false);
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    if (finalText) {
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        user_id: context.userId,
        role: "assistant",
        content: finalText,
      });
    }
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id);

    return { text: finalText };
  });
