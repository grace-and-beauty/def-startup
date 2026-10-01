import { MessageScreen } from "@/components/message-screen";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return <MessageScreen title={t("notFound.title")} text={t("notFound.text")} />;
}
