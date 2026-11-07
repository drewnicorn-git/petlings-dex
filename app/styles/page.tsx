import type { Metadata } from "next";
import { StylePicker } from "@/components/style-picker";

export const metadata: Metadata = {
  title: "Picture styles · Merge Board",
  description: "Compare sticker, storybook, and chibi drawings for Cat, Bunny, and Chick.",
};

export default function StylesPage() {
  return <StylePicker />;
}
