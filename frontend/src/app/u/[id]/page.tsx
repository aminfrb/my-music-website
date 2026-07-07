"use client";

import { ProfileView } from "@/components/profile/ProfileView";

export default function UserPage({ params }: { params: { id: string } }) {
  return <ProfileView userId={params.id} />;
}
