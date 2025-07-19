async function handler(event, request) {
  function verifyStripeWebhook(secret, body, signature) {
    const sigHeader = signature.split(",");
    const timestamp = sigHeader.find((x) => x.startsWith("t=")).split("=")[1];
    const actualSig = sigHeader.find((x) => x.startsWith("v1=")).split("=")[1];
    const signedPayload = `${timestamp}.${body}`;

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSig),
      Buffer.from(actualSig)
    );
  }
  const isVerified = verifyStripeWebhook(
    process.env.STRIPE_WEBHOOK_SECRET,
    request["body"],
    request["headers"]["stripe-signature"]
  );

  if (isVerified) {
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;

      const customer = await stripe.customers.get(customerId);
      if (!customer) {
        throw new Error("Error fetching customer details from Stripe");
      }
      const email = customer.email;

      const results = await sql`
SELECT * FROM auth_users WHERE email = ${email}
`;

      if (results.length > 0) {
        await sql`
UPDATE auth_users SET subscription_status = ${status}, stripe_id = ${customerId} WHERE email = ${email}
`;
      }

      return { success: true };
    }
  }

  return { success: false };
}
export async function POST(request) {
  return handler(await request.json());
}