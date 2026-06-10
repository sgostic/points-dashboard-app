import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard?project=guide&range=30d");
}
