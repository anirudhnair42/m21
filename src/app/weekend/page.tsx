import type { Metadata } from "next";
import { ForumMobile } from "@/components/forum/ForumMobile";

export const metadata: Metadata = {
  title: "RU26 · The weekend — Class of 2021",
  description:
    "Friday, Saturday, Sunday. Sept 11–13, 2026, San Francisco. Where to be and who's going.",
};

export default function Page() {
  return <ForumMobile initialTab="weekend" />;
}
