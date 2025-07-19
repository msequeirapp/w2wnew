async function handler() {
  const session = getSession();

  if (!session?.user?.email) {
    return {
      status: "unauthenticated",
      message: "User not logged in",
    };
  }

  const results = await sql`
    SELECT subscription_status, stripe_id, last_check_subscription_status_at
    FROM auth_users 
    WHERE email = ${session.user.email}
  `;

  if (!results.length) {
    return {
      status: "not_found",
      message: "User not found",
    };
  }

  const { subscription_status, stripe_id, last_check_subscription_status_at } =
    results[0];

  // If we have a stripe ID but no status, or status is stale (>30 days), check with Stripe
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const isStatusStale =
    last_check_subscription_status_at &&
    new Date(last_check_subscription_status_at) < thirtyDaysAgo;

  if (stripe_id && (!subscription_status || isStatusStale)) {
    try {
      const subscription = await stripe.customers.retrieve(stripe_id, {
        expand: ["subscriptions"],
      });

      if (subscription?.subscriptions?.data[0]?.status) {
        // Update our database with latest status from Stripe
        await sql`
          UPDATE auth_users 
          SET subscription_status = ${subscription.subscriptions.data[0].status}, 
              last_check_subscription_status_at = NOW()
          WHERE email = ${session.user.email}
        `;
        return {
          status: subscription.subscriptions.data[0].status,
          stripeId: stripe_id,
        };
      }
    } catch (error) {
      console.error("Error fetching from Stripe:", error);
    }
  }

  return {
    status: subscription_status || "none",
    stripeId: stripe_id,
  };
}
export async function POST(request) {
  return handler(await request.json());
}