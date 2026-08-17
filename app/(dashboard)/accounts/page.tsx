import { redirect } from "next/navigation";

export default function AccountsRedirectPage() {
  redirect("/settings?tab=accounts");
}
