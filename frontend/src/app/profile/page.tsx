"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/property/DashboardNav";
import SectionNav, { type ProfileSection } from "@/components/profile/SectionNav";
import PersonalDetailsSection from "@/components/profile/PersonalDetailsSection";
import PasswordSecuritySection from "@/components/profile/PasswordSecuritySection";
import KycSection from "@/components/profile/KycSection";
import styles from "./page.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<ProfileSection>("personal");

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  return (
    <div className={styles.page}>
      <DashboardNav />

      <div className={styles.body}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.heading}>Account settings</h1>
            <p className={styles.subheading}>
              Manage your details, security, and identity verification.
            </p>
          </div>
        </div>

        <div className={styles.layout}>
          <SectionNav active={activeSection} onChange={setActiveSection} kycBadge={null} onLogout={handleLogout} />

          <div className={styles.content}>
            {activeSection === "personal" && <PersonalDetailsSection />}
            {activeSection === "security" && <PasswordSecuritySection />}
            {activeSection === "kyc" && <KycSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
