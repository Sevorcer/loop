import {
  CompanyBrainProvider,
  CompanyBrainScreen,
} from "@/features/company-brain";

export default function CompanyBrainPage() {
  return (
    <CompanyBrainProvider>
      <CompanyBrainScreen />
    </CompanyBrainProvider>
  );
}
