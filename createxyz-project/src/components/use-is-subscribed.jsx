"use client";
import React from "react";

function useIsSubscribed() {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [fetchCount, setFetchCount] = React.useState(0);

  const stripeSessionId = React.useMemo(() => {
    if (typeof window !== "undefined") {
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      return urlParams.get("session_id");
    }
    return null;
  }, []);

  const checkSubscription = React.useCallback(async () => {
    try {
      const response = await fetch("/api/get-subscription-status", {
        method: "POST",
      });
      const data = await response.json();

      const isActive =
        data.status === "active" ||
        process.env.NEXT_PUBLIC_CREATE_ENV !== "PRODUCTION";

      setStatus(isActive);
      setLoading(false);
    } catch (error) {
      console.error("Error checking subscription:", error);
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (stripeSessionId && !status && fetchCount < 5) {
      const timer = setTimeout(() => {
        checkSubscription();
        setFetchCount((prev) => prev + 1);
      }, 1000 * fetchCount);

      return () => clearTimeout(timer);
    } else if (!stripeSessionId) {
      checkSubscription();
    }
  }, [stripeSessionId, status, fetchCount, checkSubscription]);

  return {
    isSubscribed: status,
    data: status,
    loading,
  };
}

function StoryComponent() {
  const { isSubscribed, loading } = useIsSubscribed();

  if (loading) {
    return (
      <div className="rounded-lg bg-gray-100 p-4 animate-pulse">
        Checking subscription status...
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-green-700">
        <i className="fas fa-check-circle mr-2"></i>
        Active subscription
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-yellow-50 p-4 text-yellow-700">
      <i className="fas fa-exclamation-circle mr-2"></i>
      No active subscription
    </div>
  );
}

export default useIsSubscribed;