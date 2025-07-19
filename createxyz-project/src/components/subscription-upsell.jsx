"use client";
import React from "react";



export default function Index() {
  return (function MainComponent({ redirectURL }) {
  const [loading, setLoading] = useState(false);
  const { data: user, loading: userLoading } = useUser();

  const handleCheckout = async () => {
    if (!userLoading && user) {
      setLoading(true);
      try {
        const fullRedirectURL = redirectURL.startsWith("http")
          ? redirectURL
          : `${window.location.origin}${redirectURL}`;
        const response = await fetch("/api/stripe-checkout-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ redirectURL: fullRedirectURL }),
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <h2>Pro Subscription</h2>
      <div>
        <span>$10</span>
        <span>/month</span>
      </div>
      <button onClick={handleCheckout} disabled={loading || userLoading}>
        {loading || userLoading
          ? "Processing..."
          : user
            ? "Subscribe Now"
            : "Please sign in"}
      </button>
    </div>
  );
}

function StoryComponent() {
  return <MainComponent redirectURL="/account" />;
});
}