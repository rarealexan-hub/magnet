import { Resend } from "resend";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Magnet <onboarding@resend.dev>";

  if (!apiKey) {
    const links = Array.from(`${input.text}\n${input.html}`.matchAll(/https?:\/\/[^\s"'<>]+/g), (match) => match[0]);
    console.log("[email:log]", JSON.stringify({
      to: input.to,
      subject: input.subject,
      links: [...new Set(links)],
    }));
    return true;
  }

  try {
    const resend = new Resend(apiKey);
    const { idempotencyKey, ...message } = input;
    const result = await resend.emails.send(
      { from, ...message },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (result.error) throw new Error(result.error.message);
    return true;
  } catch (error) {
    console.error("Email send failed:", {
      to: input.to,
      subject: input.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}