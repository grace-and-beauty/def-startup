import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/config/brand";
import { listNiches } from "@/config/niches";
import { t } from "@/lib/i18n";

// Placeholder home page for stage 1; the real landing comes in stage 2.
export default function HomePage() {
  const niches = listNiches();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <Badge variant="secondary">{t("home.stageNotice")}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("home.title", { brand: brand.name })}
        </h1>
        <p className="text-muted-foreground">{t("home.subtitle")}</p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("home.chooseNiche")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {niches.map((niche) => (
            <li key={niche.slug}>
              <Card>
                <CardHeader>
                  <CardTitle>{niche.name}</CardTitle>
                  <CardDescription>{niche.rewardText}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
