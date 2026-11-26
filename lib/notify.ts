/** Tell the owner about a new sign-up. Quiet when mail is not configured. */
export async function notifyNewSignup(email: string, sections: string[]): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Seed to Harvest <onboarding@resend.dev>",
        to: [to],
        subject: `New grower waiting: ${email}`,
        text: `${email} signed up for ${sections.join(" and ") || "a garden"} and is waiting for approval.`,
      }),
    });
  } catch {
    // Mail is optional. Sign-up still succeeds.
  }
}
