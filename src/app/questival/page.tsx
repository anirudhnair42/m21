import type { Metadata } from "next";
import { ForumMobile } from "@/components/forum/ForumMobile";

export const metadata: Metadata = {
  title: "RU26 · Assignment 3: Questival — Class of 2021",
  description:
    "Saturday, Sept 12. Capture as you go, tag your crew, submit your final list before the bonfire.",
};

export default function Page() {
  return <ForumMobile initialTab="questival" />;
}
