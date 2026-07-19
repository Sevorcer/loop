import { DispatchProvider, DispatchScreen } from "@/features/dispatch";

export default function DispatchPage() {
  return (
    <DispatchProvider>
      <DispatchScreen />
    </DispatchProvider>
  );
}
