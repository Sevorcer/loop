import { DriveManualsProvider, DriveManualsScreen } from "@/features/manuals";

export default function DriveManualsPage() {
  return (
    <DriveManualsProvider>
      <DriveManualsScreen />
    </DriveManualsProvider>
  );
}
