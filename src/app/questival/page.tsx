import type { Metadata } from "next";
import { ForumMobile } from "@/components/forum/ForumMobile";

export const metadata: Metadata = {
  title: "RU26 · Assignment 3: Questival — Class of 2021",
  description:
    "Saturday, Sept 12. Capture as you go and tag your crew — every proof counts on upload. Quests close at 7:00 PM.",
};

export default function Page() {
  return <ForumMobile initialTab="questival" />;
}
