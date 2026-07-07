"use client";

import { useAuth } from "@/providers/AuthProvider";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { ProfileView } from "@/components/profile/ProfileView";

function MyProfile() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfileView userId={user.id} />;
}

export default function MePage() {
  return (
    <RequireAuth>
      <MyProfile />
    </RequireAuth>
  );
}
