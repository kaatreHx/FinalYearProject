import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create account — Meridian Estates",
};

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
