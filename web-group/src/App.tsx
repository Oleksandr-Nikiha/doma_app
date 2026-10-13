import { useState } from "react";
import { GroupHeader } from "./components/GroupHeader.tsx";
import { GroupHero } from "./components/GroupHero.tsx";
import { ProjectsSection } from "./components/ProjectsSection.tsx";
import { DomaClubSection } from "./components/DomaClubSection.tsx";
import { PromotionsSection } from "./components/PromotionsSection.tsx";
import { PartnershipSection } from "./components/PartnershipSection.tsx";
import { CareersSection } from "./components/CareersSection.tsx";
import { GroupFooter } from "./components/GroupFooter.tsx";
import { UserCabinetModal } from "./components/cabinet/UserCabinetModal.tsx";
import { isUserAuthenticated, USER_PROFILE_STORAGE_KEY, type UserProfile } from "./types/user.ts";

export function App() {
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isUserAuthenticated(parsed)) return parsed;
      }
    } catch {}
    return null;
  });

  return (
    <div id="top" className="min-h-screen bg-[#FAF7F2] text-[#2C1E14] flex flex-col font-sans selection:bg-[#E29E57]/30">
      <GroupHeader
        onOpenCabinet={() => setCabinetOpen(true)}
        userProfile={userProfile}
      />
      <main className="flex-1">
        <GroupHero />
        <ProjectsSection />
        <DomaClubSection onOpenCabinet={() => setCabinetOpen(true)} />
        <PromotionsSection />
        <PartnershipSection />
        <CareersSection />
      </main>
      <GroupFooter />

      <UserCabinetModal
        isOpen={cabinetOpen}
        onClose={() => setCabinetOpen(false)}
        isAuthenticated={Boolean(userProfile && isUserAuthenticated(userProfile))}
        onProfileUpdated={(p) => setUserProfile(isUserAuthenticated(p) ? p : null)}
        onAuthSuccess={(p) => setUserProfile(p)}
      />
    </div>
  );
}
